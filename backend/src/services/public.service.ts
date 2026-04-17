import { sql } from 'kysely';
import { db } from '../db';
import { AppError } from '../middleware/error';
import { authService } from './auth.service';
import { bookingService, BookingItem, SlotItem } from './booking.service';
import { BusinessDetail } from './business.service';
import { trackEvent } from '../utils/track-event';

// ─── Service ──────────────────────────────────────────────────────────────────

export interface CreatePublicBookingParams {
  slug: string;
  staff_id: string;
  service_id: string;
  slot_id: string;
  phone: string;
  code: string;
  name?: string;
}

export class PublicService {
  /**
   * Get business details by slug (no auth required).
   */
  async getBusinessBySlug(slug: string, lang: 'ru' | 'ce' = 'ru'): Promise<BusinessDetail> {
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
        'b.slug',
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
      ])
      .where('b.slug', '=', slug)
      .where('b.is_active', '=', true)
      .executeTakeFirst();

    if (!business) {
      throw new AppError(404, 'Business not found', 'BUSINESS_NOT_FOUND');
    }

    const [staff, services] = await Promise.all([
      db
        .selectFrom('staff')
        .select(['id', 'name', 'slug', 'role', 'avatar_url'])
        .where('business_id', '=', business.id)
        .where('is_active', '=', true)
        .execute(),
      db
        .selectFrom('services')
        .select(['id', 'name', 'price', 'duration_minutes'])
        .where('business_id', '=', business.id)
        .where('is_active', '=', true)
        .execute(),
    ]);

    const categoryName = lang === 'ce' ? business.category_name_ce : business.category_name_ru;

    trackEvent({
      event_type: 'business_card_view',
      payload: { business_id: business.id, via: 'public_link' },
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

  /**
   * Get available slots for a business identified by slug.
   */
  async getSlotsBySlug(
    slug: string,
    staffId?: string,
    date?: string,
  ): Promise<SlotItem[]> {
    const business = await db
      .selectFrom('businesses')
      .select('id')
      .where('slug', '=', slug)
      .where('is_active', '=', true)
      .executeTakeFirst();

    if (!business) {
      throw new AppError(404, 'Business not found', 'BUSINESS_NOT_FOUND');
    }

    return bookingService.getSlots(business.id, staffId, date);
  }

  /**
   * Create a booking via public link:
   * 1. Verify OTP
   * 2. Get/create user
   * 3. Create booking with source='link'
   * 4. Track booking_via_link event
   */
  async createPublicBooking(params: CreatePublicBookingParams): Promise<BookingItem> {
    const { slug, staff_id, service_id, slot_id, phone, code, name } = params;

    // Resolve business by slug
    const business = await db
      .selectFrom('businesses')
      .select('id')
      .where('slug', '=', slug)
      .where('is_active', '=', true)
      .executeTakeFirst();

    if (!business) {
      throw new AppError(404, 'Business not found', 'BUSINESS_NOT_FOUND');
    }

    // Verify OTP and get/create user
    const userId = await authService.verifyOtpGetUserId(phone, code, name);

    // Create booking with source='link'
    const booking = await bookingService.createBooking({
      user_id: userId,
      slot_id,
      service_id,
      source: 'link',
    });

    // Track event (fire-and-forget)
    trackEvent({
      event_type: 'booking_via_link',
      payload: { business_id: business.id, slug, staff_id },
      user_id: userId,
    });

    return booking;
  }
}

export const publicService = new PublicService();
