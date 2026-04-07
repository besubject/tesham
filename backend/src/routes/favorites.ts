import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { getFavorites, addFavorite, removeFavorite } from '../controllers/favorite.controller';

const router = Router();

// ─── Validation schemas ───────────────────────────────────────────────────────

const addFavoriteSchema = z
  .object({
    business_id: z.string().uuid().optional(),
    staff_id: z.string().uuid().optional(),
  })
  .refine((data) => data.business_id !== undefined || data.staff_id !== undefined, {
    message: 'Either business_id or staff_id must be provided',
  })
  .refine((data) => !(data.business_id !== undefined && data.staff_id !== undefined), {
    message: 'Only one of business_id or staff_id can be provided',
  });

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /favorites — list user's favorites (requires auth)
router.get('/', requireAuth, getFavorites);

// POST /favorites — add to favorites (requires auth)
router.post('/', requireAuth, validate({ body: addFavoriteSchema }), addFavorite);

// DELETE /favorites/:id — remove from favorites (requires auth)
router.delete('/:id', requireAuth, removeFavorite);

export default router;
