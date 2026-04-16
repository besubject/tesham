import { sql } from 'kysely';
import { db } from '../db';
import { AppError } from '../middleware/error';
import { trackEvent } from '../utils/track-event';
import { transliterate } from '../utils/transliterate';
import type { StaffRole } from '../db/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BusinessProfile {
  id: string;
  name: string;
  category_id: string;
  address: string;
  lat: number | null;
  lng: number | null;
  phone: string;
  instagram_url: string | null;
  website_url: string | null;
  working_hours: Record<string, unknown>;
  photos: string[];
  portfolio_photos: string[];
  cancellation_threshold_minutes: number;
  reminder_settings: Record<string, unknown>;
  is_active: boolean;
  slug: string | null;
}

export interface BusinessProfileUpdate {
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  instagram_url?: string | null;
  website_url?: string | null;
  working_hours?: Record<string, unknown>;
  cancellation_threshold_minutes?: number;
  reminder_settings?: Record<string, unknown>;
  slug?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  slug: string;
  phone: string;
  role: StaffRole;
  avatar_url: string | null;
  is_active: boolean;
  user_id: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  is_active: boolean;
}

// ─── Slug validation ──────────────────────────────────────────────────────────

const SLUG_REGEX = /^[a-z0-9-]{3,50}$/;

