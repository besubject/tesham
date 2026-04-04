import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../../config';
import { errorHandler } from '../error';
import { validate } from '../validate';
import { requireAuth, requireRole } from '../auth';
import { globalRateLimit } from '../rate-limit';

// Use the same secret as config (loaded from .env by config module)
const ACCESS_SECRET = config.jwt.accessSecret;

function makeApp() {
  const app = express();
  app.use(express.json());

  // Protected endpoint
  app.get('/protected', requireAuth, (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Role-protected endpoint
  app.get(
    '/admin-only',
    requireAuth,
    requireRole('admin'),
    (_req: Request, res: Response) => {
      res.json({ ok: true });
    },
  );

  // Validation endpoint
  const schema = z.object({ name: z.string().min(1) });
  app.post(
    '/validate',
    (req: Request, res: Response, next: NextFunction) => {
      validate({ body: schema })(req, res, next);
    },
    (_req: Request, res: Response) => {
      res.json({ ok: true });
    },
  );

  // Rate-limited endpoint
  const limiter = globalRateLimit;
  app.get('/limited', limiter, (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.use(errorHandler);
  return app;
}

describe('Auth middleware', () => {
  const app = makeApp();

  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
  });

  it('returns 401 when invalid token provided', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });

  it('returns 200 with valid token', async () => {
    const token = jwt.sign(
      { id: 'user-1', phone: '+79001234567' },
      ACCESS_SECRET,
      { expiresIn: '1h' },
    );
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('returns 403 when user lacks required role', async () => {
    const token = jwt.sign(
      { id: 'user-1', phone: '+79001234567', role: 'user' },
      ACCESS_SECRET,
      { expiresIn: '1h' },
    );
    const res = await request(app)
      .get('/admin-only')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 when user has required role', async () => {
    const token = jwt.sign(
      { id: 'user-1', phone: '+79001234567', role: 'admin' },
      ACCESS_SECRET,
      { expiresIn: '1h' },
    );
    const res = await request(app)
      .get('/admin-only')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('Validation middleware', () => {
  const app = makeApp();

  it('returns 400 with Zod errors for invalid body', async () => {
    const res = await request(app).post('/validate').send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeDefined();
  });

  it('returns 200 for valid body', async () => {
    const res = await request(app).post('/validate').send({ name: 'Test' });
    expect(res.status).toBe(200);
  });
});

describe('Rate limiter', () => {
  it('returns 429 after exceeding limit', async () => {
    // Create a new app with a very low limit for this test
    const testApp = express();
    testApp.use(express.json());

    const { default: rateLimit } = await import('express-rate-limit');
    const strictLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 2,
      standardHeaders: true,
      legacyHeaders: false,
    });

    testApp.get('/limited', strictLimiter, (_req: Request, res: Response) => {
      res.json({ ok: true });
    });
    testApp.use(errorHandler);

    await request(testApp).get('/limited');
    await request(testApp).get('/limited');
    const res = await request(testApp).get('/limited');
    expect(res.status).toBe(429);
  });
});
