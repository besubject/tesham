import request from 'supertest';
import express, { Application } from 'express';
import jwt from 'jsonwebtoken';

// ─── Mock DB (must be before imports that use db) ─────────────────────────────

jest.mock('../db', () => {
  const chainable = {
    selectFrom: jest.fn(),
    insertInto: jest.fn(),
    innerJoin: jest.fn(),
    leftJoin: jest.fn(),
    select: jest.fn(),
    selectAll: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    offset: jest.fn(),
    groupBy: jest.fn(),
    values: jest.fn(),
    returning: jest.fn(),
    executeTakeFirst: jest.fn(),
    executeTakeFirstOrThrow: jest.fn(),
    execute: jest.fn(),
  };

  const terminal = new Set(['executeTakeFirst', 'executeTakeFirstOrThrow', 'execute']);
  Object.keys(chainable).forEach((key) => {
    if (!terminal.has(key)) {
      const fn = (chainable as Record<string, jest.Mock | undefined>)[key];
      if (fn) fn.mockReturnValue(chainable);
    }
  });

  return { db: chainable };
});

// ─── Mock config for JWT ───────────────────────────────────────────────────────

jest.mock('../config', () => ({
  config: {
    jwt: {
      accessSecret: 'test-secret',
      refreshSecret: 'test-refresh-secret',
      accessExpiresIn: '15m',
      refreshExpiresIn: '7d',
    },
    nodeEnv: 'test',
    cors: { origins: [] },
  },
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { db } from '../db';
import { errorHandler } from '../middleware/error';
import businessesRouter from '../routes/businesses';
import reviewsRouter from '../routes/reviews';

// ─── Typed mock db reference ──────────────────────────────────────────────────

const mockDb = db as unknown as {
  selectFrom: jest.Mock;
  insertInto: jest.Mock;
  innerJoin: jest.Mock;
  leftJoin: jest.Mock;
  select: jest.Mock;
  where: jest.Mock;
  orderBy: jest.Mock;
  limit: jest.Mock;
  offset: jest.Mock;
  values: jest.Mock;
  returning: jest.Mock;
  executeTakeFirst: jest.Mock;
  execute: jest.Mock;
};

// ─── Test app ─────────────────────────────────────────────────────────────────

const buildApp = (): Application => {
  const app = express();
  app.use(express.json());
  app.use('/businesses', businessesRouter);
  app.use('/reviews', reviewsRouter);
  app.use(errorHandler);
  return app;
};

// ─── Auth helper ──────────────────────────────────────────────────────────────

function makeToken(userId: string = 'user-uuid-1'): string {
  return jwt.sign({ id: userId, phone: '+79001234567' }, 'test-secret', { expiresIn: '1h' });
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const BIZ_ID = 'biz-uuid-1';
const BOOKING_ID = '550e8400-e29b-41d4-a716-446655440001';
const USER_ID = 'user-uuid-1';

const mockReviewRow = {
  id: 'rev-uuid-1',
  rating: 5,
  text: 'Отличный сервис!',
  reply_text: null,
  created_at: new Date('2026-01-15T10:00:00Z'),
  user_name: 'Ахмед Кадыров',
};

const mockCreatedReview = {
  id: 'rev-uuid-1',
  booking_id: BOOKING_ID,
  business_id: BIZ_ID,
  user_id: USER_ID,
  rating: 5,
  text: 'Отличный сервис!',
  reply_text: null,
  created_at: new Date('2026-01-15T10:00:00Z'),
};

const mockCompletedBooking = {
  id: BOOKING_ID,
  user_id: USER_ID,
  status: 'completed',
  business_id: BIZ_ID,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.resetAllMocks();

  const terminal = new Set(['executeTakeFirst', 'executeTakeFirstOrThrow', 'execute']);
  Object.keys(mockDb).forEach((key) => {
    if (!terminal.has(key)) {
      const fn = (mockDb as Record<string, jest.Mock | undefined>)[key];
      if (fn) fn.mockReturnValue(mockDb);
    }
  });

  mockDb.execute.mockResolvedValue([]);
  mockDb.executeTakeFirst.mockResolvedValue(undefined);
});

// ─── GET /businesses/:id/reviews ──────────────────────────────────────────────

describe('GET /businesses/:id/reviews', () => {
  it('returns paginated reviews for a business', async () => {
    mockDb.execute.mockResolvedValueOnce([mockReviewRow]);
    mockDb.executeTakeFirst.mockResolvedValueOnce({ total: '1' });

    const app = buildApp();
    const res = await request(app).get(`/businesses/${BIZ_ID}/reviews`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('reviews');
    expect(res.body).toHaveProperty('total', 1);
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('limit', 20);
    expect(Array.isArray(res.body.reviews)).toBe(true);
  });

  it('returns abbreviated author name "Ахмед К."', async () => {
    mockDb.execute.mockResolvedValueOnce([mockReviewRow]);
    mockDb.executeTakeFirst.mockResolvedValueOnce({ total: '1' });

    const app = buildApp();
    const res = await request(app).get(`/businesses/${BIZ_ID}/reviews`);

    expect(res.status).toBe(200);
    expect(res.body.reviews[0].author_name).toBe('Ахмед К.');
  });

  it('returns "Пользователь" for empty name', async () => {
    mockDb.execute.mockResolvedValueOnce([{ ...mockReviewRow, user_name: '' }]);
    mockDb.executeTakeFirst.mockResolvedValueOnce({ total: '1' });

    const app = buildApp();
    const res = await request(app).get(`/businesses/${BIZ_ID}/reviews`);

    expect(res.status).toBe(200);
    expect(res.body.reviews[0].author_name).toBe('Пользователь');
  });

  it('returns single-word name as-is', async () => {
    mockDb.execute.mockResolvedValueOnce([{ ...mockReviewRow, user_name: 'Ахмед' }]);
    mockDb.executeTakeFirst.mockResolvedValueOnce({ total: '1' });

    const app = buildApp();
    const res = await request(app).get(`/businesses/${BIZ_ID}/reviews`);

    expect(res.status).toBe(200);
    expect(res.body.reviews[0].author_name).toBe('Ахмед');
  });

  it('applies custom page and limit', async () => {
    mockDb.execute.mockResolvedValueOnce([]);
    mockDb.executeTakeFirst.mockResolvedValueOnce({ total: '0' });

    const app = buildApp();
    const res = await request(app).get(`/businesses/${BIZ_ID}/reviews?page=2&limit=10`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.limit).toBe(10);
  });

  it('rejects limit > 50', async () => {
    const app = buildApp();
    const res = await request(app).get(`/businesses/${BIZ_ID}/reviews?limit=100`);

    expect(res.status).toBe(400);
  });

  it('returns empty reviews array when no reviews', async () => {
    mockDb.execute.mockResolvedValueOnce([]);
    mockDb.executeTakeFirst.mockResolvedValueOnce({ total: '0' });

    const app = buildApp();
    const res = await request(app).get(`/businesses/${BIZ_ID}/reviews`);

    expect(res.status).toBe(200);
    expect(res.body.reviews).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });
});

// ─── POST /reviews ─────────────────────────────────────────────────────────────

describe('POST /reviews', () => {
  it('creates a review for a completed booking', async () => {
    // 1. booking lookup
    mockDb.executeTakeFirst
      .mockResolvedValueOnce(mockCompletedBooking)
      // 2. existing review check
      .mockResolvedValueOnce(undefined)
      // 3. insert returning
      .mockResolvedValueOnce(mockCreatedReview);
    // 4. event insert (fire-and-forget)
    mockDb.execute.mockResolvedValueOnce([]);

    const app = buildApp();
    const res = await request(app)
      .post('/reviews')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`)
      .send({ booking_id: BOOKING_ID, rating: 5, text: 'Отличный сервис!' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('rating', 5);
  });

  it('returns 401 when not authenticated', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/reviews')
      .send({ booking_id: BOOKING_ID, rating: 5 });

    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid body (missing booking_id)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/reviews')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`)
      .send({ rating: 5 });

    expect(res.status).toBe(400);
  });

  it('returns 400 for rating out of range', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/reviews')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`)
      .send({ booking_id: BOOKING_ID, rating: 6 });

    expect(res.status).toBe(400);
  });

  it('returns 404 when booking does not exist', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(undefined);

    const app = buildApp();
    const res = await request(app)
      .post('/reviews')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`)
      .send({ booking_id: BOOKING_ID, rating: 4 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('BOOKING_NOT_FOUND');
  });

  it('returns 403 when booking belongs to another user', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({
      ...mockCompletedBooking,
      user_id: 'other-user-uuid',
    });

    const app = buildApp();
    const res = await request(app)
      .post('/reviews')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`)
      .send({ booking_id: BOOKING_ID, rating: 4 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 403 when booking is not completed', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({
      ...mockCompletedBooking,
      status: 'confirmed',
    });

    const app = buildApp();
    const res = await request(app)
      .post('/reviews')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`)
      .send({ booking_id: BOOKING_ID, rating: 4 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('BOOKING_NOT_COMPLETED');
  });

  it('returns 409 when review already exists for booking', async () => {
    mockDb.executeTakeFirst
      .mockResolvedValueOnce(mockCompletedBooking)
      .mockResolvedValueOnce({ id: 'existing-rev-id' });

    const app = buildApp();
    const res = await request(app)
      .post('/reviews')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`)
      .send({ booking_id: BOOKING_ID, rating: 5 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REVIEW_ALREADY_EXISTS');
  });
});