function normalizeStaffSlugBase(name: string): string {
  const slug = transliterate(name).slice(0, 50);
  return slug || 'staff';
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class BusinessProfileService {
  /**
   * Verify the requesting user is an admin of the given business.
   */
  private async requireAdmin(userId: string, businessId: string): Promise<void> {
    const staff = await db
      .selectFrom('staff')
      .select(['id', 'role'])
      .where('user_id', '=', userId)
      .where('business_id', '=', businessId)
      .where('is_active', '=', true)
      .executeTakeFirst();

    if (!staff) {
      throw new AppError(403, 'You are not a staff member of this business', 'FORBIDDEN');
    }
    if (staff.role !== 'admin') {
      throw new AppError(403, 'Only admin can perform this action', 'FORBIDDEN');
    }
  }

  // ─── Slug helpers ──────────────────────────────────────────────────────────

  /**
   * Generate a unique slug for the given business name.
   * If the base slug is taken, appends -2, -3, etc.
   * Pass excludeBusinessId to ignore the current business when checking uniqueness.
   */
  async generateUniqueSlug(name: string, excludeBusinessId?: string): Promise<string> {
    const base = transliterate(name);
    let candidate = base;
    let counter = 2;

    while (true) {
      let qb = db
        .selectFrom('businesses')
        .select('id')
        .where('slug', '=', candidate);

      if (excludeBusinessId) {
        qb = qb.where('id', '!=', excludeBusinessId);
      }

      const existing = await qb.executeTakeFirst();

      if (!existing) return candidate;

      candidate = `${base}-${counter}`;
      counter++;
    }
  }

  async generateUniqueStaffSlug(
    businessId: string,
    name: string,
    excludeStaffId?: string,
  ): Promise<string> {
    const base = normalizeStaffSlugBase(name);
    let candidate = base;
    let counter = 2;

    while (true) {
      let qb = db
        .selectFrom('staff')
        .select('id')
        .where('business_id', '=', businessId)
        .where('slug', '=', candidate);

      if (excludeStaffId) {
        qb = qb.where('id', '!=', excludeStaffId);
      }

      const existing = await qb.executeTakeFirst();
      if (!existing) return candidate;

      candidate = `${base.slice(0, Math.max(1, 50 - `-${counter}`.length))}-${counter}`;
      counter++;
    }
  }

  // ─── Profile ───────────────────────────────────────────────────────────────

  async getProfile(businessId: string): Promise<BusinessProfile> {
    const business = await db
      .selectFrom('businesses as b')
      .selectAll('b')
      .select([
        sql<number | null>`ST_Y(b.location::geometry)`.as('lat'),
        sql<number | null>`ST_X(b.location::geometry)`.as('lng'),
      ])
      .where('b.id', '=', businessId)
      .executeTakeFirst();

    if (!business) {
      throw new AppError(404, 'Business not found', 'BUSINESS_NOT_FOUND');
    }

    return {
      id: business.id,
      name: business.name,
      category_id: business.category_id,
      address: business.address,
      lat: business.lat !== null ? Number(business.lat) : null,
      lng: business.lng !== null ? Number(business.lng) : null,
      phone: business.phone,
      instagram_url: business.instagram_url,
      website_url: business.website_url,
      working_hours: business.working_hours as Record<string, unknown>,
      photos: business.photos as string[],
      portfolio_photos: business.portfolio_photos as string[],
      cancellation_threshold_minutes: business.cancellation_threshold_minutes,
      reminder_settings: business.reminder_settings as Record<string, unknown>,
      is_active: business.is_active,
      slug: business.slug,
    };
  }

  async updateProfile(params: {
    userId: string;
    businessId: string;
    update: BusinessProfileUpdate;
  }): Promise<BusinessProfile> {
    const { userId, businessId, update } = params;

    await this.requireAdmin(userId, businessId);

    if (Object.keys(update).length === 0) {
      throw new AppError(400, 'No fields to update', 'VALIDATION_ERROR');
    }

    // Build update values — JSON fields need to be serialized
    const setValues: Record<string, unknown> = {};
    if (update.name !== undefined) setValues.name = update.name;
    if (update.address !== undefined) setValues.address = update.address;
    if (update.lat !== undefined || update.lng !== undefined) {
      if (update.lat === undefined || update.lng === undefined) {
        throw new AppError(400, 'lat and lng must be provided together', 'VALIDATION_ERROR');
      }
      setValues.location = sql`ST_SetSRID(ST_MakePoint(${update.lng}, ${update.lat}), 4326)::geography`;
    }
    if (update.phone !== undefined) setValues.phone = update.phone;
    if ('instagram_url' in update) setValues.instagram_url = update.instagram_url;
    if ('website_url' in update) setValues.website_url = update.website_url;
    if (update.cancellation_threshold_minutes !== undefined) {
      setValues.cancellation_threshold_minutes = update.cancellation_threshold_minutes;
    }
    if (update.working_hours !== undefined) {
      setValues.working_hours = JSON.stringify(update.working_hours);
    }
    if (update.reminder_settings !== undefined) {
      setValues.reminder_settings = JSON.stringify(update.reminder_settings);
    }
    if (update.slug !== undefined) {
      if (!SLUG_REGEX.test(update.slug)) {
        throw new AppError(
          400,
          'Slug must be 3-50 characters: lowercase letters, digits, hyphens only',
          'VALIDATION_ERROR',
        );
      }
      // Check uniqueness (excluding current business)
      const existing = await db
        .selectFrom('businesses')
        .select('id')
        .where('slug', '=', update.slug)
        .where('id', '!=', businessId)
        .executeTakeFirst();
      if (existing) {
        throw new AppError(409, 'This slug is already taken', 'SLUG_CONFLICT');
      }
      setValues.slug = update.slug;
    }

    await db
      .updateTable('businesses')
      .set(setValues)
      .where('id', '=', businessId)
      .execute();

    trackEvent({
      event_type: 'business_profile_updated',
      payload: { business_id: businessId, fields: Object.keys(update) },
      user_id: userId,
    });

    return this.getProfile(businessId);
  }

  // ─── Staff ─────────────────────────────────────────────────────────────────

  async getStaff(businessId: string): Promise<StaffMember[]> {
    const rows = await db
      .selectFrom('staff as s')
      .innerJoin('users as u', 'u.id', 's.user_id')
      .select([
        's.id',
        's.name',
        's.slug',
        's.role',
        's.avatar_url',
        's.is_active',
        's.user_id',
        'u.phone',
      ])
      .where('s.business_id', '=', businessId)
      .orderBy('s.role', 'asc')
      .execute();

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      phone: r.phone,
      role: r.role as StaffRole,
      avatar_url: r.avatar_url,
      is_active: r.is_active,
      user_id: r.user_id,
    }));
  }

  async getCurrentStaff(userId: string, businessId: string): Promise<StaffMember> {
    const row = await db
      .selectFrom('staff as s')
      .innerJoin('users as u', 'u.id', 's.user_id')
      .select([
        's.id',
        's.name',
        's.slug',
        's.role',
        's.avatar_url',
        's.is_active',
        's.user_id',
        'u.phone',
      ])
      .where('s.user_id', '=', userId)
      .where('s.business_id', '=', businessId)
      .where('s.is_active', '=', true)
      .executeTakeFirst();

    if (!row) {
      throw new AppError(404, 'Staff member not found', 'STAFF_NOT_FOUND');
    }

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      phone: row.phone,
      role: row.role as StaffRole,
      avatar_url: row.avatar_url,
      is_active: row.is_active,
      user_id: row.user_id,
    };
  }

  async addStaff(params: {
    userId: string;
    businessId: string;
    name: string;
    phone: string;
    role: StaffRole;
  }): Promise<StaffMember> {
    const { userId, businessId, name, phone, role } = params;

    await this.requireAdmin(userId, businessId);

    // Look up user by phone
    const user = await db
      .selectFrom('users')
      .select(['id', 'phone'])
      .where('phone', '=', phone)
      .executeTakeFirst();

    if (!user) {
      throw new AppError(404, 'User with this phone not found', 'USER_NOT_FOUND');
    }

    // Check not already a staff member
    const existing = await db
      .selectFrom('staff')
      .select(['id'])
      .where('business_id', '=', businessId)
      .where('user_id', '=', user.id)
      .executeTakeFirst();

    if (existing) {
      throw new AppError(409, 'User is already a staff member of this business', 'STAFF_EXISTS');
    }

    const slug = await this.generateUniqueStaffSlug(businessId, name);

    const [inserted] = await db
      .insertInto('staff')
      .values({
        business_id: businessId,
        user_id: user.id,
        name,
        slug,
        role,
        avatar_url: null,
        is_active: true,
      })
      .returning(['id', 'name', 'slug', 'role', 'avatar_url', 'is_active', 'user_id'])
      .execute();

    if (!inserted) {
      throw new AppError(500, 'Failed to create staff member', 'INTERNAL_ERROR');
    }

    trackEvent({
      event_type: 'business_staff_added',
      payload: { business_id: businessId, staff_user_id: user.id, role },
      user_id: userId,
    });

    return {
      id: inserted.id,
      name: inserted.name,
      slug: inserted.slug,
      phone: user.phone,
      role: inserted.role as StaffRole,
      avatar_url: inserted.avatar_url,
      is_active: inserted.is_active,
      user_id: inserted.user_id,
    };
  }

  async deleteStaff(params: {
    userId: string;
    businessId: string;
    staffId: string;
  }): Promise<void> {
    const { userId, businessId, staffId } = params;

    await this.requireAdmin(userId, businessId);

    // Cannot delete yourself
    const requestorStaff = await db
      .selectFrom('staff')
      .select(['id'])
      .where('user_id', '=', userId)
      .where('business_id', '=', businessId)
      .executeTakeFirst();

    if (requestorStaff?.id === staffId) {
      throw new AppError(400, 'Cannot remove yourself from staff', 'CANNOT_REMOVE_SELF');
    }

    const staff = await db
      .selectFrom('staff')
      .select(['id'])
      .where('id', '=', staffId)
      .where('business_id', '=', businessId)
      .executeTakeFirst();

    if (!staff) {
      throw new AppError(404, 'Staff member not found', 'STAFF_NOT_FOUND');
    }

    // Soft delete
    await db
      .updateTable('staff')
      .set({ is_active: false })
      .where('id', '=', staffId)
      .execute();

    trackEvent({
      event_type: 'business_staff_removed',
      payload: { business_id: businessId, staff_id: staffId },
      user_id: userId,
    });
  }

  // ─── Services ──────────────────────────────────────────────────────────────

  async getServices(businessId: string): Promise<ServiceItem[]> {
    const rows = await db
      .selectFrom('services')
      .select(['id', 'name', 'price', 'duration_minutes', 'is_active'])
      .where('business_id', '=', businessId)
      .orderBy('name', 'asc')
      .execute();

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      price: r.price,
      duration_minutes: r.duration_minutes,
      is_active: r.is_active,
    }));
  }

  async createService(params: {
    userId: string;
    businessId: string;
    name: string;
    price: number;
    duration_minutes: number;
  }): Promise<ServiceItem> {
    const { userId, businessId, name, price, duration_minutes } = params;

    await this.requireAdmin(userId, businessId);

    const [inserted] = await db
      .insertInto('services')
      .values({
        business_id: businessId,
        name,
        price,
        duration_minutes,
        is_active: true,
      })
      .returning(['id', 'name', 'price', 'duration_minutes', 'is_active'])
      .execute();

    if (!inserted) {
      throw new AppError(500, 'Failed to create service', 'INTERNAL_ERROR');
    }

    trackEvent({
      event_type: 'business_service_created',
      payload: { business_id: businessId, service_name: name },
      user_id: userId,
    });

    return {
      id: inserted.id,
      name: inserted.name,
      price: inserted.price,
      duration_minutes: inserted.duration_minutes,
      is_active: inserted.is_active,
    };
  }

  async updateService(params: {
    userId: string;
    businessId: string;
    serviceId: string;
    name?: string;
    price?: number;
    duration_minutes?: number;
    is_active?: boolean;
  }): Promise<ServiceItem> {
    const { userId, businessId, serviceId, name, price, duration_minutes, is_active } = params;

    await this.requireAdmin(userId, businessId);

    const service = await db
      .selectFrom('services')
      .select(['id'])
      .where('id', '=', serviceId)
      .where('business_id', '=', businessId)
      .executeTakeFirst();

    if (!service) {
      throw new AppError(404, 'Service not found', 'SERVICE_NOT_FOUND');
    }

    const setValues: Record<string, unknown> = {};
    if (name !== undefined) setValues.name = name;
    if (price !== undefined) setValues.price = price;
    if (duration_minutes !== undefined) setValues.duration_minutes = duration_minutes;
    if (is_active !== undefined) setValues.is_active = is_active;

    if (Object.keys(setValues).length === 0) {
      throw new AppError(400, 'No fields to update', 'VALIDATION_ERROR');
    }

    await db
      .updateTable('services')
      .set(setValues)
      .where('id', '=', serviceId)
      .execute();

    const updated = await db
      .selectFrom('services')
      .select(['id', 'name', 'price', 'duration_minutes', 'is_active'])
      .where('id', '=', serviceId)
      .executeTakeFirst();

    if (!updated) {
      throw new AppError(500, 'Failed to fetch updated service', 'INTERNAL_ERROR');
    }

    trackEvent({
      event_type: 'business_service_updated',
      payload: { business_id: businessId, service_id: serviceId },
      user_id: userId,
    });

    return {
      id: updated.id,
      name: updated.name,
      price: updated.price,
      duration_minutes: updated.duration_minutes,
      is_active: updated.is_active,
    };
  }

  async deleteService(params: {
    userId: string;
    businessId: string;
    serviceId: string;
  }): Promise<void> {
    const { userId, businessId, serviceId } = params;

    await this.requireAdmin(userId, businessId);

    const service = await db
      .selectFrom('services')
      .select(['id'])
      .where('id', '=', serviceId)
      .where('business_id', '=', businessId)
      .executeTakeFirst();

    if (!service) {
      throw new AppError(404, 'Service not found', 'SERVICE_NOT_FOUND');
    }

    // Soft delete
    await db
      .updateTable('services')
      .set({ is_active: false })
      .where('id', '=', serviceId)
      .execute();

    trackEvent({
      event_type: 'business_service_deleted',
      payload: { business_id: businessId, service_id: serviceId },
      user_id: userId,
    });
  }
}

export const businessProfileService = new BusinessProfileService();
