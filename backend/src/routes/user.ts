import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { authRateLimit } from '../middleware/rate-limit';
import { getMe, updateMe, deleteMe, sendDeleteCode, registerPushToken, removePushToken, setEmail, verifyEmail } from '../controllers/user.controller';

const router = Router();

const updateUserSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    language: z.enum(['ru', 'ce']).optional(),
  })
  .strict();

const pushTokenSchema = z.object({ token: z.string().min(1).max(500) }).strict();

const setEmailSchema = z.object({ email: z.string().email('Invalid email') }).strict();
const verifyEmailSchema = z.object({ code: z.string().length(6).regex(/^\d{6}$/) }).strict();
const deleteUserSchema = z.object({ code: z.string().length(6).regex(/^\d{6}$/) }).strict();

// All /user routes require auth
router.use(requireAuth);

// GET /user/me
router.get('/me', getMe);

// PATCH /user/me
router.patch('/me', validate({ body: updateUserSchema }), updateMe);

// POST /user/me/delete-code — send verification code to the authenticated user's phone
router.post('/me/delete-code', authRateLimit, sendDeleteCode);

// DELETE /user/me
router.delete('/me', validate({ body: deleteUserSchema }), deleteMe);

// POST /user/email — set email and send verification code
router.post('/email', validate({ body: setEmailSchema }), setEmail);

// POST /user/email/verify — verify email with 6-digit code
router.post('/email/verify', validate({ body: verifyEmailSchema }), verifyEmail);

// POST /user/push-token — register Expo push token
router.post('/push-token', validate({ body: pushTokenSchema }), registerPushToken);

// DELETE /user/push-token/:token — remove push token (on logout)
router.delete('/push-token/:token', removePushToken);

export default router;
