import { sql } from 'kysely';
import { db } from '../db';
import { AppError } from '../middleware/error';
import { trackEvent } from '../utils/track-event';
import type { BroadcastAudience, BroadcastRecipientStatus } from '../db/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateBroadcastParams {
  userId: string;
  businessId: string;
  audience: BroadcastAudience;
  title: string;
  body: string;
}

export interface BroadcastListItem {
  id: string;
  audience: BroadcastAudience;
  title: string;
  body: string;
  created_at: string;
  sent_at: string | null;
  total_recipients: number;
  delivered_count: number;
  skipped_no_token: number;
  skipped_rate_limit: number;
}

export interface BroadcastListResult {
  broadcasts: BroadcastListItem[];
  next_cursor: string | null;
}

export interface BroadcastRecipientItem {
  user_id: string;
  status: BroadcastRecipientStatus;
  sent_at: string;
}

export interface BroadcastDetail extends BroadcastListItem {
  recipients: BroadcastRecipientItem[];
  recipients_next_cursor: string | null;
}

// ─── Expo Push helper ─────────────────────────────────────────────────────────

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

async function sendExpoPushChunked(messages: ExpoPushMessage[]): Promise<void> {
  const CHUNK_SIZE = 100;
  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk),
      });
      if (!response.ok) {
        console.error('[ExpoPush broadcast] HTTP error:', response.status);
      }
    } catch (err) {
      console.error('[ExpoPush broadcast] Failed to send chunk:', err);
    }
  }
}

