import { sql } from 'kysely';
import { db } from '../db';
import { AppError } from '../middleware/error';
import { trackEvent } from '../utils/track-event';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AnalyticsPeriod = 'day' | 'week' | 'month';

export interface AnalyticsDashboardResult {
  period: AnalyticsPeriod;
  date_from: string;
  date_to: string;
  occupancy: {
    percent: number;
    busy_minutes: number;
    total_minutes: number;
  };
  bookings: {
    count: number;
    sum_planned: number;
    by_source: {
      app: number;
      walk_in: number;
      link: number;
    };
  };
  clients: {
    visited: number;
    new: number;
    total: number;
    segments: {
      regulars: number;
      sleeping: number;
      lost: number;
      not_visited: number;
    };
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeDateRange(
  period: AnalyticsPeriod,
  dateStr: string,
): { from: string; to: string } {
  const parts = dateStr.split('-').map(Number) as [number, number, number];
  const [year, month, day] = parts;

  if (period === 'day') {
    return { from: dateStr, to: dateStr };
  }

  if (period === 'week') {
    // ISO week: Monday to Sunday
    const d = new Date(year, month - 1, day);
    const dow = d.getDay(); // 0=Sun
    const daysFromMon = dow === 0 ? 6 : dow - 1;
    const mon = new Date(year, month - 1, day - daysFromMon);
    const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
    return {
      from: mon.toISOString().slice(0, 10),
      to: sun.toISOString().slice(0, 10),
    };
  }

  // month
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${String(month).padStart(2, '0')}-01`,
    to: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

function parseBigInt(val: unknown): number {
  if (val === null || val === undefined) return 0;
  return Number(val);
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class AnalyticsDashboardService {
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

  async getDashboard(params: {
    userId: string;
    businessId: string;
    period: AnalyticsPeriod;
    date: string;
  }): Promise<AnalyticsDashboardResult> {
    const { userId, businessId, period, date } = params;

    const { staffId: requestorStaffId, role } = await this.resolveStaff(userId, businessId);

    // Employee always sees only their own data
    const effectiveStaffId: string | undefined =
      role === 'employee' ? requestorStaffId : undefined;

    const { from, to } = computeDateRange(period, date);

    // ── Occupancy ─────────────────────────────────────────────────────────────
    // total_slots: all slots in period for this business
    // busy_slots: slots linked to confirmed/completed bookings

    type SlotCountRow = { cnt: string };

    let totalSlotsQuery = db
      .selectFrom('slots as s')
      .innerJoin('staff as st', 'st.id', 's.staff_id')
      .select(sql<string>`cast(count(*) as text)`.as('cnt'))
      .where('st.business_id', '=', businessId)
      .where(sql<boolean>`s.date >= ${from}::date`)
      .where(sql<boolean>`s.date <= ${to}::date`);

    if (effectiveStaffId) {
      totalSlotsQuery = totalSlotsQuery.where('s.staff_id', '=', effectiveStaffId);
    }

    let busySlotsQuery = db
      .selectFrom('slots as s')
      .innerJoin('bookings as b', 'b.slot_id', 's.id')
      .innerJoin('staff as st', 'st.id', 's.staff_id')
      .select(sql<string>`cast(count(*) as text)`.as('cnt'))
      .where('st.business_id', '=', businessId)
      .where('b.status', 'in', ['confirmed', 'completed'])
      .where(sql<boolean>`s.date >= ${from}::date`)
      .where(sql<boolean>`s.date <= ${to}::date`);

    if (effectiveStaffId) {
      busySlotsQuery = busySlotsQuery.where('s.staff_id', '=', effectiveStaffId);
    }

    const [totalSlotsRow, busySlotsRow] = await Promise.all([
      totalSlotsQuery.executeTakeFirst() as Promise<SlotCountRow | undefined>,
      busySlotsQuery.executeTakeFirst() as Promise<SlotCountRow | undefined>,
    ]);

    const totalSlots = parseBigInt(totalSlotsRow?.cnt);
    const busySlots = parseBigInt(busySlotsRow?.cnt);
    const totalMinutes = totalSlots * 60;
    const busyMinutes = busySlots * 60;
    const occupancyPct = totalMinutes > 0 ? Math.round((busyMinutes / totalMinutes) * 100) : 0;

    // ── Bookings in period ────────────────────────────────────────────────────
    // Filter by slot.date (when appointment takes place), status IN ('confirmed', 'completed')

    type BookingAggRow = {
      source: string;
      cnt: string;
      sum_price: string;
    };

    let bookingAggQuery = db
      .selectFrom('bookings as b')
      .innerJoin('slots as s', 's.id', 'b.slot_id')
      .innerJoin('services as svc', 'svc.id', 'b.service_id')
      .select([
        'b.source',
        sql<string>`cast(count(*) as text)`.as('cnt'),
        sql<string>`cast(coalesce(sum(svc.price), 0) as text)`.as('sum_price'),
      ])
      .where('b.business_id', '=', businessId)
      .where('b.status', 'in', ['confirmed', 'completed'])
      .where(sql<boolean>`s.date >= ${from}::date`)
      .where(sql<boolean>`s.date <= ${to}::date`);

    if (effectiveStaffId) {
      bookingAggQuery = bookingAggQuery.where('b.staff_id', '=', effectiveStaffId);
    }

    const bookingRows = (await bookingAggQuery
      .groupBy('b.source')
      .execute()) as BookingAggRow[];

    let bookingsCount = 0;
    let sumPlanned = 0;
    let appCount = 0;
    let walkInCount = 0;
    let linkCount = 0;

    for (const row of bookingRows) {
      const cnt = parseBigInt(row.cnt);
      const price = parseBigInt(row.sum_price);
      bookingsCount += cnt;
      sumPlanned += price;
      if (row.source === 'app') appCount += cnt;
      else if (row.source === 'walk_in') walkInCount += cnt;
      else if (row.source === 'link') linkCount += cnt;
    }

    // ── Clients ───────────────────────────────────────────────────────────────
    // client key: COALESCE(b.user_id::text, b.client_phone)

    type ClientCountRow = { cnt: string };

    // visited: distinct clients with completed booking in period
    let visitedQuery = db
      .selectFrom('bookings as b')
      .innerJoin('slots as s', 's.id', 'b.slot_id')
      .select(
        sql<string>`cast(count(distinct coalesce(b.user_id::text, b.client_phone)) as text)`.as(
          'cnt',
        ),
      )
      .where('b.business_id', '=', businessId)
      .where('b.status', '=', 'completed')
      .where(sql<boolean>`coalesce(b.user_id::text, b.client_phone) is not null`)
      .where(sql<boolean>`s.date >= ${from}::date`)
      .where(sql<boolean>`s.date <= ${to}::date`);

    if (effectiveStaffId) {
      visitedQuery = visitedQuery.where('b.staff_id', '=', effectiveStaffId);
    }

    // new: clients whose first completed booking (ever, in this business) falls in the period
    const newClientsSubquery = db
      .selectFrom('bookings as b2')
      .innerJoin('slots as s2', 's2.id', 'b2.slot_id')
      .select([
        sql<string>`coalesce(b2.user_id::text, b2.client_phone)`.as('client_key'),
        sql<string>`min(s2.date)`.as('first_completed_date'),
      ])
      .where('b2.business_id', '=', businessId)
      .where('b2.status', '=', 'completed')
      .where(sql<boolean>`coalesce(b2.user_id::text, b2.client_phone) is not null`)
      .$if(effectiveStaffId !== undefined, (qb) =>
        qb.where('b2.staff_id', '=', effectiveStaffId as string),
      )
      .groupBy(sql`coalesce(b2.user_id::text, b2.client_phone)`);

    const newClientsQuery = db
      .selectFrom(newClientsSubquery.as('sub'))
      .select(sql<string>`cast(count(*) as text)`.as('cnt'))
      .where(sql<boolean>`sub.first_completed_date >= ${from}::date`)
      .where(sql<boolean>`sub.first_completed_date <= ${to}::date`);

    // total: distinct clients ever for this business
    let totalClientsQuery = db
      .selectFrom('bookings as b')
      .select(
        sql<string>`cast(count(distinct coalesce(b.user_id::text, b.client_phone)) as text)`.as(
          'cnt',
        ),
      )
      .where('b.business_id', '=', businessId)
      .where(sql<boolean>`coalesce(b.user_id::text, b.client_phone) is not null`);

    if (effectiveStaffId) {
      totalClientsQuery = totalClientsQuery.where('b.staff_id', '=', effectiveStaffId);
    }

    const [visitedRow, newRow, totalRow] = await Promise.all([
      visitedQuery.executeTakeFirst() as Promise<ClientCountRow | undefined>,
      newClientsQuery.executeTakeFirst() as Promise<ClientCountRow | undefined>,
      totalClientsQuery.executeTakeFirst() as Promise<ClientCountRow | undefined>,
    ]);

    const visitedCount = parseBigInt(visitedRow?.cnt);
    const newCount = parseBigInt(newRow?.cnt);
    const totalCount = parseBigInt(totalRow?.cnt);

    // ── Client segments (relative to today, business-wide or staff-filtered) ─

    type SegmentRow = {
      regulars: string;
      sleeping: string;
      lost: string;
      not_visited: string;
    };

    const segmentsResult = (await sql<SegmentRow>`
      WITH client_stats AS (
        SELECT
          COALESCE(b.user_id::text, b.client_phone) AS client_key,
          COUNT(*) FILTER (
            WHERE b.status = 'completed'
            AND b.created_at >= NOW() - INTERVAL '90 days'
          ) AS completed_last_90,
          MAX(CASE WHEN b.status = 'completed' THEN b.created_at END) AS last_completed,
          COUNT(*) FILTER (WHERE b.status = 'completed') AS total_completed
        FROM bookings b
        WHERE b.business_id = ${businessId}
          AND COALESCE(b.user_id::text, b.client_phone) IS NOT NULL
          ${effectiveStaffId ? sql`AND b.staff_id = ${effectiveStaffId}` : sql``}
        GROUP BY COALESCE(b.user_id::text, b.client_phone)
      )
      SELECT
        CAST(SUM(CASE WHEN completed_last_90 >= 2 THEN 1 ELSE 0 END) AS TEXT) AS regulars,
        CAST(SUM(CASE
          WHEN completed_last_90 < 2
            AND last_completed IS NOT NULL
            AND last_completed >= NOW() - INTERVAL '180 days'
            AND last_completed < NOW() - INTERVAL '30 days'
          THEN 1 ELSE 0 END) AS TEXT) AS sleeping,
        CAST(SUM(CASE
          WHEN total_completed > 0
            AND (last_completed IS NULL OR last_completed < NOW() - INTERVAL '180 days')
          THEN 1 ELSE 0 END) AS TEXT) AS lost,
        CAST(SUM(CASE WHEN total_completed = 0 THEN 1 ELSE 0 END) AS TEXT) AS not_visited
      FROM client_stats
    `.execute(db)) as { rows: SegmentRow[] };

    const seg = segmentsResult.rows[0];
    const segments = {
      regulars: parseBigInt(seg?.regulars),
      sleeping: parseBigInt(seg?.sleeping),
      lost: parseBigInt(seg?.lost),
      not_visited: parseBigInt(seg?.not_visited),
    };

    // ── Event tracking ────────────────────────────────────────────────────────

    trackEvent({
      event_type: 'analytics_dashboard_opened',
      payload: { period, role },
      user_id: userId,
    });

    return {
      period,
      date_from: from,
      date_to: to,
      occupancy: {
        percent: occupancyPct,
        busy_minutes: busyMinutes,
        total_minutes: totalMinutes,
      },
      bookings: {
        count: bookingsCount,
        sum_planned: sumPlanned,
        by_source: {
          app: appCount,
          walk_in: walkInCount,
          link: linkCount,
        },
      },
      clients: {
        visited: visitedCount,
        new: newCount,
        total: totalCount,
        segments,
      },
    };
  }
}

export const analyticsDashboardService = new AnalyticsDashboardService();
