import { sql } from 'kysely';
import { db } from '../db';
import { AppError } from '../middleware/error';
import { trackEvent } from '../utils/track-event';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ClientSegment = 'regulars' | 'sleeping' | 'lost' | 'not_visited' | 'new';

export interface ClientSegmentCounts {
  regulars: number;
  sleeping: number;
  lost: number;
  not_visited: number;
  new: number;
  total: number;
}

export interface ClientListItem {
  id: string;
  name: string | null;
  phone: string | null;
  segment: ClientSegment;
  total_visits: number;
  total_revenue: number;
  first_visit_at: string | null;
  last_visit_at: string | null;
}

export interface ClientListResult {
  clients: ClientListItem[];
  next_cursor: string | null;
}

export interface BookingHistoryItem {
  id: string;
  slot_date: string;
  slot_time: string;
  service_name: string;
  service_price: number;
  staff_name: string;
  status: string;
  source: string;
  created_at: string;
}

export interface ClientCard {
  id: string;
  name: string | null;
  phone: string | null;
  segment: ClientSegment;
  total_visits: number;
  total_revenue: number;
  first_visit_at: string | null;
  last_visit_at: string | null;
  bookings: BookingHistoryItem[];
  next_cursor: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseBigInt(val: unknown): number {
  if (val === null || val === undefined) return 0;
  return Number(val);
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ClientsService {
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

  // ── GET /business/clients/segments ────────────────────────────────────────

  async getSegments(params: {
    userId: string;
    businessId: string;
  }): Promise<ClientSegmentCounts> {
    const { userId, businessId } = params;
    const { staffId, role } = await this.resolveStaff(userId, businessId);
    const effectiveStaffId: string | null = role === 'employee' ? staffId : null;

    const staffFilter = effectiveStaffId
      ? sql`AND b.staff_id = ${effectiveStaffId}`
      : sql``;

    type SegmentCountRow = {
      regulars: string;
      sleeping: string;
      lost: string;
      not_visited: string;
      new_clients: string;
      total: string;
    };

    const result = await sql<SegmentCountRow>`
      WITH client_stats AS (
        SELECT
          COALESCE(b.user_id::text, b.client_phone) AS client_key,
          COUNT(*) FILTER (
            WHERE b.status = 'completed'
            AND b.created_at >= NOW() - INTERVAL '90 days'
          ) AS completed_last_90,
          MAX(CASE WHEN b.status = 'completed' THEN b.created_at END) AS last_completed,
          MIN(CASE WHEN b.status = 'completed' THEN b.created_at END) AS first_completed,
          COUNT(*) FILTER (WHERE b.status = 'completed') AS total_completed
        FROM bookings b
        WHERE b.business_id = ${businessId}
          AND COALESCE(b.user_id::text, b.client_phone) IS NOT NULL
          ${staffFilter}
        GROUP BY COALESCE(b.user_id::text, b.client_phone)
      )
      SELECT
        CAST(COUNT(*) FILTER (WHERE completed_last_90 >= 2) AS TEXT) AS regulars,
        CAST(COUNT(*) FILTER (
          WHERE total_completed > 0
            AND first_completed >= NOW() - INTERVAL '30 days'
            AND completed_last_90 < 2
        ) AS TEXT) AS new_clients,
        CAST(COUNT(*) FILTER (
          WHERE completed_last_90 < 2
            AND (first_completed IS NULL OR first_completed < NOW() - INTERVAL '30 days')
            AND last_completed IS NOT NULL
            AND last_completed >= NOW() - INTERVAL '180 days'
            AND last_completed < NOW() - INTERVAL '30 days'
        ) AS TEXT) AS sleeping,
        CAST(COUNT(*) FILTER (
          WHERE total_completed > 0
            AND completed_last_90 < 2
            AND (first_completed IS NULL OR first_completed < NOW() - INTERVAL '30 days')
            AND (last_completed IS NULL OR last_completed < NOW() - INTERVAL '180 days')
        ) AS TEXT) AS lost,
        CAST(COUNT(*) FILTER (WHERE total_completed = 0) AS TEXT) AS not_visited,
        CAST(COUNT(*) AS TEXT) AS total
      FROM client_stats
    `.execute(db);

    const row = result.rows[0];

    trackEvent({
      event_type: 'clients_screen_opened',
      user_id: userId,
    });

    return {
      regulars: parseBigInt(row?.regulars),
      sleeping: parseBigInt(row?.sleeping),
      lost: parseBigInt(row?.lost),
      not_visited: parseBigInt(row?.not_visited),
      new: parseBigInt(row?.new_clients),
      total: parseBigInt(row?.total),
    };
  }

  // ── GET /business/clients ─────────────────────────────────────────────────

  async getClients(params: {
    userId: string;
    businessId: string;
    segment?: ClientSegment;
    search?: string;
    limit: number;
    cursor?: string;
    isAdmin: boolean;
  }): Promise<ClientListResult> {
    const { userId, businessId, segment, search, limit, cursor, isAdmin } = params;
    const { staffId, role } = await this.resolveStaff(userId, businessId);
    const effectiveStaffId: string | null = role === 'employee' ? staffId : null;

    const staffFilter = effectiveStaffId
      ? sql`AND b.staff_id = ${effectiveStaffId}`
      : sql``;

    const segmentFilter = segment ? sql`AND segment = ${segment}` : sql``;

    const searchFilter = search
      ? sql`AND (COALESCE(u.name, ca.walkin_name) ILIKE ${'%' + search + '%'} OR ca.phone LIKE ${'%' + search + '%'})`
      : sql``;

    // Cursor: base64-encoded JSON { last_visit_at: string | null, id: string }
    let cursorFilter = sql``;
    if (cursor) {
      let decoded: { last_visit_at: string | null; id: string };
      try {
        decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
          last_visit_at: string | null;
          id: string;
        };
      } catch {
        throw new AppError(400, 'Invalid cursor', 'INVALID_CURSOR');
      }
      if (decoded.last_visit_at) {
        cursorFilter = sql`AND (
          ca.last_visit_at < ${decoded.last_visit_at}::date
          OR (ca.last_visit_at = ${decoded.last_visit_at}::date AND ca.client_id > ${decoded.id})
        )`;
      } else {
        cursorFilter = sql`AND ca.last_visit_at IS NULL AND ca.client_id > ${decoded.id}`;
      }
    }

    type ClientRow = {
      client_id: string;
      name: string | null;
      phone: string | null;
      segment: string;
      total_visits: string;
      total_revenue: string;
      first_visit_at: string | null;
      last_visit_at: string | null;
    };

    const fetchLimit = limit + 1;

    const result = await sql<ClientRow>`
      WITH raw_grouped AS (
        SELECT
          CASE
            WHEN b.user_id IS NOT NULL THEN 'user:' || b.user_id
            WHEN b.client_phone IS NOT NULL THEN '__phone__' || b.client_phone
            ELSE 'walkin:' || b.id
          END AS grp,
          b.user_id,
          b.client_phone AS phone,
          b.client_name AS walkin_name,
          b.status,
          svc.price AS service_price,
          b.created_at AS booking_created_at,
          s.date AS slot_date,
          b.id AS booking_id
        FROM bookings b
        INNER JOIN slots s ON s.id = b.slot_id
        INNER JOIN services svc ON svc.id = b.service_id
        WHERE b.business_id = ${businessId}
        ${staffFilter}
      ),
      client_agg AS (
        SELECT
          grp,
          MIN(booking_id) AS first_booking_id,
          MAX(user_id) AS user_id,
          MAX(phone) AS phone,
          MAX(walkin_name) AS walkin_name,
          COUNT(*) FILTER (WHERE status = 'completed') AS total_completed,
          COUNT(*) FILTER (
            WHERE status = 'completed'
            AND booking_created_at >= NOW() - INTERVAL '90 days'
          ) AS completed_last_90,
          MAX(CASE WHEN status = 'completed' THEN booking_created_at END) AS last_completed,
          MIN(CASE WHEN status = 'completed' THEN booking_created_at END) AS first_completed,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN service_price ELSE 0 END), 0) AS total_revenue,
          MAX(slot_date) AS last_visit_at,
          MIN(slot_date) AS first_visit_at
        FROM raw_grouped
        GROUP BY grp
      ),
      ca AS (
        SELECT
          CASE
            WHEN grp LIKE 'user:%' THEN grp
            ELSE 'walkin:' || first_booking_id
          END AS client_id,
          user_id,
          phone,
          walkin_name,
          CAST(total_completed AS TEXT) AS total_visits,
          CAST(total_revenue AS TEXT) AS total_revenue,
          last_visit_at,
          first_visit_at,
          CASE
            WHEN total_completed >= 2 AND completed_last_90 >= 2 THEN 'regulars'
            WHEN total_completed > 0 AND first_completed >= NOW() - INTERVAL '30 days' THEN 'new'
            WHEN last_completed IS NOT NULL
              AND last_completed >= NOW() - INTERVAL '180 days'
              AND last_completed < NOW() - INTERVAL '30 days' THEN 'sleeping'
            WHEN total_completed > 0
              AND (last_completed IS NULL OR last_completed < NOW() - INTERVAL '180 days') THEN 'lost'
            ELSE 'not_visited'
          END AS segment
        FROM client_agg
      )
      SELECT
        ca.client_id,
        COALESCE(u.name, ca.walkin_name) AS name,
        CASE WHEN ${isAdmin ? sql`TRUE` : sql`FALSE`} THEN ca.phone ELSE NULL END AS phone,
        ca.segment,
        ca.total_visits,
        ca.total_revenue,
        ca.first_visit_at::text AS first_visit_at,
        ca.last_visit_at::text AS last_visit_at
      FROM ca
      LEFT JOIN users u ON u.id = ca.user_id
      WHERE TRUE
      ${segmentFilter}
      ${searchFilter}
      ${cursorFilter}
      ORDER BY ca.last_visit_at DESC NULLS LAST, ca.client_id ASC
      LIMIT ${fetchLimit}
    `.execute(db);

    const rows = result.rows;
    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();

    let nextCursor: string | null = null;
    if (hasMore && rows.length > 0) {
      const last = rows[rows.length - 1]!;
      nextCursor = Buffer.from(
        JSON.stringify({ last_visit_at: last.last_visit_at, id: last.client_id }),
      ).toString('base64url');
    }

    if (segment) {
      trackEvent({
        event_type: 'client_segment_filtered',
        payload: { segment },
        user_id: userId,
      });
    }

    return {
      clients: rows.map((r) => ({
        id: r.client_id,
        name: r.name,
        phone: r.phone,
        segment: r.segment as ClientSegment,
        total_visits: parseBigInt(r.total_visits),
        total_revenue: parseBigInt(r.total_revenue),
        first_visit_at: r.first_visit_at,
        last_visit_at: r.last_visit_at,
      })),
      next_cursor: nextCursor,
    };
  }

  // ── GET /business/clients/:clientId ───────────────────────────────────────

  async getClientCard(params: {
    userId: string;
    businessId: string;
    clientId: string;
    isAdmin: boolean;
    bookingCursor?: string;
  }): Promise<ClientCard> {
    const { userId, businessId, clientId, isAdmin, bookingCursor } = params;
    const { staffId, role } = await this.resolveStaff(userId, businessId);
    const effectiveStaffId: string | null = role === 'employee' ? staffId : null;

    // ── Parse clientId ───────────────────────────────────────────────────────

    let clientUserId: string | null = null;
    let walkinBookingId: string | null = null;

    if (clientId.startsWith('user:')) {
      clientUserId = clientId.slice(5);
    } else if (clientId.startsWith('walkin:')) {
      walkinBookingId = clientId.slice(7);
    } else {
      throw new AppError(400, 'Invalid clientId format. Use user:{uuid} or walkin:{id}', 'INVALID_CLIENT_ID');
    }

    // ── Resolve walk-in phone for grouping ───────────────────────────────────

    let walkinPhone: string | null = null;
    if (walkinBookingId) {
      const anchor = await db
        .selectFrom('bookings')
        .select(['client_phone', 'business_id'])
        .where('id', '=', walkinBookingId)
        .where('business_id', '=', businessId)
        .executeTakeFirst();

      if (!anchor) {
        throw new AppError(404, 'Client not found', 'NOT_FOUND');
      }
      walkinPhone = anchor.client_phone;
    }

    // ── RBAC check for employee ──────────────────────────────────────────────

    if (effectiveStaffId) {
      let rbacQuery = db
        .selectFrom('bookings')
        .select('id')
        .where('business_id', '=', businessId)
        .where('staff_id', '=', effectiveStaffId);

      if (clientUserId) {
        rbacQuery = rbacQuery.where('user_id', '=', clientUserId);
      } else if (walkinPhone) {
        rbacQuery = rbacQuery.where((eb) =>
          eb.or([
            eb('id', '=', walkinBookingId!),
            eb('client_phone', '=', walkinPhone!),
          ]),
        );
      } else {
        rbacQuery = rbacQuery.where('id', '=', walkinBookingId!);
      }

      const access = await rbacQuery.executeTakeFirst();
      if (!access) {
        throw new AppError(403, 'Insufficient permissions', 'FORBIDDEN');
      }
    }

    // ── Build booking filter condition ────────────────────────────────────────
    // We compute stats and list all bookings for this client

    // Cursor for booking pagination: base64-encoded { created_at: string, id: string }
    let bookingCursorFilter = sql``;
    if (bookingCursor) {
      let decoded: { created_at: string; id: string };
      try {
        decoded = JSON.parse(
          Buffer.from(bookingCursor, 'base64url').toString('utf8'),
        ) as { created_at: string; id: string };
      } catch {
        throw new AppError(400, 'Invalid booking cursor', 'INVALID_CURSOR');
      }
      bookingCursorFilter = sql`AND (b.created_at < ${decoded.created_at}::timestamptz OR (b.created_at = ${decoded.created_at}::timestamptz AND b.id < ${decoded.id}))`;
    }

    // Build the client scope filter (for all queries below)
    const clientScopeFilter = clientUserId
      ? sql`AND b.user_id = ${clientUserId}`
      : walkinPhone
        ? sql`AND b.user_id IS NULL AND (b.id = ${walkinBookingId} OR b.client_phone = ${walkinPhone})`
        : sql`AND b.id = ${walkinBookingId}`;

    const staffFilter = effectiveStaffId ? sql`AND b.staff_id = ${effectiveStaffId}` : sql``;

    // ── Aggregate stats ───────────────────────────────────────────────────────

    type StatsRow = {
      total_visits: string;
      total_revenue: string;
      first_visit_at: string | null;
      last_visit_at: string | null;
      completed_last_90: string;
      total_completed: string;
      last_completed: string | null;
      first_completed: string | null;
      walkin_name: string | null;
      phone: string | null;
    };

    const statsResult = await sql<StatsRow>`
      SELECT
        CAST(COUNT(*) FILTER (WHERE b.status = 'completed') AS TEXT) AS total_visits,
        CAST(COALESCE(SUM(svc.price) FILTER (WHERE b.status = 'completed'), 0) AS TEXT) AS total_revenue,
        MIN(s.date)::text AS first_visit_at,
        MAX(s.date)::text AS last_visit_at,
        CAST(COUNT(*) FILTER (
          WHERE b.status = 'completed' AND b.created_at >= NOW() - INTERVAL '90 days'
        ) AS TEXT) AS completed_last_90,
        CAST(COUNT(*) FILTER (WHERE b.status = 'completed') AS TEXT) AS total_completed,
        MAX(CASE WHEN b.status = 'completed' THEN b.created_at END)::text AS last_completed,
        MIN(CASE WHEN b.status = 'completed' THEN b.created_at END)::text AS first_completed,
        MAX(b.client_name) AS walkin_name,
        MAX(b.client_phone) AS phone
      FROM bookings b
      INNER JOIN slots s ON s.id = b.slot_id
      INNER JOIN services svc ON svc.id = b.service_id
      WHERE b.business_id = ${businessId}
      ${clientScopeFilter}
      ${staffFilter}
    `.execute(db);

    const stats = statsResult.rows[0];
    if (!stats) {
      throw new AppError(404, 'Client not found', 'NOT_FOUND');
    }

    // total_visits = 0 AND total_revenue = 0 AND no data could mean client doesn't exist
    // but walk-in with no completed bookings is still valid — don't throw

    // ── Compute segment ───────────────────────────────────────────────────────

    const totalCompleted = parseBigInt(stats.total_completed);
    const completedLast90 = parseBigInt(stats.completed_last_90);
    const lastCompleted = stats.last_completed ? new Date(stats.last_completed) : null;
    const firstCompleted = stats.first_completed ? new Date(stats.first_completed) : null;
    const now = new Date();
    const msPerDay = 86400000;

    let segment: ClientSegment;
    if (totalCompleted >= 2 && completedLast90 >= 2) {
      segment = 'regulars';
    } else if (totalCompleted > 0 && firstCompleted && now.getTime() - firstCompleted.getTime() <= 30 * msPerDay) {
      segment = 'new';
    } else if (
      lastCompleted &&
      now.getTime() - lastCompleted.getTime() <= 180 * msPerDay &&
      now.getTime() - lastCompleted.getTime() > 30 * msPerDay
    ) {
      segment = 'sleeping';
    } else if (totalCompleted > 0 && (!lastCompleted || now.getTime() - lastCompleted.getTime() > 180 * msPerDay)) {
      segment = 'lost';
    } else {
      segment = 'not_visited';
    }

    // ── Resolve name ──────────────────────────────────────────────────────────

    let clientName: string | null = stats.walkin_name;
    if (clientUserId) {
      const user = await db
        .selectFrom('users')
        .select('name')
        .where('id', '=', clientUserId)
        .executeTakeFirst();
      clientName = user?.name ?? null;
    }

    // ── Booking history (last 20 with pagination) ─────────────────────────────

    const bookingPageSize = 20;

    type BookingRow = {
      id: string;
      slot_date: string;
      slot_time: string;
      service_name: string;
      service_price: string;
      staff_name: string;
      status: string;
      source: string;
      created_at: string;
    };

    const bookingsResult = await sql<BookingRow>`
      SELECT
        b.id,
        s.date::text AS slot_date,
        s.start_time AS slot_time,
        svc.name AS service_name,
        CAST(svc.price AS TEXT) AS service_price,
        st.name AS staff_name,
        b.status,
        b.source,
        b.created_at::text AS created_at
      FROM bookings b
      INNER JOIN slots s ON s.id = b.slot_id
      INNER JOIN services svc ON svc.id = b.service_id
      INNER JOIN staff st ON st.id = b.staff_id
      WHERE b.business_id = ${businessId}
      ${clientScopeFilter}
      ${staffFilter}
      ${bookingCursorFilter}
      ORDER BY b.created_at DESC, b.id DESC
      LIMIT ${bookingPageSize + 1}
    `.execute(db);

    const bookingRows = bookingsResult.rows;
    const hasMoreBookings = bookingRows.length > bookingPageSize;
    if (hasMoreBookings) bookingRows.pop();

    let nextBookingCursor: string | null = null;
    if (hasMoreBookings && bookingRows.length > 0) {
      const last = bookingRows[bookingRows.length - 1]!;
      nextBookingCursor = Buffer.from(
        JSON.stringify({ created_at: last.created_at, id: last.id }),
      ).toString('base64url');
    }

    // ── Event tracking ────────────────────────────────────────────────────────

    trackEvent({
      event_type: 'client_card_opened',
      payload: { client_id: clientId },
      user_id: userId,
    });

    return {
      id: clientId,
      name: clientName,
      phone: isAdmin ? (stats.phone ?? null) : null,
      segment,
      total_visits: parseBigInt(stats.total_visits),
      total_revenue: parseBigInt(stats.total_revenue),
      first_visit_at: stats.first_visit_at,
      last_visit_at: stats.last_visit_at,
      bookings: bookingRows.map((r) => ({
        id: r.id,
        slot_date: r.slot_date,
        slot_time: r.slot_time,
        service_name: r.service_name,
        service_price: parseBigInt(r.service_price),
        staff_name: r.staff_name,
        status: r.status,
        source: r.source,
        created_at: r.created_at,
      })),
      next_cursor: nextBookingCursor,
    };
  }
}

export const clientsService = new ClientsService();
