import { sql } from 'kysely';
import { db } from '../db';
import { AppError } from '../middleware/error';
import { trackEvent } from '../utils/track-event';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StatsPeriod = 'day' | 'week' | 'month';

export interface StaffStatItem {
  staff_id: string;
  staff_name: string;
  bookings_count: number;
  show_rate_pct: number;
}

export interface BusinessStatsResult {
  period: StatsPeriod;
  bookings_count: number;
  avg_rating: number | null;
  show_rate_pct: number;
  by_staff: StaffStatItem[];
  by_source: {
    app: number;
    walk_in: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function periodToInterval(period: StatsPeriod): string {
  switch (period) {
    case 'day':
      return '1 day';
    case 'week':
      return '7 days';
    case 'month':
      return '30 days';
  }
}

function calcShowRate(completed: number, no_show: number): number {
  const total = completed + no_show;
  if (total === 0) return 0;
  return Math.round((completed / total) * 100 * 10) / 10;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class BusinessStatsService {
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

  async getStats(params: {
    userId: string;
    businessId: string;
    period: StatsPeriod;
    staffId?: string;
  }): Promise<BusinessStatsResult> {
    const { userId, businessId, period, staffId } = params;

    const { staffId: requestorStaffId, role } = await this.resolveStaff(userId, businessId);

    // Determine effective staff filter
    // - employee: always forced to their own staff_id
    // - admin: optional filter by staffId param
    const effectiveStaffId: string | undefined =
      role === 'employee' ? requestorStaffId : staffId;

    const interval = periodToInterval(period);

    // ── Aggregate booking counts by status and source ──────────────────────

    type BookingAgg = {
      status: string;
      source: string;
      cnt: string;
    };

    let aggQuery = db
      .selectFrom('bookings as b')
      .select([
        'b.status',
        'b.source',
        sql<string>`cast(count(*) as text)`.as('cnt'),
      ])
      .where('b.business_id', '=', businessId)
      .where(sql<boolean>`b.created_at >= now() - cast(${interval} as interval)`);

    if (effectiveStaffId) {
      aggQuery = aggQuery.where('b.staff_id', '=', effectiveStaffId);
    }

    const aggRows = (await aggQuery
      .groupBy(['b.status', 'b.source'])
      .execute()) as BookingAgg[];

    // Tally counters
    let totalBookings = 0;
    let completedCount = 0;
    let noShowCount = 0;
    let appCount = 0;
    let walkInCount = 0;

    for (const row of aggRows) {
      const cnt = parseInt(row.cnt, 10);
      totalBookings += cnt;
      if (row.status === 'completed') completedCount += cnt;
      if (row.status === 'no_show') noShowCount += cnt;
      if (row.source === 'app') appCount += cnt;
      if (row.source === 'walk_in') walkInCount += cnt;
    }

    // ── Average rating ─────────────────────────────────────────────────────

    type RatingRow = { avg_rating: string | null };
    let ratingQuery = db
      .selectFrom('reviews as r')
      .select([sql<string | null>`cast(avg(r.rating) as text)`.as('avg_rating')])
      .where('r.business_id', '=', businessId)
      .where(sql<boolean>`r.created_at >= now() - cast(${interval} as interval)`);

    if (effectiveStaffId) {
      // filter reviews by bookings that belong to this staff
      ratingQuery = ratingQuery.where((eb) =>
        eb.exists(
          eb
            .selectFrom('bookings as b2')
            .select('b2.id')
            .where('b2.id', '=', eb.ref('r.booking_id'))
            .where('b2.staff_id', '=', effectiveStaffId),
        ),
      );
    }

    const ratingRow = (await ratingQuery.executeTakeFirst()) as RatingRow | undefined;
    const avgRating = ratingRow?.avg_rating ? Math.round(parseFloat(ratingRow.avg_rating) * 10) / 10 : null;

    // ── By staff breakdown (admin only, not filtered to one staff) ─────────

    const byStaff: StaffStatItem[] = [];

    if (role === 'admin' && !effectiveStaffId) {
      type StaffAggRow = {
        staff_id: string;
        staff_name: string;
        status: string;
        cnt: string;
      };

      const staffAgg = (await db
        .selectFrom('bookings as b')
        .innerJoin('staff as st', 'st.id', 'b.staff_id')
        .select([
          'b.staff_id',
          'st.name as staff_name',
          'b.status',
          sql<string>`cast(count(*) as text)`.as('cnt'),
        ])
        .where('b.business_id', '=', businessId)
        .where(sql<boolean>`b.created_at >= now() - cast(${interval} as interval)`)
        .groupBy(['b.staff_id', 'st.name', 'b.status'])
        .execute()) as StaffAggRow[];

      // Group by staff_id
      const staffMap = new Map<
        string,
        { name: string; completed: number; no_show: number; total: number }
      >();

      for (const row of staffAgg) {
        const cnt = parseInt(row.cnt, 10);
        if (!staffMap.has(row.staff_id)) {
          staffMap.set(row.staff_id, { name: row.staff_name, completed: 0, no_show: 0, total: 0 });
        }
        const entry = staffMap.get(row.staff_id)!;
        entry.total += cnt;
        if (row.status === 'completed') entry.completed += cnt;
        if (row.status === 'no_show') entry.no_show += cnt;
      }

      for (const [sid, data] of staffMap) {
        byStaff.push({
          staff_id: sid,
          staff_name: data.name,
          bookings_count: data.total,
          show_rate_pct: calcShowRate(data.completed, data.no_show),
        });
      }
    }

    trackEvent({
      event_type: 'business_stats_viewed',
      payload: { business_id: businessId, period, staff_id: effectiveStaffId ?? null },
      user_id: userId,
    });

    return {
      period,
      bookings_count: totalBookings,
      avg_rating: avgRating,
      show_rate_pct: calcShowRate(completedCount, noShowCount),
      by_staff: byStaff,
      by_source: {
        app: appCount,
        walk_in: walkInCount,
      },
    };
  }
}

export const businessStatsService = new BusinessStatsService();
