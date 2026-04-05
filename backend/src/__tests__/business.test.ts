import request from 'supertest';
import express, { Application } from 'express';

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

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { db } from '../db';
import { errorHandler } from '../middleware/error';
import businessesRouter from '../routes/businesses';

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
  executeTakeFirst: jest.Mock;
  execute: jest.Mock;
};

// ─── Test app ─────────────────────────────────────────────────────────────────

const buildApp = (): Application => {
  const app = express();
  app.use(express.json());
  app.use('/businesses', businessesRouter);
  app.use(errorHandler);
  return app;
};

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockBusiness = {
  id: 'biz-uuid-1',
  name: 'Барбершоп Грозный',
  address: 'ул. Ленина 1',
  phone: '+79001234567',
  photos: [],
  working_hours: { mon: '09:00-18:00' },
  instagram_url: null,
  website_url: null,
  category_id: 'cat-uuid-1',
  category_name_ru: 'Барберы',
  category_name_ce: 'Барберш',
  category_icon: 'barber',
  avg_rating: 4.5,
  review_count: 10,
  distance_m: null,
};

const mockBusinessDetail = {
  ...mockBusiness,
  portfolio_photos: [],
  reminder_settings: {},
  cancellation_threshold_minutes: 60,
  avg_rating: '4.50',
  review_count: '10',
};

const mockStaff = [{ id: 'staff-1', name: 'Ахмед', role: 'employee', avatar_url: null }];
const mockServices = [{ id: 'svc-1', name: 'Стрижка', price: 500, duration_minutes: 30 }];
const mockCount = { total: '7' };

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // resetAllMocks clears call history AND mock implementation queues (including Once)
  jest.resetAllMocks();

  // Re-initialize chainable methods (resetAllMocks clears mockReturnValue)
  const terminal = new Set(['executeTakeFirst', 'executeTakeFirstOrThrow', 'execute']);
  Object.keys(mockDb).forEach((key) => {
    if (!terminal.has(key)) {
      const fn = (mockDb as Record<string, jest.Mock | undefined>)[key];
      if (fn) fn.mockReturnValue(mockDb);
    }
  });

  // Default terminal resolutions
  mockDb.execute.mockResolvedValue([]);
  mockDb.executeTakeFirst.mockResolvedValue(undefined);
});

describe('GET /businesses', () => {
  it('returns list of businesses with pagination', async () => {
    mockDb.execute.mockResolvedValueOnce([mockBusiness]);
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockCount);

    const app = buildApp();
    const res = await request(app).get('/businesses');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(20);
    expect(res.body.pagination.total).toBe(7);
  });

  it('accepts query param and returns filtered results', async () => {
    mockDb.execute.mockResolvedValueOnce([mockBusiness]);
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockCount);

    const app = buildApp();
    const res = await request(app).get('/businesses?query=борода');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(mockDb.where).toHaveBeenCalled();
  });

  it('accepts lat/lng params for geo sort', async () => {
    mockDb.execute.mockResolvedValueOnce([{ ...mockBusiness, distance_m: 500 }]);
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockCount);

    const app = buildApp();
    const res = await request(app).get('/businesses?lat=43.317&lng=45.694');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });

  it('accepts category_id filter', async () => {
    mockDb.execute.mockResolvedValueOnce([mockBusiness]);
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockCount);

    const app = buildApp();
    const catId = '550e8400-e29b-41d4-a716-446655440000';
    const res = await request(app).get(`/businesses?category_id=${catId}`);

    expect(res.status).toBe(200);
    expect(mockDb.where).toHaveBeenCalled();
  });

  it('validates lat range — rejects invalid values', async () => {
    const app = buildApp();
    const res = await request(app).get('/businesses?lat=200');

    expect(res.status).toBe(400);
  });

  it('validates lng range — rejects invalid values', async () => {
    const app = buildApp();
    const res = await request(app).get('/businesses?lng=-500');

    expect(res.status).toBe(400);
  });

  it('applies default page and limit', async () => {
    mockDb.execute.mockResolvedValueOnce([]);
    mockDb.executeTakeFirst.mockResolvedValueOnce({ total: '0' });

    const app = buildApp();
    const res = await request(app).get('/businesses');

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(20);
  });

  it('respects custom page and limit', async () => {
    mockDb.execute.mockResolvedValueOnce([]);
    mockDb.executeTakeFirst.mockResolvedValueOnce({ total: '0' });

    const app = buildApp();
    const res = await request(app).get('/businesses?page=2&limit=10');

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.limit).toBe(10);
  });

  it('caps limit at 50', async () => {
    // No mock setup needed — Zod validation rejects before service is called
    const app = buildApp();
    const res = await request(app).get('/businesses?limit=100');

    expect(res.status).toBe(400); // Zod rejects > 50
  });
});

describe('GET /businesses/:id', () => {
  it('returns full business card with staff and services', async () => {
    // First call: business query
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockBusinessDetail);
    // Second: staff (via Promise.all execute[0])
    // Third: services (via Promise.all execute[1])
    // Fourth: insert event
    mockDb.execute
      .mockResolvedValueOnce(mockStaff)
      .mockResolvedValueOnce(mockServices)
      .mockResolvedValueOnce([]); // event insert

    const app = buildApp();
    const res = await request(app).get('/businesses/biz-uuid-1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', 'biz-uuid-1');
    expect(res.body).toHaveProperty('name', 'Барбершоп Грозный');
    expect(res.body).toHaveProperty('staff');
    expect(res.body).toHaveProperty('services');
    expect(Array.isArray(res.body.staff)).toBe(true);
    expect(Array.isArray(res.body.services)).toBe(true);
  });

  it('returns 404 for non-existent business', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(undefined);

    const app = buildApp();
    const res = await request(app).get('/businesses/non-existent-id');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('BUSINESS_NOT_FOUND');
  });

  it('returns category_name in ru by default', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockBusinessDetail);
    mockDb.execute
      .mockResolvedValueOnce(mockStaff)
      .mockResolvedValueOnce(mockServices)
      .mockResolvedValueOnce([]);

    const app = buildApp();
    const res = await request(app).get('/businesses/biz-uuid-1');

    expect(res.status).toBe(200);
    expect(res.body.category_name).toBe('Барберы');
  });

  it('returns category_name in ce when Accept-Language: ce', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockBusinessDetail);
    mockDb.execute
      .mockResolvedValueOnce(mockStaff)
      .mockResolvedValueOnce(mockServices)
      .mockResolvedValueOnce([]);

    const app = buildApp();
    const res = await request(app)
      .get('/businesses/biz-uuid-1')
      .set('Accept-Language', 'ce');

    expect(res.status).toBe(200);
    expect(res.body.category_name).toBe('Барберш');
  });
});
