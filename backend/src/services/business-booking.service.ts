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
  date: string;
  start_time: string;
  is_booked: boolean;
}

export interface BusinessBookingItem {
  id: string;
  status: BookingStatus;
  slot_date: string;
  slot_start_time: string;
  service_name: string;
  service_price: number;
  client_name: string;
  client_phone: string;
  staff_id: string;
  staff_name: string;
  created_at: Date;
  cancelled_at: Date | null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

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

    // Validate the requesting user belongs to this business (any role can create slots)
    await this.resolveStaff(userId, businessId);

    // Validate the target staff belongs to this business
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

    if (times.length === 0) {
      throw new AppError(400, 'times array must not be empty', 'VALIDATION_ERROR');
    }

    // Insert all slots (ignore duplicates via unique constraint if any)
    const rows = await db
      .insertInto('slots')
      .values(
        times.map((t) => ({
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
      date: r.date,
      start_time: r.start_time,
      is_booked: r.is_booked,
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
  }): Promise<BusinessBookingItem[]> {
    const { userId, businessId, staffId, date } = params;

    const { staffId: requestorStaffId, role } = await this.resolveStaff(userId, businessId);

    let query = db
      .selectFrom('bookings as b')
      .innerJoin('slots as sl', 'sl.id', 'b.slot_id')
      .innerJoin('services as sv', 'sv.id', 'b.service_id')
      .innerJoin('staff as st', 'st.id', 'b.staff_id')
      .innerJoin('users as u', 'u.id', 'b.user_id')
      .select([
        'b.id',
        'b.status',
        sql<string>`sl.date::text`.as('slot_date'),
        'sl.start_time as slot_start_time',
        'sv.name as service_name',
        'sv.price as service_price',
        'u.name as client_name',
        'u.phone as client_phone',
        'b.staff_id',
        'st.name as staff_name',
        sql<Date>`b.created_at`.as('created_at'),
        sql<Date | null>`b.cancelled_at`.as('cancelled_at'),
      ])
      .where('b.business_id', '=', businessId);

    // Employee sees only their own bookings
    if (role === 'employee') {
      query = query.where('b.staff_id', '=', requestorStaffId);
    } else if (staffId) {
      // Admin can filter by a specific staff member
      query = query.where('b.staff_id', '=', staffId);
    }

    if (date) {
      query = query.where(sql`sl.date::text`, '=', date);
    }

    const rows = await query
      .orderBy('sl.date', 'asc')
      .orderBy('sl.start_time', 'asc')
      .execute();

    return rows.map((r) => ({
      id: r.id,
      status: r.status as BookingStatus,
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
      .innerJoin('users as u', 'u.id', 'b.user_id')
      .select([
        'b.id',
        'b.status',
        sql<string>`sl.date::text`.as('slot_date'),
        'sl.start_time as slot_start_time',
        'sv.name as service_name',
        'sv.price as service_price',
        'u.name as client_name',
        'u.phone as client_phone',
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
