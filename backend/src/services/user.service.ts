import { db } from '../db';
import { AppError } from '../middleware/error';
import type { User, UserLanguage } from '../db/types';

export interface UpdateUserDto {
  name?: string;
  language?: UserLanguage;
}

export class UserService {
  async getById(id: string): Promise<User> {
    const user = await db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!user) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    if (Object.keys(dto).length === 0) {
      return this.getById(id);
    }

    const updated = await db
      .updateTable('users')
      .set(dto)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    if (!updated) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    // Log event (fire-and-forget)
    void db
      .insertInto('events')
      .values({
        event_type: 'user.update_profile',
        payload: JSON.stringify({ fields: Object.keys(dto) }),
        session_id: null,
        anonymous_user_hash: null,
        user_id: id,
      })
      .execute()
      .catch(() => undefined);

    return updated;
  }

  async delete(id: string): Promise<void> {
    // Verify user exists first
    const user = await db
      .selectFrom('users')
      .select('id')
      .where('id', '=', id)
      .executeTakeFirst();

    if (!user) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    // Anonymize events — set user_id to null (events are kept for analytics)
    await db
      .updateTable('events')
      .set({ user_id: null })
      .where('user_id', '=', id)
      .execute();

    // Delete in dependency order
    await db.deleteFrom('favorites').where('user_id', '=', id).execute();
    await db.deleteFrom('reviews').where('user_id', '=', id).execute();
    await db.deleteFrom('bookings').where('user_id', '=', id).execute();
    await db.deleteFrom('users').where('id', '=', id).execute();

    // Log event (fire-and-forget, no user_id since deleted)
    void db
      .insertInto('events')
      .values({
        event_type: 'user.delete_account',
        payload: JSON.stringify({}),
        session_id: null,
        anonymous_user_hash: null,
        user_id: null,
      })
      .execute()
      .catch(() => undefined);
  }
}

export const userService = new UserService();