function substitutePlaceholders(
  text: string,
  firstName: string | null,
  businessName: string,
): string {
  return text
    .replace(/\{first_name\}/g, firstName ?? 'Клиент')
    .replace(/\{business_name\}/g, businessName);
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class BroadcastsService {
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
      throw new AppError(403, 'Only admins can manage broadcasts', 'FORBIDDEN');
    }
  }

  private async requireStaff(userId: string, businessId: string): Promise<void> {
    const staff = await db
      .selectFrom('staff')
      .select('id')
      .where('user_id', '=', userId)
      .where('business_id', '=', businessId)
      .where('is_active', '=', true)
      .executeTakeFirst();

    if (!staff) {
      throw new AppError(403, 'You are not a staff member of this business', 'FORBIDDEN');
    }
  }

  // ── POST /business/broadcasts ──────────────────────────────────────────────

  async createBroadcast(params: CreateBroadcastParams): Promise<BroadcastListItem> {
    const { userId, businessId, audience, title, body } = params;

    await this.requireAdmin(userId, businessId);

    // Daily limit check (timezone Europe/Moscow = UTC+3)
    type CountRow = { count: string };
    const dayCheck = await sql<CountRow>`
      SELECT CAST(COUNT(*) AS TEXT) AS count
      FROM broadcasts
      WHERE business_id = ${businessId}
        AND DATE(created_at AT TIME ZONE 'Europe/Moscow') = DATE(NOW() AT TIME ZONE 'Europe/Moscow')
    `.execute(db);

    if (Number(dayCheck.rows[0]?.count ?? 0) > 0) {
      throw new AppError(429, 'Already sent a broadcast today', 'DAILY_LIMIT_EXCEEDED');
    }

    // Get business name for placeholder substitution
    const business = await db
      .selectFrom('businesses')
      .select(['id', 'name'])
      .where('id', '=', businessId)
      .executeTakeFirstOrThrow();

    // Get all users in the target segment (with or without push tokens)
    const audienceFilter =
      audience === 'all' ? sql`TRUE` : sql`s.segment = ${audience}`;

    type CandidateRow = {
      user_id: string;
      first_name: string | null;
      token: string | null;
    };

    const candidatesResult = await sql<CandidateRow>`
      WITH client_stats AS (
        SELECT
          b.user_id,
          COUNT(*) FILTER (WHERE b.status = 'completed') AS total_completed,
          COUNT(*) FILTER (
            WHERE b.status = 'completed' AND b.created_at >= NOW() - INTERVAL '90 days'
          ) AS completed_last_90,
          MAX(CASE WHEN b.status = 'completed' THEN b.created_at END) AS last_completed,
          MIN(CASE WHEN b.status = 'completed' THEN b.created_at END) AS first_completed
        FROM bookings b
        WHERE b.business_id = ${businessId}
          AND b.user_id IS NOT NULL
        GROUP BY b.user_id
      ),
      segmented AS (
        SELECT
          user_id,
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
        FROM client_stats
      )
      SELECT
        s.user_id,
        u.name AS first_name,
        pt.token
      FROM segmented s
      INNER JOIN users u ON u.id = s.user_id
      LEFT JOIN push_tokens pt ON pt.user_id = s.user_id
      WHERE ${audienceFilter}
    `.execute(db);

    // Group tokens by user_id; collect skipped_no_token
    const userTokensMap = new Map<string, { tokens: string[]; firstName: string | null }>();
    let skippedNoToken = 0;

    for (const row of candidatesResult.rows) {
      if (!row.token) {
        // Count unique users without a token
        if (!userTokensMap.has(row.user_id)) {
          skippedNoToken++;
          // Mark as seen so we don't double-count
          userTokensMap.set(row.user_id, { tokens: [], firstName: row.first_name });
        }
        continue;
      }
      const existing = userTokensMap.get(row.user_id);
      if (existing) {
        if (existing.tokens.length > 0) {
          // Already has tokens — just append
          existing.tokens.push(row.token);
        } else {
          // Was counted as no-token previously (shouldn't happen with LEFT JOIN order, but be safe)
          existing.tokens.push(row.token);
          skippedNoToken = Math.max(0, skippedNoToken - 1);
        }
      } else {
        userTokensMap.set(row.user_id, { tokens: [row.token], firstName: row.first_name });
      }
    }

    // Users with at least one token
    const usersWithToken = Array.from(userTokensMap.entries()).filter(
      ([, v]) => v.tokens.length > 0,
    );

    // Rate-limit check: users who received a broadcast from this business in last 7 days
    type RateLimitRow = { user_id: string };
    const rateLimitResult = await sql<RateLimitRow>`
      SELECT DISTINCT br.user_id
      FROM broadcast_recipients br
      INNER JOIN broadcasts bc ON bc.id = br.broadcast_id
      WHERE bc.business_id = ${businessId}
        AND br.sent_at >= NOW() - INTERVAL '7 days'
        AND br.status IN ('delivered', 'failed')
    `.execute(db);

    const rateLimitedSet = new Set(rateLimitResult.rows.map((r) => r.user_id));

    const toSend: Array<{ userId: string; tokens: string[]; firstName: string | null }> = [];
    const skippedRateLimitUsers: string[] = [];

    for (const [uid, data] of usersWithToken) {
      if (rateLimitedSet.has(uid)) {
        skippedRateLimitUsers.push(uid);
      } else {
        toSend.push({ userId: uid, tokens: data.tokens, firstName: data.firstName });
      }
    }

    const totalRecipients = userTokensMap.size;
    const deliveredCount = toSend.length;
    const skippedRateLimitCount = skippedRateLimitUsers.length;

    // Create broadcast record
    const broadcast = await db
      .insertInto('broadcasts')
      .values({
        business_id: businessId,
        audience,
        title,
        body,
        created_by_user_id: userId,
        sent_at: null,
        total_recipients: totalRecipients,
        delivered_count: deliveredCount,
        skipped_no_token: skippedNoToken,
        skipped_rate_limit: skippedRateLimitCount,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Insert broadcast_recipients for rate-limited
    if (skippedRateLimitUsers.length > 0) {
      await db
        .insertInto('broadcast_recipients')
        .values(
          skippedRateLimitUsers.map((uid) => ({
            broadcast_id: broadcast.id,
            user_id: uid,
            status: 'skipped_rate_limit' as const,
            error_message: null,
            sent_at: new Date(),
          })),
        )
        .execute();
    }

    // Build and send push messages in chunks of 100
    const messages: ExpoPushMessage[] = toSend.flatMap(({ tokens, firstName }) => {
      const firstNameOnly = firstName ? (firstName.split(' ')[0] ?? null) : null;
      const resolvedTitle = substitutePlaceholders(title, firstNameOnly, business.name);
      const resolvedBody = substitutePlaceholders(body, firstNameOnly, business.name);
      return tokens.map((token) => ({
        to: token,
        title: resolvedTitle,
        body: resolvedBody,
        data: { broadcast_id: broadcast.id },
      }));
    });

    await sendExpoPushChunked(messages);

    // Insert broadcast_recipients for delivered
    if (toSend.length > 0) {
      await db
        .insertInto('broadcast_recipients')
        .values(
          toSend.map(({ userId: uid }) => ({
            broadcast_id: broadcast.id,
            user_id: uid,
            status: 'delivered' as const,
            error_message: null,
            sent_at: new Date(),
          })),
        )
        .execute();
    }

    // Mark broadcast as sent
    const updated = await db
      .updateTable('broadcasts')
      .set({ sent_at: new Date() })
      .where('id', '=', broadcast.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    trackEvent({
      event_type: 'broadcast_created',
      user_id: userId,
      payload: { audience, total_recipients: totalRecipients },
    });

    trackEvent({
      event_type: 'broadcast_sent',
      user_id: userId,
      payload: {
        broadcast_id: broadcast.id,
        delivered: deliveredCount,
        skipped_no_token: skippedNoToken,
        skipped_rate_limit: skippedRateLimitCount,
      },
    });

    return this.mapBroadcast(updated);
  }

  // ── GET /business/broadcasts ───────────────────────────────────────────────

  async getBroadcasts(params: {
    userId: string;
    businessId: string;
    limit: number;
    cursor?: string;
  }): Promise<BroadcastListResult> {
    const { userId, businessId, limit, cursor } = params;

    await this.requireStaff(userId, businessId);

    let query = db
      .selectFrom('broadcasts')
      .selectAll()
      .where('business_id', '=', businessId)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(limit + 1);

    if (cursor) {
      let decoded: { created_at: string; id: string };
      try {
        decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
          created_at: string;
          id: string;
        };
      } catch {
        throw new AppError(400, 'Invalid cursor', 'INVALID_CURSOR');
      }
      query = query.where((eb) =>
        eb.or([
          eb('created_at', '<', new Date(decoded.created_at)),
          eb.and([
            eb('created_at', '=', new Date(decoded.created_at)),
            eb('id', '<', decoded.id),
          ]),
        ]),
      );
    }

    const rows = await query.execute();
    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();

    let nextCursor: string | null = null;
    if (hasMore && rows.length > 0) {
      const last = rows[rows.length - 1]!;
      nextCursor = Buffer.from(
        JSON.stringify({ created_at: last.created_at.toISOString(), id: last.id }),
      ).toString('base64url');
    }

    return {
      broadcasts: rows.map((r) => this.mapBroadcast(r)),
      next_cursor: nextCursor,
    };
  }

  // ── GET /business/broadcasts/:id ──────────────────────────────────────────

  async getBroadcastDetail(params: {
    userId: string;
    businessId: string;
    broadcastId: string;
    recipientCursor?: string;
  }): Promise<BroadcastDetail> {
    const { userId, businessId, broadcastId, recipientCursor } = params;

    await this.requireStaff(userId, businessId);

    const broadcast = await db
      .selectFrom('broadcasts')
      .selectAll()
      .where('id', '=', broadcastId)
      .where('business_id', '=', businessId)
      .executeTakeFirst();

    if (!broadcast) {
      throw new AppError(404, 'Broadcast not found', 'NOT_FOUND');
    }

    const PAGE_SIZE = 50;
    let recipientsQuery = db
      .selectFrom('broadcast_recipients')
      .selectAll()
      .where('broadcast_id', '=', broadcastId)
      .orderBy('sent_at', 'desc')
      .orderBy('id', 'desc')
      .limit(PAGE_SIZE + 1);

    if (recipientCursor) {
      let decoded: { sent_at: string; id: string };
      try {
        decoded = JSON.parse(
          Buffer.from(recipientCursor, 'base64url').toString('utf8'),
        ) as { sent_at: string; id: string };
      } catch {
        throw new AppError(400, 'Invalid recipient cursor', 'INVALID_CURSOR');
      }
      recipientsQuery = recipientsQuery.where((eb) =>
        eb.or([
          eb('sent_at', '<', new Date(decoded.sent_at)),
          eb.and([
            eb('sent_at', '=', new Date(decoded.sent_at)),
            eb('id', '<', decoded.id),
          ]),
        ]),
      );
    }

    const recipientRows = await recipientsQuery.execute();
    const hasMoreRecipients = recipientRows.length > PAGE_SIZE;
    if (hasMoreRecipients) recipientRows.pop();

    let recipientsNextCursor: string | null = null;
    if (hasMoreRecipients && recipientRows.length > 0) {
      const last = recipientRows[recipientRows.length - 1]!;
      recipientsNextCursor = Buffer.from(
        JSON.stringify({ sent_at: last.sent_at.toISOString(), id: last.id }),
      ).toString('base64url');
    }

    return {
      ...this.mapBroadcast(broadcast),
      recipients: recipientRows.map((r) => ({
        user_id: r.user_id,
        status: r.status,
        sent_at: r.sent_at.toISOString(),
      })),
      recipients_next_cursor: recipientsNextCursor,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private mapBroadcast(r: {
    id: string;
    audience: BroadcastAudience;
    title: string;
    body: string;
    created_at: Date;
    sent_at: Date | null;
    total_recipients: number;
    delivered_count: number;
    skipped_no_token: number;
    skipped_rate_limit: number;
  }): BroadcastListItem {
    return {
      id: r.id,
      audience: r.audience,
      title: r.title,
      body: r.body,
      created_at: r.created_at.toISOString(),
      sent_at: r.sent_at?.toISOString() ?? null,
      total_recipients: r.total_recipients,
      delivered_count: r.delivered_count,
      skipped_no_token: r.skipped_no_token,
      skipped_rate_limit: r.skipped_rate_limit,
    };
  }
}

export const broadcastsService = new BroadcastsService();
