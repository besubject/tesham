import { sql } from 'kysely';
import { db } from '../db';
import { AppError } from '../middleware/error';
import type { ChatMessageType, ChatSenderRole } from '../db/types';
import { trackEvent } from '../utils/track-event';
import { notificationService } from './notification.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessageItem {
  id: string;
  booking_id: string;
  sender_id: string;
  sender_role: ChatSenderRole;
  message_type: ChatMessageType;
  content: string;
  is_read: boolean;
  created_at: Date;
}

export interface GetMessagesResult {
  messages: ChatMessageItem[];
  next_cursor: string | null;
}

interface BookingAccess {
  bookingId: string;
  businessId: string;
  clientUserId: string | null;
  staffUserId: string;
  senderRole: ChatSenderRole;
  bookingStatus: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ChatService {
  /**
   * Verify the user has access to this booking's chat.
   * Throws 404 if booking not found, 403 if no access.
   * Returns the user's sender role ('client' | 'staff').
   */
  private async resolveAccess(bookingId: string, userId: string): Promise<BookingAccess> {
    const row = await db
      .selectFrom('bookings as b')
      .innerJoin('staff as st', 'st.id', 'b.staff_id')
      .select([
        'b.id as booking_id',
        'b.user_id as client_user_id',
        'b.business_id',
        'b.status',
        'st.user_id as staff_user_id',
      ])
      .where('b.id', '=', bookingId)
      .executeTakeFirst();

    if (!row) {
      throw new AppError(404, 'Booking not found', 'BOOKING_NOT_FOUND');
    }

    // Is this user the client?
    if (row.client_user_id !== null && row.client_user_id === userId) {
      return {
        bookingId: row.booking_id,
        businessId: row.business_id,
        clientUserId: row.client_user_id,
        staffUserId: row.staff_user_id,
        senderRole: 'client',
        bookingStatus: row.status,
      };
    }

    // Is this user the assigned staff member?
    if (row.staff_user_id === userId) {
      return {
        bookingId: row.booking_id,
        businessId: row.business_id,
        clientUserId: row.client_user_id,
        staffUserId: row.staff_user_id,
        senderRole: 'staff',
        bookingStatus: row.status,
      };
    }

    // Is this user an admin of the business?
    const adminStaff = await db
      .selectFrom('staff')
      .select(['id'])
      .where('user_id', '=', userId)
      .where('business_id', '=', row.business_id)
      .where('role', '=', 'admin')
      .where('is_active', '=', true)
      .executeTakeFirst();

    if (adminStaff) {
      return {
        bookingId: row.booking_id,
        businessId: row.business_id,
        clientUserId: row.client_user_id,
        staffUserId: row.staff_user_id,
        senderRole: 'staff',
        bookingStatus: row.status,
      };
    }

    throw new AppError(403, 'Access denied', 'FORBIDDEN');
  }

  /**
   * GET /bookings/:id/messages
   * cursor-based pagination by created_at (ASC order).
   * cursor = ISO datetime of the last seen message; returns messages after cursor.
   */
  async getMessages(
    bookingId: string,
    userId: string,
    cursor?: string,
    limit = 50,
  ): Promise<GetMessagesResult> {
    await this.resolveAccess(bookingId, userId);

    const safeLimit = Math.min(Math.max(1, limit), 100);

    let query = db
      .selectFrom('chat_messages')
      .select([
        'id',
        'booking_id',
        'sender_id',
        'sender_role',
        'message_type',
        'content',
        'is_read',
        sql<Date>`created_at`.as('created_at'),
      ])
      .where('booking_id', '=', bookingId)
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')
      .limit(safeLimit + 1);

    if (cursor) {
      query = query.where(sql`created_at`, '>', new Date(cursor));
    }

    const rows = await query.execute();
    const hasMore = rows.length > safeLimit;
    const messages = hasMore ? rows.slice(0, safeLimit) : rows;
    const lastMessage = messages[messages.length - 1];
    const next_cursor = hasMore && lastMessage ? lastMessage.created_at.toISOString() : null;

    return {
      messages: messages.map((row) => ({
        id: row.id,
        booking_id: row.booking_id,
        sender_id: row.sender_id,
        sender_role: row.sender_role as ChatSenderRole,
        message_type: row.message_type as ChatMessageType,
        content: row.content,
        is_read: row.is_read,
        created_at: row.created_at,
      })),
      next_cursor,
    };
  }

  /**
   * POST /bookings/:id/messages
   * Send a text or image message. Only allowed when booking.status = 'confirmed'.
   */
  async sendMessage(
    bookingId: string,
    userId: string,
    messageType: ChatMessageType,
    content: string,
  ): Promise<ChatMessageItem> {
    const access = await this.resolveAccess(bookingId, userId);

    if (access.bookingStatus !== 'confirmed') {
      throw new AppError(403, 'Cannot send messages for non-confirmed bookings', 'BOOKING_NOT_ACTIVE');
    }

    const inserted = await db
      .insertInto('chat_messages')
      .values({
        booking_id: bookingId,
        sender_id: userId,
        sender_role: access.senderRole,
        message_type: messageType,
        content,
        is_read: false,
      })
      .returning([
        'id',
        'booking_id',
        'sender_id',
        'sender_role',
        'message_type',
        'content',
        'is_read',
        sql<Date>`created_at`.as('created_at'),
      ])
      .executeTakeFirst();

    if (!inserted) {
      throw new AppError(500, 'Failed to send message', 'INTERNAL_ERROR');
    }

    // Event tracking (fire-and-forget)
    trackEvent({
      event_type: 'chat_message_sent',
      payload: {
        booking_id: bookingId,
        sender_role: access.senderRole,
        message_type: messageType,
      },
      user_id: userId,
    });

    // Push notification to the other party (fire-and-forget)
    void notificationService
      .notifyNewChatMessage(bookingId, access.senderRole, access.clientUserId, access.staffUserId)
      .catch(() => undefined);

    return {
      id: inserted.id,
      booking_id: inserted.booking_id,
      sender_id: inserted.sender_id,
      sender_role: inserted.sender_role as ChatSenderRole,
      message_type: inserted.message_type as ChatMessageType,
      content: inserted.content,
      is_read: inserted.is_read,
      created_at: inserted.created_at,
    };
  }

  /**
   * PATCH /bookings/:id/messages/read
   * Mark all unread messages from the OTHER party as read.
   */
  async markAsRead(bookingId: string, userId: string): Promise<{ updated: number }> {
    const access = await this.resolveAccess(bookingId, userId);
    const otherRole: ChatSenderRole = access.senderRole === 'client' ? 'staff' : 'client';

    const result = await db
      .updateTable('chat_messages')
      .set({ is_read: true })
      .where('booking_id', '=', bookingId)
      .where('sender_role', '=', otherRole)
      .where('is_read', '=', false)
      .execute();

    return { updated: Number(result[0]?.numUpdatedRows ?? 0) };
  }

  /**
   * GET /bookings/:id/messages/unread-count
   * Count unread messages from the OTHER party.
   */
  async getUnreadCount(bookingId: string, userId: string): Promise<{ unread_count: number }> {
    const access = await this.resolveAccess(bookingId, userId);
    const otherRole: ChatSenderRole = access.senderRole === 'client' ? 'staff' : 'client';

    const result = await db
      .selectFrom('chat_messages')
      .select(sql<string>`count(*)`.as('count'))
      .where('booking_id', '=', bookingId)
      .where('sender_role', '=', otherRole)
      .where('is_read', '=', false)
      .executeTakeFirst();

    return { unread_count: result ? Number(result.count) : 0 };
  }
}

export const chatService = new ChatService();
