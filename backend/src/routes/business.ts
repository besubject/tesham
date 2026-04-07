import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import {
  createBusinessSlots,
  deleteBusinessSlot,
  getBusinessBookings,
  updateBusinessBookingStatus,
} from '../controllers/business-booking.controller';

const router = Router();

// All business routes require auth
router.use(requireAuth);

// ─── Validation schemas ───────────────────────────────────────────────────────

const createSlotsSchema = z.object({
  staff_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  times: z
    .array(z.string().regex(/^\d{2}:\d{2}$/, 'time must be HH:MM'))
    .min(1, 'times must not be empty'),
});

const bookingsQuerySchema = z.object({
  staff_id: z.string().uuid().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const updateBookingStatusSchema = z.object({
  status: z.enum(['cancelled', 'completed', 'no_show']),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /business/slots — create multiple slots
router.post('/slots', validate({ body: createSlotsSchema }), createBusinessSlots);

// DELETE /business/slots/:id — delete a free slot
router.delete('/slots/:id', deleteBusinessSlot);

// GET /business/bookings — list bookings (RBAC: admin=all, employee=own)
router.get('/bookings', validate({ query: bookingsQuerySchema }), getBusinessBookings);

// PATCH /business/bookings/:id — update booking status
router.patch(
  '/bookings/:id',
  validate({ body: updateBookingStatusSchema }),
  updateBusinessBookingStatus,
);

export default router;
