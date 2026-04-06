import { Request, Response } from 'express';
import { z } from 'zod';
import { trackEvent } from '../utils/track-event';
import { validate } from '../middleware/validate';

const eventSchema = z.object({
  event_type: z.string().min(1).max(100),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
  session_id: z.string().max(100).nullable().optional(),
  device_type: z.string().max(50).nullable().optional(),
  app_version: z.string().max(20).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
});

export const validateEvent = validate({ body: eventSchema });

export function postEvent(req: Request, res: Response): void {
  const body = req.body as z.infer<typeof eventSchema>;

  trackEvent({
    event_type: body.event_type,
    payload: body.payload,
    user_id: req.user?.id ?? null,
    session_id: body.session_id ?? null,
    device_type: body.device_type ?? null,
    app_version: body.app_version ?? null,
    lat: body.lat ?? null,
    lng: body.lng ?? null,
  });

  res.status(202).json({ ok: true });
}
