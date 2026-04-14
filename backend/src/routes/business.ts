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
import {
  getBusinessProfile,
  updateBusinessProfile,
  getBusinessStaff,
  addBusinessStaff,
  deleteBusinessStaff,
  getBusinessServices,
  createBusinessService,
  updateBusinessService,
  deleteBusinessService,
} from '../controllers/business-profile.controller';
import { replyToReview, reportReview } from '../controllers/review.controller';
import { getBusinessStats } from '../controllers/business-stats.controller';
import { requireRole } from '../middleware/auth';

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

const updateProfileSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().min(1).max(500).optional(),
  phone: z.string().min(5).max(20).optional(),
  instagram_url: z.string().url().nullable().optional(),
  website_url: z.string().url().nullable().optional(),
  working_hours: z.record(z.string(), z.unknown()).optional(),
  cancellation_threshold_minutes: z.number().int().min(0).optional(),
  reminder_settings: z.record(z.string(), z.unknown()).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]{3,50}$/, 'slug must be 3-50 chars: a-z, 0-9, hyphen only')
    .optional(),
});

const addStaffSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().min(5).max(20),
  role: z.enum(['admin', 'employee']),
});

const createServiceSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().int().min(0),
  duration_minutes: z.number().int().min(1),
});

const updateServiceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  price: z.number().int().min(0).optional(),
  duration_minutes: z.number().int().min(1).optional(),
  is_active: z.boolean().optional(),
});

const replyToReviewSchema = z.object({
  reply_text: z.string().min(1).max(2000),
});

const reportReviewSchema = z.object({
  reason: z.string().max(500).optional(),
});

const statsQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month']).default('week'),
  staff_id: z.string().uuid().optional(),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /business/stats — business statistics (admin=all, employee=own)
router.get('/stats', validate({ query: statsQuerySchema }), getBusinessStats);

// GET /business/profile — get full business profile (admin only)
router.get('/profile', getBusinessProfile);

// PATCH /business/profile — update business profile (admin only)
router.patch('/profile', validate({ body: updateProfileSchema }), updateBusinessProfile);

// GET /business/staff — list all staff members
router.get('/staff', getBusinessStaff);

// POST /business/staff — add staff member (admin only)
router.post('/staff', validate({ body: addStaffSchema }), addBusinessStaff);

// DELETE /business/staff/:id — remove staff member (admin only)
router.delete('/staff/:id', deleteBusinessStaff);

// GET /business/services — list all services
router.get('/services', getBusinessServices);

// POST /business/services — create service (admin only)
router.post('/services', validate({ body: createServiceSchema }), createBusinessService);

// PATCH /business/services/:id — update service (admin only)
router.patch('/services/:id', validate({ body: updateServiceSchema }), updateBusinessService);

// DELETE /business/services/:id — soft-delete service (admin only)
router.delete('/services/:id', deleteBusinessService);

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

// PATCH /business/reviews/:id — reply to a review (admin only)
router.patch(
  '/reviews/:id',
  requireRole('admin'),
  validate({ body: replyToReviewSchema }),
  replyToReview,
);

// POST /business/reviews/:id/report — report a review for moderation (admin only)
router.post(
  '/reviews/:id/report',
  requireRole('admin'),
  validate({ body: reportReviewSchema }),
  reportReview,
);

export default router;
