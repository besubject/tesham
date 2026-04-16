import { sql } from 'kysely';
import { db } from '../db';
import { AppError } from '../middleware/error';
import type { BookingStatus } from '../db/types';
import { notificationService } from './notification.service';
import { trackEvent } from '../utils/track-event';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreatedSlot {
  id: string;
  staff_id: string;
  staff_name?: string;
  date: string;
  start_time: string;
  is_booked: boolean;
}

export interface BusinessBookingItem {
  id: string;
  status: BookingStatus;
  source: string;
  slot_date: string;
  slot_start_time: string;
  service_name: string;
  service_price: number;
  client_name: string | null;
  client_phone: string | null;
  staff_id: string;
  staff_name: string;
  created_at: Date;
  cancelled_at: Date | null;
}

interface BusinessBookingsListResult {
  bookings: BusinessBookingItem[];
  total: number;
  limit: number | null;
  offset: number;
  has_more: boolean;
}

// ─── Service ──────────────────────────────────────────────────────────────────

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getBusinessBookingsPeriodBounds(
  period: 'today' | 'week' | 'month',
  now: Date = new Date(),
): { start: string; end: string } {
  const start = new Date(now);
  const end = new Date(now);

  if (period === 'today') {
    const value = formatDateOnly(now);
    return { start: value, end: value };
  }

  if (period === 'week') {
    const day = start.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + mondayOffset);
    end.setDate(start.getDate() + 6);
    return { start: formatDateOnly(start), end: formatDateOnly(end) };
  }

  start.setDate(1);
  end.setMonth(end.getMonth() + 1, 0);
  return { start: formatDateOnly(start), end: formatDateOnly(end) };
}

export class BusinessBookingService {
  /**
   * Resolve the staff row for the requesting user within a given business.
   * Throws 403 if the user is not a staff member of that business.
   */
  private async resolveStaff(
    userId: string,
    businessId: string,
  ): Promise<{ staffId: string; role: string }> {
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

    return { staffId: staff.id, role: staff.role };
  }

  // ─── Slots ─────────────────────────────────────────────────────────────────

  async createSlots(params: {
    userId: string;
    businessId: string;
    staffId: string;
    date: string;
    times: string[];
  }): Promise<CreatedSlot[]> {
    const { userId, businessId, staffId, date, times } = params;

    const { staffId: requestorStaffId, role } = await this.resolveStaff(userId, businessId);

    // Validate the target staff belongs to this business
    const targetStaff = await db
      .selectFrom('staff')
      .select(['id', 'name'])
      .where('id', '=', staffId)
      .where('business_id', '=', businessId)
      .where('is_active', '=', true)
      .executeTakeFirst();

    if (!targetStaff) {
      throw new AppError(404, 'Staff member not found in this business', 'STAFF_NOT_FOUND');
    }

    if (role === 'employee' && staffId !== requestorStaffId) {
      throw new AppError(403, 'Employees can only create slots for themselves', 'FORBIDDEN');
    }

    if (times.length === 0) {
      throw new AppError(400, 'times array must not be empty', 'VALIDATION_ERROR');
    }

    const uniqueTimes = Array.from(new Set(times));
    const existingRows = await db
      .selectFrom('slots')
      .select('start_time')
      .where('staff_id', '=', staffId)
      .where(sql`date::text`, '=', date)
      .where('start_time', 'in', uniqueTimes)
      .execute();

    const existingTimes = new Set(existingRows.map((row) => row.start_time));
    const timesToCreate = uniqueTimes.filter((time) => !existingTimes.has(time));

    if (timesToCreate.length === 0) {
      return [];
    }

    const rows = await db
      .insertInto('slots')
      .values(
        timesToCreate.map((t) => ({
          staff_id: staffId,
          date,
          start_time: t,
          is_booked: false,
        })),
      )
      .returning(['id', 'staff_id', sql<string>`date::text`.as('date'), 'start_time', 'is_booked'])
      .execute();

    trackEvent({
      event_type: 'business_slots_created',
      payload: { business_id: businessId, staff_id: staffId, date, count: rows.length },
      user_id: userId,
    });

    return rows.map((r) => ({
      id: r.id,
      staff_id: r.staff_id,
      staff_name: targetStaff.name,
      date: r.date,
      start_time: r.start_time,
      is_booked: r.is_booked,
    }));
  }

