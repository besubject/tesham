import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { getMe, updateMe, deleteMe, registerPushToken, removePushToken } from '../controllers/user.controller';

const router = Router();

const updateUserSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    language: z.enum(['ru', 'ce']).optional(),
  })
  .strict();

const pushTokenSchema = z.object({ token: z.string().min(1).max(500) }).strict();

// All /user routes require auth
router.use(requireAuth);

// GET /user/me
router.get('/me', getMe);

// PATCH /user/me
router.patch('/me', validate({ body: updateUserSchema }), updateMe);

// DELETE /user/me
router.delete('/me', deleteMe);

// POST /user/push-token — register Expo push token
router.post('/push-token', validate({ body: pushTokenSchema }), registerPushToken);

// DELETE /user/push-token/:token — remove push token (on logout)
router.delete('/push-token/:token', removePushToken);

export default router;
