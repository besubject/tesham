import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { createBooking, getMyBookings, cancelBooking } from '../controllers/booking.controller';

const router = Router();

// ─── Validation schemas ───────────────────────────────────────────────────────

const createBookingSchema = z.object({
  slot_id: z.string().uuid(),
  service_id: z.string().uuid(),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /bookings — create booking (requires auth)
router.post('/', requireAuth, validate({ body: createBookingSchema }), createBooking);

// GET /bookings/my — list user's bookings (requires auth)
router.get('/my', requireAuth, getMyBookings);

// DELETE /bookings/:id — cancel booking (requires auth)
router.delete('/:id', requireAuth, cancelBooking);

export default router;
