import { sql } from 'kysely';
import { db } from '../db';
import { AppError } from '../middleware/error';
import {
  buildSearchQueryVariants,
  buildSearchTokenVariants,
  SQL_CYRILLIC_SEARCH_CHARS,
  SQL_LATIN_SEARCH_CHARS,
} from '../utils/search-normalize';
import { trackEvent } from '../utils/track-event';

// ─── Cursor helpers ───────────────────────────────────────────────────────────

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset })).toString('base64url');
}

function decodeCursor(cursor: string): number {
  try {
    const data = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { offset?: number };
    return typeof data.offset === 'number' ? data.offset : 0;
  } catch {
    return 0;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BusinessListParams {
  query?: string;
  category_id?: string;
  sort?: 'rating' | 'distance';
  lat?: number;
  lng?: number;
  /** Page-based pagination (legacy) */
  page: number;
  limit: number;
  /** Cursor-based pagination (preferred) */
  cursor?: string;
}

export interface PopularBusinessItem {
  id: string;
  name: string;
  photo_url: string | null;
  rating_avg: number;
  rating_count: number;
  category_id: string;
  category_name: string;
  category_icon: string;
}

export interface BusinessListItem {
  id: string;
  name: string;
  address: string;
  phone: string;
  photos: string[];
  working_hours: Record<string, unknown>;
  instagram_url: string | null;
  website_url: string | null;
  category_id: string;
  category_name_ru: string;
  category_name_ce: string;
  category_icon: string;
  avg_rating: number | null;
  review_count: number;
  distance_m: number | null;
  search_match_type?: 'business' | 'staff' | 'service' | null;
  search_match_value?: string | null;
}

export interface BusinessDetail extends BusinessListItem {
  portfolio_photos: string[];
  reminder_settings: Record<string, unknown>;
  cancellation_threshold_minutes: number;
  category_name: string;
  staff: StaffItem[];
  services: ServiceItem[];
  lat: number | null;
  lng: number | null;
  slug: string | null;
}

interface StaffItem {
  id: string;
  name: string;
  role: string;
  avatar_url: string | null;
}

interface ServiceItem {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

type SearchMatchType = BusinessListItem['search_match_type'];

function buildLatinSearchExpr(columnRef: string) {
  return sql<string>`translate(lower(${sql.ref(columnRef)}), ${SQL_CYRILLIC_SEARCH_CHARS}, ${SQL_LATIN_SEARCH_CHARS})`;
}

function buildOrCondition(conditions: Array<ReturnType<typeof sql<boolean>>>) {
  if (conditions.length === 0) return sql<boolean>`false`;
  return sql<boolean>`(${sql.join(conditions, sql` OR `)})`;
}

function buildTextMatchCondition(
  columnRef: string,
  rawVariants: string[],
  latinVariants: string[],
  mode: 'exact' | 'prefix' | 'contains',
) {
  const columnExpr = sql.ref(columnRef);
  const latinExpr = buildLatinSearchExpr(columnRef);
  const rawConditions = rawVariants.map((variant) => {
    if (mode === 'exact') return sql<boolean>`${columnExpr} ILIKE ${variant}`;
    if (mode === 'prefix') return sql<boolean>`${columnExpr} ILIKE ${`${variant}%`}`;
    return sql<boolean>`${columnExpr} ILIKE ${`%${variant}%`}`;
  });
  const latinConditions = latinVariants.map((variant) => {
    if (mode === 'exact') return sql<boolean>`${latinExpr} ILIKE ${variant}`;
    if (mode === 'prefix') return sql<boolean>`${latinExpr} ILIKE ${`${variant}%`}`;
    return sql<boolean>`${latinExpr} ILIKE ${`%${variant}%`}`;
  });

  return buildOrCondition([...rawConditions, ...latinConditions]);
}

function buildExistsTextMatchCondition(
  tableName: 'staff' | 'services',
  businessIdRef: string,
  columnRef: 'staff.name' | 'services.name',
  rawVariants: string[],
  latinVariants: string[],
  mode: 'exact' | 'prefix' | 'contains',
) {
  const textCondition = buildTextMatchCondition(columnRef, rawVariants, latinVariants, mode);

  return sql<boolean>`EXISTS (
    SELECT 1
    FROM ${sql.table(tableName)}
    WHERE ${sql.ref(`${tableName}.business_id`)} = ${sql.ref(businessIdRef)}
      AND ${sql.ref(`${tableName}.is_active`)} = true
      AND ${textCondition}
  )`;
}

function buildSearchValueExpr(
  tableName: 'staff' | 'services',
  businessIdRef: string,
  columnRef: 'staff.name' | 'services.name',
  rawVariants: string[],
  latinVariants: string[],
) {
  const textCondition = buildTextMatchCondition(columnRef, rawVariants, latinVariants, 'contains');

  return sql<string | null>`(
    SELECT ${sql.ref(columnRef)}
    FROM ${sql.table(tableName)}
    WHERE ${sql.ref(`${tableName}.business_id`)} = ${sql.ref(businessIdRef)}
      AND ${sql.ref(`${tableName}.is_active`)} = true
      AND ${textCondition}
    ORDER BY ${sql.ref(columnRef)} ASC
    LIMIT 1
  )`;
}

function buildBusinessSearchCondition(
  businessIdRef: string,
  businessNameRef: string,
  query: string,
) {
  const tokens = buildSearchTokenVariants(query);

  if (tokens.length === 0) return null;

  const businessLatinExpr = buildLatinSearchExpr(businessNameRef);
  const serviceLatinExpr = buildLatinSearchExpr('services.name');
  const staffLatinExpr = buildLatinSearchExpr('staff.name');

  const tokenConditions = tokens.map((token) => {
    const rawMatches = token.rawVariants.map((variant) => {
      const likePattern = `%${variant}%`;

      return sql<boolean>`(
        ${sql.ref(businessNameRef)} ILIKE ${likePattern}
        OR EXISTS (
          SELECT 1
          FROM services
          WHERE services.business_id = ${sql.ref(businessIdRef)}
            AND services.is_active = true
            AND services.name ILIKE ${likePattern}
        )
        OR EXISTS (
          SELECT 1
          FROM staff
          WHERE staff.business_id = ${sql.ref(businessIdRef)}
            AND staff.is_active = true
            AND staff.name ILIKE ${likePattern}
        )
      )`;
    });

    const latinMatches = token.latinVariants.map((variant) => {
      const likePattern = `%${variant}%`;

      return sql<boolean>`(
        ${businessLatinExpr} ILIKE ${likePattern}
        OR EXISTS (
          SELECT 1
          FROM services
          WHERE services.business_id = ${sql.ref(businessIdRef)}
            AND services.is_active = true
            AND ${serviceLatinExpr} ILIKE ${likePattern}
        )
        OR EXISTS (
          SELECT 1
          FROM staff
          WHERE staff.business_id = ${sql.ref(businessIdRef)}
            AND staff.is_active = true
            AND ${staffLatinExpr} ILIKE ${likePattern}
        )
      )`;
    });

    return sql<boolean>`(${sql.join([...rawMatches, ...latinMatches], sql` OR `)})`;
  });

  return sql<boolean>`(${sql.join(tokenConditions, sql` AND `)})`;
}

function buildBusinessSearchRank(
  businessIdRef: string,
  businessNameRef: string,
  query: string,
) {
  const queryVariants = buildSearchQueryVariants(query);

  if (queryVariants.rawVariants.length === 0 && queryVariants.latinVariants.length === 0) {
    return null;
  }

  const businessExact = buildTextMatchCondition(
    businessNameRef,
    queryVariants.rawVariants,
    queryVariants.latinVariants,
    'exact',
  );
  const businessPrefix = buildTextMatchCondition(
    businessNameRef,
    queryVariants.rawVariants,
    queryVariants.latinVariants,
    'prefix',
  );
  const businessContains = buildTextMatchCondition(
    businessNameRef,
    queryVariants.rawVariants,
    queryVariants.latinVariants,
    'contains',
  );
  const staffExact = buildExistsTextMatchCondition(
    'staff',
    businessIdRef,
    'staff.name',
    queryVariants.rawVariants,
    queryVariants.latinVariants,
    'exact',
  );
  const staffPrefix = buildExistsTextMatchCondition(
    'staff',
    businessIdRef,
    'staff.name',
    queryVariants.rawVariants,
    queryVariants.latinVariants,
    'prefix',
  );
  const staffContains = buildExistsTextMatchCondition(
    'staff',
    businessIdRef,
    'staff.name',
    queryVariants.rawVariants,
    queryVariants.latinVariants,
    'contains',
  );
  const servicesExact = buildExistsTextMatchCondition(
    'services',
    businessIdRef,
    'services.name',
    queryVariants.rawVariants,
    queryVariants.latinVariants,
    'exact',
  );
  const servicesPrefix = buildExistsTextMatchCondition(
    'services',
    businessIdRef,
    'services.name',
    queryVariants.rawVariants,
    queryVariants.latinVariants,
    'prefix',
  );
  const servicesContains = buildExistsTextMatchCondition(
    'services',
    businessIdRef,
    'services.name',
    queryVariants.rawVariants,
    queryVariants.latinVariants,
    'contains',
  );

  return sql<number>`CASE
    WHEN ${businessExact} THEN 300
    WHEN ${businessPrefix} THEN 250
    WHEN ${businessContains} THEN 200
    WHEN ${staffExact} THEN 150
    WHEN ${staffPrefix} THEN 140
    WHEN ${staffContains} THEN 130
    WHEN ${servicesExact} THEN 120
    WHEN ${servicesPrefix} THEN 110
    WHEN ${servicesContains} THEN 100
    ELSE 0
  END`;
}

function buildBusinessSearchMatchType(
  businessIdRef: string,
  businessNameRef: string,
  query: string,
) {
  const queryVariants = buildSearchQueryVariants(query);

  if (queryVariants.rawVariants.length === 0 && queryVariants.latinVariants.length === 0) {
    return null;
  }

  const businessMatch = buildTextMatchCondition(
    businessNameRef,
    queryVariants.rawVariants,
    queryVariants.latinVariants,
    'contains',
  );
  const staffMatch = buildExistsTextMatchCondition(
    'staff',
    businessIdRef,
    'staff.name',
    queryVariants.rawVariants,
    queryVariants.latinVariants,
    'contains',
  );
  const servicesMatch = buildExistsTextMatchCondition(
    'services',
    businessIdRef,
    'services.name',
    queryVariants.rawVariants,
    queryVariants.latinVariants,
    'contains',
  );

  return sql<SearchMatchType>`CASE
    WHEN ${businessMatch} THEN 'business'
    WHEN ${staffMatch} THEN 'staff'
    WHEN ${servicesMatch} THEN 'service'
    ELSE NULL
  END`;
}

function buildBusinessSearchMatchValue(
  businessIdRef: string,
  businessNameRef: string,
  query: string,
) {
  const queryVariants = buildSearchQueryVariants(query);

  if (queryVariants.rawVariants.length === 0 && queryVariants.latinVariants.length === 0) {
    return null;
  }

  const businessMatch = buildTextMatchCondition(
    businessNameRef,
    queryVariants.rawVariants,
    queryVariants.latinVariants,
    'contains',
  );
  const staffMatch = buildExistsTextMatchCondition(
    'staff',
    businessIdRef,
    'staff.name',
    queryVariants.rawVariants,
    queryVariants.latinVariants,
    'contains',
  );
  const serviceMatch = buildExistsTextMatchCondition(
    'services',
    businessIdRef,
    'services.name',
    queryVariants.rawVariants,
    queryVariants.latinVariants,
    'contains',
  );
  const staffValue = buildSearchValueExpr(
    'staff',
    businessIdRef,
    'staff.name',
    queryVariants.rawVariants,
    queryVariants.latinVariants,
  );
  const serviceValue = buildSearchValueExpr(
    'services',
    businessIdRef,
    'services.name',
    queryVariants.rawVariants,
    queryVariants.latinVariants,
  );

  return sql<string | null>`CASE
    WHEN ${businessMatch} THEN ${sql.ref(businessNameRef)}
    WHEN ${staffMatch} THEN ${staffValue}
    WHEN ${serviceMatch} THEN ${serviceValue}
    ELSE NULL
  END`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class BusinessService {
  async list(params: BusinessListParams): Promise<{
    data: BusinessListItem[];
    pagination: { page: number; limit: number; total: number };
    next_cursor: string | null;
  }> {
    const { query, category_id, sort = 'rating', lat, lng, page, limit, cursor } = params;

    // Cursor-based pagination takes priority over page
    const offset = cursor !== undefined ? decodeCursor(cursor) : (page - 1) * limit;

    const geoLat = lat ?? 0;
    const geoLng = lng ?? 0;
    const sortByDistance = sort === 'distance';

    // Conditional distance expression (typed as number | null for both branches)
    const distanceExpr = sortByDistance
      ? sql<number | null>`ST_Distance(b.location, ST_SetSRID(ST_MakePoint(${geoLng}, ${geoLat}), 4326)::geography)`
      : sql<number | null>`NULL`;
    const searchRankExpr = query ? buildBusinessSearchRank('b.id', 'b.name', query) : null;
    const searchMatchTypeExpr = query
      ? buildBusinessSearchMatchType('b.id', 'b.name', query)
      : null;
    const searchMatchValueExpr = query
      ? buildBusinessSearchMatchValue('b.id', 'b.name', query)
      : null;

    let qb = db
      .selectFrom('businesses as b')
      .innerJoin('categories as c', 'c.id', 'b.category_id')
      .select([
        'b.id',
        'b.name',
        'b.address',
        'b.phone',
        'b.instagram_url',
        'b.website_url',
        'b.category_id',
        sql<string[]>`b.photos`.as('photos'),
        sql<Record<string, unknown>>`b.working_hours`.as('working_hours'),
        sql<string>`c.name_ru`.as('category_name_ru'),
        sql<string>`c.name_ce`.as('category_name_ce'),
        sql<string>`c.icon`.as('category_icon'),
        sql<number | null>`(SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE business_id = b.id)`.as('avg_rating'),
        sql<number>`(SELECT COUNT(*) FROM reviews WHERE business_id = b.id)`.as('review_count'),
        distanceExpr.as('distance_m'),
        (searchMatchTypeExpr ?? sql<SearchMatchType>`NULL`).as('search_match_type'),
        (searchMatchValueExpr ?? sql<string | null>`NULL`).as('search_match_value'),
      ])
      .where('b.is_active', '=', true);

    if (category_id) {
      qb = qb.where('b.category_id', '=', category_id);
    }

    if (query) {
      const searchCondition = buildBusinessSearchCondition('b.id', 'b.name', query);
      if (searchCondition) {
        qb = qb.where(searchCondition);
      }
    }
    if (searchRankExpr) {
      qb = qb.orderBy(searchRankExpr, 'desc');
    }

    if (sortByDistance) {
      qb = qb
        .orderBy(
          sql`ST_Distance(b.location, ST_SetSRID(ST_MakePoint(${geoLng}, ${geoLat}), 4326)::geography)`,
          'asc',
        )
        .orderBy(sql`(SELECT AVG(rating) FROM reviews WHERE business_id = b.id)`, 'desc');
    } else {
      qb = qb.orderBy(sql`(SELECT AVG(rating) FROM reviews WHERE business_id = b.id)`, 'desc');
    }

    // Stable secondary sort by id to ensure deterministic cursor pagination
    qb = qb.orderBy('b.id', 'asc');

    // Count query (mirrors filter logic)
    let countQb = db
      .selectFrom('businesses')
      .select(sql<string>`COUNT(*)`.as('total'))
      .where('is_active', '=', true);

    if (category_id) {
      countQb = countQb.where('category_id', '=', category_id);
    }

    if (query) {
      const searchCondition = buildBusinessSearchCondition('businesses.id', 'businesses.name', query);
      if (searchCondition) {
        countQb = countQb.where(searchCondition);
      }
    }

    const [rows, countResult] = await Promise.all([
      qb.limit(limit).offset(offset).execute(),
      countQb.executeTakeFirst(),
    ]);

    const total = Number(countResult?.total ?? 0);
    const nextOffset = offset + limit;
    const nextCursor = nextOffset < total ? encodeCursor(nextOffset) : null;

    // Track search query event (fire-and-forget)
    if (query) {
      trackEvent({
        event_type: 'search_query',
        payload: { query, category_id: category_id ?? null, sort, has_geo: sortByDistance },
      });
    }

    return {
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        address: row.address,
        phone: row.phone,
        photos: row.photos,
        working_hours: row.working_hours,
        instagram_url: row.instagram_url,
        website_url: row.website_url,
        category_id: row.category_id,
        category_name_ru: row.category_name_ru,
        category_name_ce: row.category_name_ce,
        category_icon: row.category_icon,
        avg_rating: row.avg_rating !== null ? Number(row.avg_rating) : null,
        review_count: Number(row.review_count),
        distance_m: row.distance_m !== null ? Number(row.distance_m) : null,
        search_match_type: row.search_match_type,
        search_match_value: row.search_match_value,
      })),
      pagination: {
        page,
        limit,
        total,
      },
      next_cursor: nextCursor,
    };
  }

  async getPopular(limit: number, lang: 'ru' | 'ce'): Promise<PopularBusinessItem[]> {
    interface PopularRow {
      id: string;
      name: string;
      photo_url: string | null;
      rating_avg: string;
      rating_count: string;
      category_id: string;
      category_name_ru: string;
      category_name_ce: string;
      category_icon: string;
    }

    const rows = await sql<PopularRow>`
      WITH booking_counts AS (
        SELECT business_id, COUNT(*)::float AS bookings_30d
        FROM bookings
        WHERE status = 'completed'
          AND completed_at > NOW() - INTERVAL '30 days'
        GROUP BY business_id
      ),
      max_bookings AS (
        SELECT COALESCE(MAX(bookings_30d), 1.0) AS max_count
        FROM booking_counts
      )
      SELECT
        b.id,
        b.name,
        (b.photos)[1]                                                     AS photo_url,
        b.category_id,
        c.name_ru                                                         AS category_name_ru,
        c.name_ce                                                         AS category_name_ce,
        c.icon                                                            AS category_icon,
        ROUND(COALESCE(
          (SELECT AVG(rating) FROM reviews WHERE business_id = b.id), 0
        )::numeric, 2)                                                    AS rating_avg,
        (SELECT COUNT(*) FROM reviews WHERE business_id = b.id)          AS rating_count,
        (
          0.7 * (COALESCE(
            (SELECT AVG(rating) FROM reviews WHERE business_id = b.id), 0
          ) / 5.0)
          + 0.3 * (COALESCE(bc.bookings_30d, 0) / mb.max_count)
        )                                                                 AS score
      FROM businesses b
      JOIN categories c ON c.id = b.category_id
      LEFT JOIN booking_counts bc ON bc.business_id = b.id
      CROSS JOIN max_bookings mb
      WHERE b.is_active = true
      ORDER BY score DESC, b.id ASC
      LIMIT ${limit}
    `.execute(db);

    trackEvent({
      event_type: 'popular_businesses_fetched',
      payload: { limit, count: rows.rows.length },
    });

    return rows.rows.map((row) => ({
      id: row.id,
      name: row.name,
      photo_url: row.photo_url,
      rating_avg: Number(row.rating_avg),
      rating_count: Number(row.rating_count),
      category_id: row.category_id,
      category_name: lang === 'ce' ? row.category_name_ce : row.category_name_ru,
      category_icon: row.category_icon,
    }));
  }

  async getById(id: string, lang: 'ru' | 'ce' = 'ru'): Promise<BusinessDetail> {
    const business = await db
      .selectFrom('businesses as b')
      .innerJoin('categories as c', 'c.id', 'b.category_id')
      .select([
        'b.id',
        'b.name',
        'b.address',
        'b.phone',
        'b.instagram_url',
        'b.website_url',
        'b.cancellation_threshold_minutes',
        'b.category_id',
        sql<string[]>`b.photos`.as('photos'),
        sql<string[]>`b.portfolio_photos`.as('portfolio_photos'),
        sql<Record<string, unknown>>`b.working_hours`.as('working_hours'),
        sql<Record<string, unknown>>`b.reminder_settings`.as('reminder_settings'),
        sql<string>`c.name_ru`.as('category_name_ru'),
        sql<string>`c.name_ce`.as('category_name_ce'),
        sql<string>`c.icon`.as('category_icon'),
        sql<number | null>`(SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE business_id = b.id)`.as('avg_rating'),
        sql<number>`(SELECT COUNT(*) FROM reviews WHERE business_id = b.id)`.as('review_count'),
        sql<number | null>`ST_Y(b.location::geometry)`.as('lat'),
        sql<number | null>`ST_X(b.location::geometry)`.as('lng'),
        'b.slug',
      ])
      .where('b.id', '=', id)
      .where('b.is_active', '=', true)
      .executeTakeFirst();

    if (!business) {
      throw new AppError(404, 'Business not found', 'BUSINESS_NOT_FOUND');
    }

    const [staff, services] = await Promise.all([
      db
        .selectFrom('staff')
        .select(['id', 'name', 'slug', 'role', 'avatar_url'])
        .where('business_id', '=', id)
        .where('is_active', '=', true)
        .execute(),
      db
        .selectFrom('services')
        .select(['id', 'name', 'price', 'duration_minutes'])
        .where('business_id', '=', id)
        .where('is_active', '=', true)
        .execute(),
    ]);

    const categoryName = lang === 'ce' ? business.category_name_ce : business.category_name_ru;

    // Log event (fire-and-forget)
    trackEvent({
      event_type: 'business_card_view',
      payload: { business_id: id },
    });

    return {
      id: business.id,
      name: business.name,
      address: business.address,
      phone: business.phone,
      photos: business.photos,
      portfolio_photos: business.portfolio_photos,
      working_hours: business.working_hours,
      reminder_settings: business.reminder_settings,
      instagram_url: business.instagram_url,
      website_url: business.website_url,
      cancellation_threshold_minutes: business.cancellation_threshold_minutes,
      category_id: business.category_id,
      category_name_ru: business.category_name_ru,
      category_name_ce: business.category_name_ce,
      category_icon: business.category_icon,
      category_name: categoryName,
      avg_rating: business.avg_rating !== null ? Number(business.avg_rating) : null,
      review_count: Number(business.review_count),
      distance_m: null,
      lat: business.lat !== null ? Number(business.lat) : null,
      lng: business.lng !== null ? Number(business.lng) : null,
      slug: business.slug,
      staff,
      services,
    };
  }
}

export const businessService = new BusinessService();
