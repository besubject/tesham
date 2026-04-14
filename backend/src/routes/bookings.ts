import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { createBooking, getMyBookings, cancelBooking } from '../controllers/booking.controller';
import {
  getMessages,
  sendMessage,
  markAsRead,
  getUnreadCount,
} from '../controllers/chat.controller';

const router = Router();

// ─── Validation schemas ───────────────────────────────────────────────────────

const createBookingSchema = z.object({
  slot_id: z.string().uuid(),
  service_id: z.string().uuid(),
});

const sendMessageSchema = z.object({
  message_type: z.enum(['text', 'image']),
  content: z.string().min(1),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /bookings — create booking (requires auth)
router.post('/', requireAuth, validate({ body: createBookingSchema }), createBooking);

// GET /bookings/my — list user's bookings (requires auth)
router.get('/my', requireAuth, getMyBookings);

// DELETE /bookings/:id — cancel booking (requires auth)
router.delete('/:id', requireAuth, cancelBooking);

// ─── Chat routes ──────────────────────────────────────────────────────────────

// GET /bookings/:id/messages — list messages (cursor-based pagination)
router.get('/:id/messages', requireAuth, getMessages);

// GET /bookings/:id/messages/unread-count — unread count from other party
router.get('/:id/messages/unread-count', requireAuth, getUnreadCount);

// POST /bookings/:id/messages — send text or image message
router.post(
  '/:id/messages',
  requireAuth,
  validate({ body: sendMessageSchema }),
  sendMessage,
);

// PATCH /bookings/:id/messages/read — mark all messages from other party as read
router.patch('/:id/messages/read', requireAuth, markAsRead);

export default router;
