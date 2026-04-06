import { sql } from 'kysely';
import { db } from '../db';
import { AppError } from '../middleware/error';
import { notificationService } from './notification.service';
import { trackEvent } from '../utils/track-event';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SlotItem {
  id: string;
  staff_id: string;
  staff_name: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  is_booked: boolean;
}

export interface BookingItem {
  id: string;
  status: string;
  slot_date: string;
  slot_start_time: string;
  service_name: string;
  service_price: number;
  business_id: string;
  business_name: string;
  staff_name: string;
  created_at: Date;
  cancelled_at: Date | null;
}

export interface CreateBookingParams {
  user_id: string;
  slot_id: string;
  service_id: string;
}

export interface CancelBookingResult {
  success: boolean;
  warning?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class BookingService {
  async getSlots(businessId: string, staffId?: string, date?: string): Promise<SlotItem[]> {
    let query = db
      .selectFrom('slots as sl')
      .innerJoin('staff as st', 'st.id', 'sl.staff_id')
      .select([
        'sl.id',
        'sl.staff_id',
        'st.name as staff_name',
        sql<string>`sl.date::text`.as('date'),
        'sl.start_time',
        'sl.is_booked',
      ])
      .where('st.business_id', '=', businessId)
      .where('st.is_active', '=', true)
      .where('sl.is_booked', '=', false)
      .orderBy('sl.date', 'asc')
      .orderBy('sl.start_time', 'asc');

    if (staffId) {
      query = query.where('sl.staff_id', '=', staffId);
    }

    if (date) {
      query = query.where(sql`sl.date::text`, '=', date);
    }

    const rows = await query.execute();

    return rows.map((row) => ({
      id: row.id,
      staff_id: row.staff_id,
      staff_name: row.staff_name,
      date: row.date,
      start_time: row.start_time,
      is_booked: row.is_booked,
    }));
  }

  async createBooking(params: CreateBookingParams): Promise<BookingItem> {
    const { user_id, slot_id, service_id } = params;

    const booking = await db.transaction().execute(async (trx) => {
      // Lock slot row to prevent concurrent bookings
      const slotResult = await sql<{
        id: string;
        is_booked: boolean;
        staff_id: string;
      }>`SELECT id, is_booked, staff_id FROM slots WHERE id = ${slot_id} FOR UPDATE`.execute(trx);

      const slot = slotResult.rows[0];

      if (!slot) {
        throw new AppError(404, 'Slot not found', 'SLOT_NOT_FOUND');
      }

      if (slot.is_booked) {
        throw new AppError(409, 'Slot is already booked', 'SLOT_ALREADY_BOOKED');
      }

      // Get staff + business info
      const staff = await trx
        .selectFrom('staff')
        .select(['id', 'business_id'])
        .where('id', '=', slot.staff_id)
        .where('is_active', '=', true)
        .executeTakeFirst();

      if (!staff) {
        throw new AppError(404, 'Staff not found', 'STAFF_NOT_FOUND');
      }

      // Validate service belongs to same business
      const service = await trx
        .selectFrom('services')
        .select(['id', 'business_id'])
        .where('id', '=', service_id)
        .where('is_active', '=', true)
        .executeTakeFirst();

      if (!service) {
        throw new AppError(404, 'Service not found', 'SERVICE_NOT_FOUND');
      }

      if (service.business_id !== staff.business_id) {
        throw new AppError(400, 'Service does not belong to this business', 'SERVICE_MISMATCH');
      }

      // Mark slot as booked
      await trx
        .updateTable('slots')
        .set({ is_booked: true })
        .where('id', '=', slot_id)
        .execute();

      // Create booking
      const newBooking = await trx
        .insertInto('bookings')
        .values({
          user_id,
          slot_id,
          service_id,
          business_id: staff.business_id,
          staff_id: slot.staff_id,
          status: 'confirmed',
          cancelled_at: null,
          source: 'app',
        })
        .returning(['id', 'status', 'business_id', 'staff_id', 'created_at'])
        .executeTakeFirst();

      if (!newBooking) {
        throw new AppError(500, 'Failed to create booking', 'INTERNAL_ERROR');
      }

      return { newBooking, businessId: staff.business_id };
    });

    // Event tracking (fire-and-forget)
    trackEvent({
      event_type: 'booking_complete',
      payload: {
        booking_id: booking.newBooking.id,
        business_id: booking.businessId,
        slot_id,
        service_id,
      },
      user_id,
    });

    // Notify business (fire-and-forget)
    void notificationService
      .notifyBookingCreated(booking.newBooking.id)
      .catch(() => undefined);

    // Fetch full booking details for response
    const detail = await this.getBookingDetail(booking.newBooking.id);
    if (!detail) {
      throw new AppError(500, 'Failed to fetch booking', 'INTERNAL_ERROR');
    }
    return detail;
  }

  async getMyBookings(userId: string): Promise<BookingItem[]> {
    const rows = await db
      .selectFrom('bookings as b')
      .innerJoin('slots as sl', 'sl.id', 'b.slot_id')
      .innerJoin('services as sv', 'sv.id', 'b.service_id')
      .innerJoin('businesses as biz', 'biz.id', 'b.business_id')
      .innerJoin('staff as st', 'st.id', 'b.staff_id')
      .select([
        'b.id',
        'b.status',
        sql<string>`sl.date::text`.as('slot_date'),
        'sl.start_time as slot_start_time',
        'sv.name as service_name',
        'sv.price as service_price',
        'b.business_id',
        'biz.name as business_name',
        'st.name as staff_name',
        sql<Date>`b.created_at`.as('created_at'),
        sql<Date | null>`b.cancelled_at`.as('cancelled_at'),
      ])
      .where('b.user_id', '=', userId)
      .orderBy('sl.date', 'desc')
      .orderBy('sl.start_time', 'desc')
      .execute();

    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      slot_date: row.slot_date,
      slot_start_time: row.slot_start_time,
      service_name: row.service_name,
      service_price: row.service_price,
      business_id: row.business_id,
      business_name: row.business_name,
      staff_name: row.staff_name,
      created_at: row.created_at,
      cancelled_at: row.cancelled_at,
    }));
  }

  async cancelBooking(userId: string, bookingId: string): Promise<CancelBookingResult> {
    // Load booking with slot date/time and business threshold
    const row = await db
      .selectFrom('bookings as b')
      .innerJoin('slots as sl', 'sl.id', 'b.slot_id')
      .innerJoin('businesses as biz', 'biz.id', 'b.business_id')
      .select([
        'b.id',
        'b.user_id',
        'b.status',
        'b.slot_id',
        sql<string>`sl.date::text`.as('slot_date'),
        'sl.start_time',
        'biz.cancellation_threshold_minutes',
      ])
      .where('b.id', '=', bookingId)
      .executeTakeFirst();

    if (!row) {
      throw new AppError(404, 'Booking not found', 'BOOKING_NOT_FOUND');
    }

    if (row.user_id !== userId) {
      throw new AppError(403, 'Forbidden', 'FORBIDDEN');
    }

    if (row.status !== 'confirmed') {
      throw new AppError(400, 'Only confirmed bookings can be cancelled', 'BOOKING_NOT_CANCELLABLE');
    }

    // Check cancellation threshold
    const appointmentDate = new Date(`${row.slot_date}T${row.start_time}:00`);
    const now = new Date();
    const diffMinutes = (appointmentDate.getTime() - now.getTime()) / (1000 * 60);
    const withinThreshold = diffMinutes < row.cancellation_threshold_minutes;

    // Cancel booking and free slot
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('bookings')
        .set({ status: 'cancelled', cancelled_at: new Date() })
        .where('id', '=', bookingId)
        .execute();

      await trx
        .updateTable('slots')
        .set({ is_booked: false })
        .where('id', '=', row.slot_id)
        .execute();
    });

    // Event tracking (fire-and-forget)
    trackEvent({
      event_type: 'booking_cancel',
      payload: { booking_id: bookingId, within_threshold: withinThreshold },
      user_id: userId,
    });

    // Notify business (fire-and-forget)
    void notificationService.notifyBookingCancelled(bookingId).catch(() => undefined);

    const result: CancelBookingResult = { success: true };
    if (withinThreshold) {
      result.warning = `Запись отменена менее чем за ${row.cancellation_threshold_minutes} минут до визита`;
    }

    return result;
  }

  private async getBookingDetail(bookingId: string): Promise<BookingItem | undefined> {
    const row = await db
      .selectFrom('bookings as b')
      .innerJoin('slots as sl', 'sl.id', 'b.slot_id')
      .innerJoin('services as sv', 'sv.id', 'b.service_id')
      .innerJoin('businesses as biz', 'biz.id', 'b.business_id')
      .innerJoin('staff as st', 'st.id', 'b.staff_id')
      .select([
        'b.id',
        'b.status',
        sql<string>`sl.date::text`.as('slot_date'),
        'sl.start_time as slot_start_time',
        'sv.name as service_name',
        'sv.price as service_price',
        'b.business_id',
        'biz.name as business_name',
        'st.name as staff_name',
        sql<Date>`b.created_at`.as('created_at'),
        sql<Date | null>`b.cancelled_at`.as('cancelled_at'),
      ])
      .where('b.id', '=', bookingId)
      .executeTakeFirst();

    if (!row) return undefined;

    return {
      id: row.id,
      status: row.status,
      slot_date: row.slot_date,
      slot_start_time: row.slot_start_time,
      service_name: row.service_name,
      service_price: row.service_price,
      business_id: row.business_id,
      business_name: row.business_name,
      staff_name: row.staff_name,
      created_at: row.created_at,
      cancelled_at: row.cancelled_at,
    };
  }
}

export const bookingService = new BookingService();
