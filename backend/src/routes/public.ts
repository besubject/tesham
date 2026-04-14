import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { publicService } from '../services/public.service';

const router = Router();

// ─── Validation schemas ───────────────────────────────────────────────────────

const slugParamsSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,50}$/),
});

const slotsQuerySchema = z.object({
  staff_id: z.string().uuid().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const createPublicBookingSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,50}$/),
  staff_id: z.string().uuid(),
  service_id: z.string().uuid(),
  slot_id: z.string().uuid(),
  phone: z.string().regex(/^\+7\d{10}$/),
  code: z.string().length(6),
  name: z.string().min(1).max(100).optional(),
});

// ─── Route handlers ───────────────────────────────────────────────────────────

async function getPublicBusiness(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { slug } = req.params as { slug: string };
    const rawLang = req.headers['accept-language'] ?? 'ru';
    const lang: 'ru' | 'ce' = rawLang.startsWith('ce') ? 'ce' : 'ru';
    const business = await publicService.getBusinessBySlug(slug, lang);
    res.json({ business });
  } catch (err) {
    next(err);
  }
}

async function getPublicSlots(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { slug } = req.params as { slug: string };
    const q = req.query as unknown as { staff_id?: string; date?: string };
    const slots = await publicService.getSlotsBySlug(slug, q.staff_id, q.date);
    res.json({ slots });
  } catch (err) {
    next(err);
  }
}

async function createPublicBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as z.infer<typeof createPublicBookingSchema>;
    const booking = await publicService.createPublicBooking(body);
    res.status(201).json({ booking });
  } catch (err) {
    next(err);
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /public/business/:slug — public business card (no auth)
router.get('/business/:slug', validate({ params: slugParamsSchema }), getPublicBusiness);

// GET /public/business/:slug/slots — available slots (no auth)
router.get(
  '/business/:slug/slots',
  validate({ params: slugParamsSchema, query: slotsQuerySchema }),
  getPublicSlots,
);

// POST /public/bookings — create booking via public link (SMS verification in body)
router.post('/bookings', validate({ body: createPublicBookingSchema }), createPublicBooking);

export default router;
