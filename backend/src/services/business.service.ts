import { sql } from 'kysely';
import { db } from '../db';
import { AppError } from '../middleware/error';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BusinessListParams {
  query?: string;
  category_id?: string;
  lat?: number;
  lng?: number;
  page: number;
  limit: number;
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
}

export interface BusinessDetail extends BusinessListItem {
  portfolio_photos: string[];
  reminder_settings: Record<string, unknown>;
  cancellation_threshold_minutes: number;
  category_name: string;
  staff: StaffItem[];
  services: ServiceItem[];
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

// ─── Service ──────────────────────────────────────────────────────────────────

export class BusinessService {
  async list(params: BusinessListParams): Promise<{ data: BusinessListItem[]; pagination: { page: number; limit: number; total: number } }> {
    const { query, category_id, lat, lng, page, limit } = params;
    const offset = (page - 1) * limit;
    const geoLat = lat ?? 0;
    const geoLng = lng ?? 0;
    const hasGeo = lat !== undefined && lng !== undefined;

    // Conditional distance expression (typed as number | null for both branches)
    const distanceExpr = hasGeo
      ? sql<number | null>`ST_Distance(b.location, ST_SetSRID(ST_MakePoint(${geoLng}, ${geoLat}), 4326)::geography)`
      : sql<number | null>`NULL`;

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
      ])
      .where('b.is_active', '=', true);

    if (category_id) {
      qb = qb.where('b.category_id', '=', category_id);
    }

    if (query) {
      const likePattern = `%${query}%`;
      qb = qb.where((eb) =>
        eb.or([
          eb('b.name', 'ilike', likePattern),
          eb(
            sql<boolean>`EXISTS (SELECT 1 FROM services WHERE business_id = b.id AND is_active = true AND name ILIKE ${likePattern})`,
            '=',
            true,
          ),
        ]),
      );
    }

    if (hasGeo) {
      qb = qb
        .orderBy(
          sql`ST_Distance(b.location, ST_SetSRID(ST_MakePoint(${geoLng}, ${geoLat}), 4326)::geography)`,
          'asc',
        )
        .orderBy(sql`(SELECT AVG(rating) FROM reviews WHERE business_id = b.id)`, 'desc');
    } else {
      qb = qb.orderBy(sql`(SELECT AVG(rating) FROM reviews WHERE business_id = b.id)`, 'desc');
    }

    // Count query (mirrors filter logic)
    let countQb = db
      .selectFrom('businesses')
      .select(sql<string>`COUNT(*)`.as('total'))
      .where('is_active', '=', true);

    if (category_id) {
      countQb = countQb.where('category_id', '=', category_id);
    }

    if (query) {
      const likePattern = `%${query}%`;
      countQb = countQb.where((eb) =>
        eb.or([
          eb('name', 'ilike', likePattern),
          eb(
            sql<boolean>`EXISTS (SELECT 1 FROM services WHERE business_id = businesses.id AND is_active = true AND name ILIKE ${likePattern})`,
            '=',
            true,
          ),
        ]),
      );
    }

    const [rows, countResult] = await Promise.all([
      qb.limit(limit).offset(offset).execute(),
      countQb.executeTakeFirst(),
    ]);

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
      })),
      pagination: {
        page,
        limit,
        total: Number(countResult?.total ?? 0),
      },
    };
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
        .select(['id', 'name', 'role', 'avatar_url'])
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
    void db
      .insertInto('events')
      .values({
        event_type: 'business.view',
        payload: JSON.stringify({ business_id: id }),
        session_id: null,
        anonymous_user_hash: null,
        user_id: null,
      })
      .execute()
      .catch(() => undefined);

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
      staff,
      services,
    };
  }
}

export const businessService = new BusinessService();