  async getBusinessSlots(params: {
    userId: string;
    businessId: string;
    staffId?: string;
    date?: string;
  }): Promise<CreatedSlot[]> {
    const { userId, businessId, staffId, date } = params;
    const { staffId: requestorStaffId, role } = await this.resolveStaff(userId, businessId);

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
      .where('st.business_id', '=', businessId);

    if (role === 'employee') {
      query = query.where('sl.staff_id', '=', requestorStaffId);
    } else if (staffId) {
      query = query.where('sl.staff_id', '=', staffId);
    }

    if (date) {
      query = query.where(sql`sl.date::text`, '=', date);
    }

    const rows = await query
      .orderBy('sl.date', 'asc')
      .orderBy('sl.start_time', 'asc')
      .execute();

    return rows.map((row) => ({
      id: row.id,
      staff_id: row.staff_id,
      staff_name: row.staff_name,
      date: row.date,
      start_time: row.start_time,
      is_booked: row.is_booked,
    }));
  }

  async deleteSlot(params: {
    userId: string;
    businessId: string;
    slotId: string;
  }): Promise<void> {
    const { userId, businessId, slotId } = params;

    const { staffId, role } = await this.resolveStaff(userId, businessId);

    // Load slot
    const slot = await db
      .selectFrom('slots as sl')
      .innerJoin('staff as st', 'st.id', 'sl.staff_id')
      .select(['sl.id', 'sl.is_booked', 'sl.staff_id'])
      .where('sl.id', '=', slotId)
      .where('st.business_id', '=', businessId)
      .executeTakeFirst();

    if (!slot) {
      throw new AppError(404, 'Slot not found', 'SLOT_NOT_FOUND');
    }

    if (slot.is_booked) {
      throw new AppError(400, 'Cannot delete a booked slot', 'SLOT_IS_BOOKED');
    }

    // Employees can only delete their own slots
    if (role === 'employee' && slot.staff_id !== staffId) {
      throw new AppError(403, 'Employees can only delete their own slots', 'FORBIDDEN');
    }

    await db.deleteFrom('slots').where('id', '=', slotId).execute();
  }

  // ─── Bookings ──────────────────────────────────────────────────────────────

  async getBusinessBookings(params: {
    userId: string;
    businessId: string;
    staffId?: string;
    date?: string;
    status?: BookingStatus;
    period?: 'today' | 'week' | 'month';
    limit?: number;
    offset?: number;
  }): Promise<BusinessBookingsListResult> {
    const { userId, businessId, staffId, date, status, period, limit, offset = 0 } = params;

    const { staffId: requestorStaffId, role } = await this.resolveStaff(userId, businessId);

    let query = db
      .selectFrom('bookings as b')
      .innerJoin('slots as sl', 'sl.id', 'b.slot_id')
      .innerJoin('services as sv', 'sv.id', 'b.service_id')
      .innerJoin('staff as st', 'st.id', 'b.staff_id')
      .leftJoin('users as u', 'u.id', 'b.user_id')
      .select([
        'b.id',
        'b.status',
        'b.source',
        sql<string>`sl.date::text`.as('slot_date'),
        'sl.start_time as slot_start_time',
        'sv.name as service_name',
        'sv.price as service_price',
        sql<string | null>`COALESCE(u.name, b.client_name)`.as('client_name'),
        sql<string | null>`COALESCE(u.phone, b.client_phone)`.as('client_phone'),
        'b.staff_id',
        'st.name as staff_name',
        sql<Date>`b.created_at`.as('created_at'),
        sql<Date | null>`b.cancelled_at`.as('cancelled_at'),
      ])
      .where('b.business_id', '=', businessId);

    let totalQuery = db
      .selectFrom('bookings as b')
      .innerJoin('slots as sl', 'sl.id', 'b.slot_id')
      .select(sql<number>`count(*)::int`.as('count'))
      .where('b.business_id', '=', businessId);

    // Employee sees only their own bookings
    if (role === 'employee') {
      query = query.where('b.staff_id', '=', requestorStaffId);
      totalQuery = totalQuery.where('b.staff_id', '=', requestorStaffId);
    } else if (staffId) {
      // Admin can filter by a specific staff member
      query = query.where('b.staff_id', '=', staffId);
      totalQuery = totalQuery.where('b.staff_id', '=', staffId);
    }

    if (date) {
      query = query.where(sql`sl.date::text`, '=', date);
      totalQuery = totalQuery.where(sql`sl.date::text`, '=', date);
    } else if (period) {
      const { start, end } = getBusinessBookingsPeriodBounds(period);
      query = query
        .where(sql`sl.date::text`, '>=', start)
        .where(sql`sl.date::text`, '<=', end);
      totalQuery = totalQuery
        .where(sql`sl.date::text`, '>=', start)
        .where(sql`sl.date::text`, '<=', end);
    }

    if (status) {
      query = query.where('b.status', '=', status);
      totalQuery = totalQuery.where('b.status', '=', status);
    }

    if (typeof limit === 'number') {
      query = query.limit(limit).offset(offset);
    }

    const [rows, totalRow] = await Promise.all([
      query
        .orderBy('sl.date', 'desc')
        .orderBy('sl.start_time', 'desc')
        .execute(),
      totalQuery.executeTakeFirst(),
    ]);

    const total = totalRow?.count ?? 0;
    const normalizedLimit = typeof limit === 'number' ? limit : null;

    const bookings = rows.map((r) => ({
      id: r.id,
      status: r.status as BookingStatus,
      source: r.source,
      slot_date: r.slot_date,
      slot_start_time: r.slot_start_time,
      service_name: r.service_name,
      service_price: r.service_price,
      client_name: r.client_name,
      client_phone: r.client_phone,
      staff_id: r.staff_id,
      staff_name: r.staff_name,
      created_at: r.created_at,
      cancelled_at: r.cancelled_at,
    }));

    return {
      bookings,
      total,
      limit: normalizedLimit,
      offset,
      has_more: normalizedLimit === null ? false : offset + bookings.length < total,
    };
  }

