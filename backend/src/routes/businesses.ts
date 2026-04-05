import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { listBusinesses, getBusiness } from '../controllers/business.controller';

const router = Router();

// ─── Validation schemas ───────────────────────────────────────────────────────

const listQuerySchema = z.object({
  query: z.string().min(1).optional(),
  category_id: z.string().uuid().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /businesses — list with search, filter, geo sort
router.get('/', validate({ query: listQuerySchema }), listBusinesses);

// GET /businesses/:id — full business card
router.get('/:id', getBusiness);

export default router;
