import { sql } from 'kysely';
import { db } from '../db';
import { AppError } from '../middleware/error';
import { checkProfanity } from '../utils/profanity-filter';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReviewItem {
  id: string;
  rating: number;
  text: string;
  author_name: string;
  created_at: Date;
  reply_text: string | null;
}

export interface GetBusinessReviewsResult {
  reviews: ReviewItem[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateReviewParams {
  booking_id: string;
  rating: number;
  text?: string;
  user_id: string;
}

export interface CreatedReview {
  id: string;
  booking_id: string;
  business_id: string;
  user_id: string;
  rating: number;
  text: string;
  reply_text: string | null;
  created_at: Date;
}

export interface ReplyToReviewParams {
  reviewId: string;
  businessId: string;
  replyText: string;
}

export interface ReviewReplyResult {
  id: string;
  reply_text: string;
  reply_at: Date;
}

export interface ReportReviewParams {
  reviewId: string;
  businessId: string;
  reason?: string;
}

export interface ReportReviewResult {
  id: string;
  is_reported: boolean;
  reported_at: Date;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatAuthorName(name: string): string {
  if (!name || name.trim() === '') return 'Пользователь';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0] ?? 'Пользователь';
  const first = parts[0] ?? '';
  const second = parts[1] ?? '';
  const initial = second.charAt(0);
  return `${first} ${initial}.`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ReviewService {
  async getBusinessReviews(
    businessId: string,
    page: number,
    limit: number,
  ): Promise<GetBusinessReviewsResult> {
    const offset = (page - 1) * limit;

    const [rows, countResult] = await Promise.all([
      db
        .selectFrom('reviews as r')
        .innerJoin('users as u', 'u.id', 'r.user_id')
        .select([
          'r.id',
          'r.rating',
          'r.text',
          'r.reply_text',
          sql<Date>`r.created_at`.as('created_at'),
          sql<string>`u.name`.as('user_name'),
        ])
        .where('r.business_id', '=', businessId)
        .orderBy('r.created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .execute(),
      db
        .selectFrom('reviews')
        .select(sql<string>`COUNT(*)`.as('total'))
        .where('business_id', '=', businessId)
        .executeTakeFirst(),
    ]);

    const reviews: ReviewItem[] = rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      text: row.text,
      author_name: formatAuthorName(row.user_name),
      created_at: row.created_at,
      reply_text: row.reply_text,
    }));

    return {
      reviews,
      total: Number(countResult?.total ?? 0),
      page,
      limit,
    };
  }

  async createReview(params: CreateReviewParams): Promise<CreatedReview> {
    const { booking_id, rating, text, user_id } = params;

    // Profanity filter — substitute offensive words with asterisks
    const { cleaned: cleanedText, hasProfanity, matches } = checkProfanity(text);

    // 1. Check booking exists
    const booking = await db
      .selectFrom('bookings')
      .select(['id', 'user_id', 'status', 'business_id'])
      .where('id', '=', booking_id)
      .executeTakeFirst();

    if (!booking) {
      throw new AppError(404, 'Booking not found', 'BOOKING_NOT_FOUND');
    }

    // 2. Booking must belong to current user
    if (booking.user_id !== user_id) {
      throw new AppError(403, 'Forbidden', 'FORBIDDEN');
    }

    // 3. Booking must be completed
    if (booking.status !== 'completed') {
      throw new AppError(403, 'Booking is not completed', 'BOOKING_NOT_COMPLETED');
    }

    // 4. No existing review for this booking
    const existing = await db
      .selectFrom('reviews')
      .select('id')
      .where('booking_id', '=', booking_id)
      .executeTakeFirst();

    if (existing) {
      throw new AppError(409, 'Review already exists for this booking', 'REVIEW_ALREADY_EXISTS');
    }

    // Create review (with censored text)
    const review = await db
      .insertInto('reviews')
      .values({
        booking_id,
        user_id,
        business_id: booking.business_id,
        rating,
        text: cleanedText ?? '',
        reply_text: null,
        reply_at: null,
        is_reported: false,
        reported_at: null,
        reported_reason: null,
      })
      .returning([
        'id',
        'booking_id',
        'business_id',
        'user_id',
        'rating',
        'text',
        'reply_text',
        sql<Date>`created_at`.as('created_at'),
      ])
      .executeTakeFirst();

    if (!review) {
      throw new AppError(500, 'Failed to create review', 'INTERNAL_ERROR');
    }

    // Event tracking (fire-and-forget)
    void db
      .insertInto('events')
      .values({
        event_type: 'review.create',
        payload: JSON.stringify({
          review_id: review.id,
          business_id: review.business_id,
          rating,
          had_profanity: hasProfanity,
          profanity_matches: matches,
        }),
        session_id: null,
        anonymous_user_hash: null,
        user_id,
      })
      .execute()
      .catch(() => undefined);

    return {
      id: review.id,
      booking_id: review.booking_id,
      business_id: review.business_id,
      user_id: review.user_id,
      rating: review.rating,
      text: review.text,
      reply_text: review.reply_text,
      created_at: review.created_at,
    };
  }

  async replyToReview(params: ReplyToReviewParams): Promise<ReviewReplyResult> {
    const { reviewId, businessId, replyText } = params;

    // Verify review exists and belongs to this business
    const existing = await db
      .selectFrom('reviews')
      .select('id')
      .where('id', '=', reviewId)
      .where('business_id', '=', businessId)
      .executeTakeFirst();

    if (!existing) {
      throw new AppError(404, 'Review not found', 'REVIEW_NOT_FOUND');
    }

    const replyAt = new Date();

    await db
      .updateTable('reviews')
      .set({ reply_text: replyText, reply_at: replyAt })
      .where('id', '=', reviewId)
      .execute();

    return { id: reviewId, reply_text: replyText, reply_at: replyAt };
  }

  async reportReview(params: ReportReviewParams): Promise<ReportReviewResult> {
    const { reviewId, businessId, reason } = params;

    // Verify review exists and belongs to this business
    const existing = await db
      .selectFrom('reviews')
      .select(['id', 'is_reported'])
      .where('id', '=', reviewId)
      .where('business_id', '=', businessId)
      .executeTakeFirst();

    if (!existing) {
      throw new AppError(404, 'Review not found', 'REVIEW_NOT_FOUND');
    }

    if (existing.is_reported) {
      throw new AppError(409, 'Review is already reported', 'REVIEW_ALREADY_REPORTED');
    }

    const reportedAt = new Date();

    await db
      .updateTable('reviews')
      .set({
        is_reported: true,
        reported_at: reportedAt,
        reported_reason: reason ?? null,
      })
      .where('id', '=', reviewId)
      .execute();

    // Event tracking (fire-and-forget)
    void db
      .insertInto('events')
      .values({
        event_type: 'review.report',
        payload: JSON.stringify({ review_id: reviewId, business_id: businessId, reason }),
        session_id: null,
        anonymous_user_hash: null,
        user_id: null,
      })
      .execute()
      .catch(() => undefined);

    return { id: reviewId, is_reported: true, reported_at: reportedAt };
  }
}

export const reviewService = new ReviewService();