  async createWalkInBooking(params: {
    userId: string;
    businessId: string;
    staffId: string;
    serviceId: string;
    clientName?: string;
    clientPhone?: string;
    time?: string;
  }): Promise<BusinessBookingItem> {
    const { userId, businessId, staffId, serviceId, clientName, clientPhone, time } = params;

    const { staffId: requestorStaffId, role } = await this.resolveStaff(userId, businessId);

    // RBAC: employee can only create walk-in for themselves
    if (role === 'employee' && staffId !== requestorStaffId) {
      throw new AppError(403, 'Employees can only create walk-in bookings for themselves', 'FORBIDDEN');
    }

    // Validate target staff belongs to this business
    const targetStaff = await db
      .selectFrom('staff')
      .select(['id'])
      .where('id', '=', staffId)
      .where('business_id', '=', businessId)
      .where('is_active', '=', true)
      .executeTakeFirst();

    if (!targetStaff) {
      throw new AppError(404, 'Staff member not found in this business', 'STAFF_NOT_FOUND');
    }

    // Validate service belongs to this business
    const service = await db
      .selectFrom('services')
      .select(['id', 'duration_minutes'])
      .where('id', '=', serviceId)
      .where('business_id', '=', businessId)
      .where('is_active', '=', true)
      .executeTakeFirst();

    if (!service) {
      throw new AppError(404, 'Service not found in this business', 'SERVICE_NOT_FOUND');
    }

    // Determine booking time
    const now = new Date();
    const bookingDate = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const bookingTime = time ?? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`; // HH:MM

    // Try to find existing user by phone
    let linkedUserId: string | null = null;
    if (clientPhone) {
      const existingUser = await db
        .selectFrom('users')
        .select(['id'])
        .where('phone', '=', clientPhone)
        .executeTakeFirst();
      if (existingUser) {
        linkedUserId = existingUser.id;
      }
    }

    // Create slot + booking in a transaction
    const booking = await db.transaction().execute(async (trx) => {
      const slot = await trx
        .insertInto('slots')
        .values({
          staff_id: staffId,
          date: bookingDate,
          start_time: bookingTime,
          is_booked: true,
        })
        .returning(['id'])
        .executeTakeFirstOrThrow();

      const inserted = await trx
        .insertInto('bookings')
        .values({
          user_id: linkedUserId,
          slot_id: slot.id,
          service_id: serviceId,
          business_id: businessId,
          staff_id: staffId,
          status: 'completed',
          source: 'walk_in',
          cancelled_at: null,
          client_name: clientName ?? null,
          client_phone: clientPhone ?? null,
        })
        .returning(['id'])
        .executeTakeFirstOrThrow();

      return inserted;
    });

    trackEvent({
      event_type: 'walk_in_booking_created',
      payload: { business_id: businessId, staff_id: staffId, has_phone: !!clientPhone },
      user_id: userId,
    });

    const detail = await this.getBookingDetail(booking.id);
    if (!detail) {
      throw new AppError(500, 'Failed to fetch created walk-in booking', 'INTERNAL_ERROR');
    }
    return detail;
  }

  async updateBookingStatus(params: {
    userId: string;
    businessId: string;
    bookingId: string;
    status: BookingStatus;
  }): Promise<BusinessBookingItem> {
    const { userId, businessId, bookingId, status } = params;

    const { staffId: requestorStaffId, role } = await this.resolveStaff(userId, businessId);

    // Load booking
    const booking = await db
      .selectFrom('bookings as b')
      .innerJoin('slots as sl', 'sl.id', 'b.slot_id')
      .select([
        'b.id',
        'b.status',
        'b.staff_id',
        'b.slot_id',
        sql<string>`sl.date::text`.as('slot_date'),
        'sl.start_time',
      ])
      .where('b.id', '=', bookingId)
      .where('b.business_id', '=', businessId)
      .executeTakeFirst();

    if (!booking) {
      throw new AppError(404, 'Booking not found', 'BOOKING_NOT_FOUND');
    }

    // Employee can only manage their own bookings
    if (role === 'employee' && booking.staff_id !== requestorStaffId) {
      throw new AppError(403, 'Employees can only manage their own bookings', 'FORBIDDEN');
    }

    // Validate status transitions
    const currentStatus = booking.status as BookingStatus;
    const validTransitions: Record<BookingStatus, BookingStatus[]> = {
      confirmed: ['cancelled', 'completed', 'no_show'],
      cancelled: [],
      completed: [],
      no_show: [],
    };

    if (!validTransitions[currentStatus].includes(status)) {
      throw new AppError(
        400,
        `Cannot transition from ${currentStatus} to ${status}`,
        'INVALID_STATUS_TRANSITION',
      );
    }

    const isCancelling = status === 'cancelled';
    const cancelledAt = isCancelling ? new Date() : null;

    // If cancelling, free the slot
    if (isCancelling) {
      await db.transaction().execute(async (trx) => {
        await trx
          .updateTable('bookings')
          .set({ status, cancelled_at: cancelledAt })
          .where('id', '=', bookingId)
          .execute();

        await trx
          .updateTable('slots')
          .set({ is_booked: false })
          .where('id', '=', booking.slot_id)
          .execute();
      });
    } else {
      await db
        .updateTable('bookings')
        .set({ status })
        .where('id', '=', bookingId)
        .execute();
    }

    trackEvent({
      event_type: 'business_booking_status_changed',
      payload: { booking_id: bookingId, old_status: currentStatus, new_status: status },
      user_id: userId,
    });

    // Push notifications to client
    if (isCancelling) {
      // Push notification when business cancels
      void notificationService
        .notifyClientBookingCancelledByBusiness(bookingId)
        .catch(() => undefined);
    } else if (status === 'confirmed') {
      // Push notification when business confirms
      void notificationService.notifyClientBookingConfirmed(bookingId).catch(() => undefined);
    }

    // Fetch updated booking
    const updated = await this.getBookingDetail(bookingId);
    if (!updated) {
      throw new AppError(500, 'Failed to fetch updated booking', 'INTERNAL_ERROR');
    }
    return updated;
  }

  private async getBookingDetail(bookingId: string): Promise<BusinessBookingItem | undefined> {
    const row = await db
      .selectFrom('bookings as b')
      .innerJoin('slots as sl', 'sl.id', 'b.slot_id')
      .innerJoin('services as sv', 'sv.id', 'b.service_id')
      .innerJoin('staff as st', 'st.id', 'b.staff_id')
      .leftJoin('users as u', 'u.id', 'b.user_id')
      .select([
        'b.id',
        'b.status',
        'b.source',
        sql<string>`sl.date::text`.as('slot_date'),
        'sl.start_time as slot_start_time',
        'sv.name as service_name',
        'sv.price as service_price',
        sql<string | null>`COALESCE(u.name, b.client_name)`.as('client_name'),
        sql<string | null>`COALESCE(u.phone, b.client_phone)`.as('client_phone'),
        'b.staff_id',
        'st.name as staff_name',
        sql<Date>`b.created_at`.as('created_at'),
        sql<Date | null>`b.cancelled_at`.as('cancelled_at'),
      ])
      .where('b.id', '=', bookingId)
      .executeTakeFirst();

    if (!row) return undefined;

    return {
      id: row.id,
      status: row.status as BookingStatus,
      source: row.source,
      slot_date: row.slot_date,
      slot_start_time: row.slot_start_time,
      service_name: row.service_name,
      service_price: row.service_price,
      client_name: row.client_name,
      client_phone: row.client_phone,
      staff_id: row.staff_id,
      staff_name: row.staff_name,
      created_at: row.created_at,
      cancelled_at: row.cancelled_at,
    };
  }
}

export const businessBookingService = new BusinessBookingService();
