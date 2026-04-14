import { sql } from 'kysely';
import { db } from '../db';
import { AppError } from '../middleware/error';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FavoriteBusinessItem {
  id: string;
  business_id: string;
  business_name: string;
  business_address: string;
  business_phone: string;
  category_name_ru: string;
  category_name_ce: string;
  created_at: Date;
}

export interface FavoriteStaffItem {
  id: string;
  staff_id: string;
  staff_name: string;
  staff_avatar_url: string | null;
  business_id: string;
  business_name: string;
  created_at: Date;
}

export interface GetFavoritesResult {
  businesses: FavoriteBusinessItem[];
  staff: FavoriteStaffItem[];
}

export interface AddFavoriteParams {
  user_id: string;
  business_id?: string;
  staff_id?: string;
}

export interface CreatedFavorite {
  id: string;
  user_id: string;
  business_id: string | null;
  staff_id: string | null;
  created_at: Date;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class FavoriteService {
  async getFavorites(userId: string): Promise<GetFavoritesResult> {
    const [businessRows, staffRows] = await Promise.all([
      db
        .selectFrom('favorites as f')
        .innerJoin('businesses as b', 'b.id', 'f.business_id')
        .innerJoin('categories as c', 'c.id', 'b.category_id')
        .select([
          'f.id',
          sql<string>`f.business_id`.as('business_id'),
          sql<string>`b.name`.as('business_name'),
          sql<string>`b.address`.as('business_address'),
          sql<string>`b.phone`.as('business_phone'),
          sql<string>`c.name_ru`.as('category_name_ru'),
          sql<string>`c.name_ce`.as('category_name_ce'),
          sql<Date>`f.created_at`.as('created_at'),
        ])
        .where('f.user_id', '=', userId)
        .where('f.business_id', 'is not', null)
        .orderBy('f.created_at', 'desc')
        .execute(),
      db
        .selectFrom('favorites as f')
        .innerJoin('staff as s', 's.id', 'f.staff_id')
        .innerJoin('businesses as b', 'b.id', 's.business_id')
        .select([
          'f.id',
          sql<string>`f.staff_id`.as('staff_id'),
          sql<string>`s.name`.as('staff_name'),
          's.avatar_url',
          sql<string>`s.business_id`.as('business_id'),
          sql<string>`b.name`.as('business_name'),
          sql<Date>`f.created_at`.as('created_at'),
        ])
        .where('f.user_id', '=', userId)
        .where('f.staff_id', 'is not', null)
        .orderBy('f.created_at', 'desc')
        .execute(),
    ]);

    const businesses: FavoriteBusinessItem[] = businessRows.map((row) => ({
      id: row.id,
      business_id: row.business_id,
      business_name: row.business_name,
      business_address: row.business_address,
      business_phone: row.business_phone,
      category_name_ru: row.category_name_ru,
      category_name_ce: row.category_name_ce,
      created_at: row.created_at,
    }));

    const staff: FavoriteStaffItem[] = staffRows.map((row) => ({
      id: row.id,
      staff_id: row.staff_id,
      staff_name: row.staff_name,
      staff_avatar_url: row.avatar_url,
      business_id: row.business_id,
      business_name: row.business_name,
      created_at: row.created_at,
    }));

    return { businesses, staff };
  }

  async addFavorite(params: AddFavoriteParams): Promise<CreatedFavorite> {
    const { user_id, business_id, staff_id } = params;

    // Check that the target entity exists
    if (business_id) {
      const business = await db
        .selectFrom('businesses')
        .select('id')
        .where('id', '=', business_id)
        .executeTakeFirst();

      if (!business) {
        throw new AppError(404, 'Business not found', 'BUSINESS_NOT_FOUND');
      }
    }

    if (staff_id) {
      const staffMember = await db
        .selectFrom('staff')
        .select('id')
        .where('id', '=', staff_id)
        .executeTakeFirst();

      if (!staffMember) {
        throw new AppError(404, 'Staff not found', 'STAFF_NOT_FOUND');
      }
    }

    // Check uniqueness
    let query = db
      .selectFrom('favorites')
      .select('id')
      .where('user_id', '=', user_id);

    if (business_id) {
      query = query.where('business_id', '=', business_id);
    } else if (staff_id) {
      query = query.where('staff_id', '=', staff_id);
    } else {
      throw new AppError(400, 'Either business_id or staff_id is required', 'INVALID_FAVORITE_TARGET');
    }

    const existing = await query.executeTakeFirst();

    if (existing) {
      throw new AppError(409, 'Favorite already exists', 'FAVORITE_ALREADY_EXISTS');
    }

    const favorite = await db
      .insertInto('favorites')
      .values({
        user_id,
        business_id: business_id ?? null,
        staff_id: staff_id ?? null,
      })
      .returning([
        'id',
        'user_id',
        'business_id',
        'staff_id',
        sql<Date>`created_at`.as('created_at'),
      ])
      .executeTakeFirst();

    if (!favorite) {
      throw new AppError(500, 'Failed to create favorite', 'INTERNAL_ERROR');
    }

    // Event tracking (fire-and-forget)
    void db
      .insertInto('events')
      .values({
        event_type: 'favorite_add',
        payload: JSON.stringify({
          favorite_id: favorite.id,
          business_id: business_id ?? null,
          staff_id: staff_id ?? null,
        }),
        session_id: null,
        anonymous_user_hash: null,
        user_id,
      })
      .execute()
      .catch(() => undefined);

    return {
      id: favorite.id,
      user_id: favorite.user_id,
      business_id: favorite.business_id,
      staff_id: favorite.staff_id,
      created_at: favorite.created_at,
    };
  }

  async removeFavorite(favoriteId: string, userId: string): Promise<void> {
    const favorite = await db
      .selectFrom('favorites')
      .select(['id', 'user_id', 'business_id', 'staff_id'])
      .where('id', '=', favoriteId)
      .executeTakeFirst();

    if (!favorite) {
      throw new AppError(404, 'Favorite not found', 'FAVORITE_NOT_FOUND');
    }

    if (favorite.user_id !== userId) {
      throw new AppError(403, 'Forbidden', 'FORBIDDEN');
    }

    await db
      .deleteFrom('favorites')
      .where('id', '=', favoriteId)
      .execute();

    // Event tracking (fire-and-forget)
    void db
      .insertInto('events')
      .values({
        event_type: 'favorite_remove',
        payload: JSON.stringify({
          favorite_id: favoriteId,
          business_id: favorite.business_id,
          staff_id: favorite.staff_id,
        }),
        session_id: null,
        anonymous_user_hash: null,
        user_id: userId,
      })
      .execute()
      .catch(() => undefined);
  }
}

export const favoriteService = new FavoriteService();
