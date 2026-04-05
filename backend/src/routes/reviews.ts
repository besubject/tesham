import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { createReview } from '../controllers/review.controller';

const router = Router();

// ─── Validation schemas ───────────────────────────────────────────────────────

const createReviewBodySchema = z.object({
  booking_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  text: z.string().max(2000).optional(),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /reviews — create a review (auth required)
router.post('/', requireAuth, validate({ body: createReviewBodySchema }), createReview);

export default router;
