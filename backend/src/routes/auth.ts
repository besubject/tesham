import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authRateLimit } from '../middleware/rate-limit';
import { sendCode, verifyCode, refresh, verifyEmailLogin } from '../controllers/auth.controller';

const router = Router();

const phoneSchema = z.object({
  phone: z
    .string()
    .regex(/^\+?[78]\d{10}$/, 'Invalid Russian phone number'),
});

const verifySchema = z.object({
  phone: z.string().regex(/^\+?[78]\d{10}$/, 'Invalid Russian phone number'),
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d{6}$/, 'Code must be numeric'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// POST /auth/send-code — rate limited: 3 per 10 minutes
router.post('/send-code', authRateLimit, validate({ body: phoneSchema }), sendCode);

// POST /auth/verify-code
router.post('/verify-code', validate({ body: verifySchema }), verifyCode);

// POST /auth/refresh
router.post('/refresh', validate({ body: refreshSchema }), refresh);

// POST /auth/verify-email-login — confirm identity via email code after long inactivity
router.post('/verify-email-login', validate({ body: verifySchema }), verifyEmailLogin);

export default router;
