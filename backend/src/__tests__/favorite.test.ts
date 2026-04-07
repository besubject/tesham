import request from 'supertest';
import express, { Application } from 'express';
import jwt from 'jsonwebtoken';

// ─── sql mock helpers ─────────────────────────────────────────────────────────

const mockSqlExecute = jest.fn().mockResolvedValue({ rows: [] });
const mockSqlResult = {
  execute: mockSqlExecute,
  as: jest.fn().mockReturnThis(),
};
const mockSqlFn = jest.fn().mockReturnValue(mockSqlResult);

jest.mock('kysely', () => ({ sql: mockSqlFn }));

// ─── Mock DB ──────────────────────────────────────────────────────────────────

jest.mock('../db', () => {
  const chainable = {
    selectFrom: jest.fn(),
    insertInto: jest.fn(),
    updateTable: jest.fn(),
    deleteFrom: jest.fn(),
    innerJoin: jest.fn(),
    leftJoin: jest.fn(),
    select: jest.fn(),
    selectAll: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    offset: jest.fn(),
    set: jest.fn(),
    values: jest.fn(),
    returning: jest.fn(),
    executeTakeFirst: jest.fn(),
    executeTakeFirstOrThrow: jest.fn(),
    execute: jest.fn(),
    transaction: jest.fn(),
  };

  const terminal = new Set([
    'executeTakeFirst',
    'executeTakeFirstOrThrow',
    'execute',
    'transaction',
  ]);

  Object.keys(chainable).forEach((key) => {
    if (!terminal.has(key)) {
      const fn = (chainable as Record<string, jest.Mock>)[key];
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
import favoritesRouter from '../routes/favorites';

// ─── Typed mock db ────────────────────────────────────────────────────────────

const mockDb = db as unknown as {
  selectFrom: jest.Mock;
  insertInto: jest.Mock;
  deleteFrom: jest.Mock;
  innerJoin: jest.Mock;
  leftJoin: jest.Mock;
  select: jest.Mock;
  where: jest.Mock;
  orderBy: jest.Mock;
  values: jest.Mock;
  returning: jest.Mock;
  executeTakeFirst: jest.Mock;
  execute: jest.Mock;
};

// ─── Test app ─────────────────────────────────────────────────────────────────

const buildApp = (): Application => {
  const app = express();
  app.use(express.json());
  app.use('/favorites', favoritesRouter);
  app.use(errorHandler);
  return app;
};

// ─── Auth helper ──────────────────────────────────────────────────────────────

function makeToken(userId: string = 'user-uuid-1'): string {
  return jwt.sign({ id: userId, phone: '+79001234567' }, 'test-secret', { expiresIn: '1h' });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-1';
const BIZ_ID = '550e8400-e29b-41d4-a716-446655440001';
const STAFF_ID = '550e8400-e29b-41d4-a716-446655440002';
const FAV_ID = '550e8400-e29b-41d4-a716-446655440099';

// ─── Setup ────────────────────────────────────────────────────────────────────

function reinitChainable(): void {
  mockDb.selectFrom.mockReturnValue(mockDb);
  mockDb.insertInto.mockReturnValue(mockDb);
  mockDb.deleteFrom.mockReturnValue(mockDb);
  mockDb.innerJoin.mockReturnValue(mockDb);
  mockDb.leftJoin.mockReturnValue(mockDb);
  mockDb.select.mockReturnValue(mockDb);
  mockDb.where.mockReturnValue(mockDb);
  mockDb.orderBy.mockReturnValue(mockDb);
  mockDb.values.mockReturnValue(mockDb);
  mockDb.returning.mockReturnValue(mockDb);
  mockDb.execute.mockResolvedValue([]);
  mockDb.executeTakeFirst.mockResolvedValue(undefined);
}

beforeEach(() => {
  jest.resetAllMocks();
  mockSqlFn.mockReturnValue(mockSqlResult);
  mockSqlResult.as.mockReturnThis();
  mockSqlExecute.mockResolvedValue({ rows: [] });
  reinitChainable();
});

// ─── GET /favorites ───────────────────────────────────────────────────────────

describe('GET /favorites', () => {
  it('returns favorites list for authenticated user', async () => {
    const mockBusinessRows = [
      {
        id: FAV_ID,
        business_id: BIZ_ID,
        business_name: 'Барбер Шоп',
        business_address: 'ул. Пушкина, 1',
        business_phone: '+79001234567',
        category_name_ru: 'Барбершопы',
        category_name_ce: 'Барбершопаш',
        created_at: new Date('2026-04-01'),
      },
    ];

    // getFavorites calls execute twice: businesses and staff
    mockDb.execute
      .mockResolvedValueOnce(mockBusinessRows)
      .mockResolvedValueOnce([]);

    const app = buildApp();
    const res = await request(app)
      .get('/favorites')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('businesses');
    expect(res.body).toHaveProperty('staff');
    expect(Array.isArray(res.body.businesses)).toBe(true);
    expect(res.body.businesses).toHaveLength(1);
    expect(res.body.businesses[0].business_id).toBe(BIZ_ID);
  });

  it('returns empty lists when no favorites', async () => {
    mockDb.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const app = buildApp();
    const res = await request(app)
      .get('/favorites')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body.businesses).toHaveLength(0);
    expect(res.body.staff).toHaveLength(0);
  });

  it('returns 401 without auth token', async () => {
    const app = buildApp();
    const res = await request(app).get('/favorites');

    expect(res.status).toBe(401);
  });
});

// ─── POST /favorites ──────────────────────────────────────────────────────────

describe('POST /favorites', () => {
  const mockCreatedFavorite = {
    id: FAV_ID,
    user_id: USER_ID,
    business_id: BIZ_ID,
    staff_id: null,
    created_at: new Date('2026-04-01'),
  };

  it('adds a business to favorites', async () => {
    // business exists check
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: BIZ_ID });
    // uniqueness check — not found
    mockDb.executeTakeFirst.mockResolvedValueOnce(undefined);
    // insert returning
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockCreatedFavorite);

    const app = buildApp();
    const res = await request(app)
      .post('/favorites')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`)
      .send({ business_id: BIZ_ID });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('favorite');
    expect(res.body.favorite.business_id).toBe(BIZ_ID);
  });

  it('adds a staff member to favorites', async () => {
    const mockStaffFavorite = { ...mockCreatedFavorite, business_id: null, staff_id: STAFF_ID };
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: STAFF_ID });
    mockDb.executeTakeFirst.mockResolvedValueOnce(undefined);
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockStaffFavorite);

    const app = buildApp();
    const res = await request(app)
      .post('/favorites')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`)
      .send({ staff_id: STAFF_ID });

    expect(res.status).toBe(201);
    expect(res.body.favorite.staff_id).toBe(STAFF_ID);
  });

  it('returns 409 when favorite already exists', async () => {
    // business exists
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: BIZ_ID });
    // uniqueness check — already exists
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: FAV_ID });

    const app = buildApp();
    const res = await request(app)
      .post('/favorites')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`)
      .send({ business_id: BIZ_ID });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('FAVORITE_ALREADY_EXISTS');
  });

  it('returns 404 when business does not exist', async () => {
    // business not found
    mockDb.executeTakeFirst.mockResolvedValueOnce(undefined);

    const app = buildApp();
    const res = await request(app)
      .post('/favorites')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`)
      .send({ business_id: BIZ_ID });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('BUSINESS_NOT_FOUND');
  });

  it('returns 400 when neither business_id nor staff_id provided', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/favorites')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 400 when both business_id and staff_id provided', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/favorites')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`)
      .send({ business_id: BIZ_ID, staff_id: STAFF_ID });

    expect(res.status).toBe(400);
  });

  it('returns 400 for non-UUID business_id', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/favorites')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`)
      .send({ business_id: 'not-a-uuid' });

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    const app = buildApp();
    const res = await request(app).post('/favorites').send({ business_id: BIZ_ID });

    expect(res.status).toBe(401);
  });
});

// ─── DELETE /favorites/:id ────────────────────────────────────────────────────

describe('DELETE /favorites/:id', () => {
  it('removes a favorite successfully', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({
      id: FAV_ID,
      user_id: USER_ID,
      business_id: BIZ_ID,
      staff_id: null,
    });
    mockDb.execute.mockResolvedValueOnce([]);
    // event tracking insert (fire-and-forget) — also execute
    mockDb.execute.mockResolvedValueOnce([]);

    const app = buildApp();
    const res = await request(app)
      .delete(`/favorites/${FAV_ID}`)
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`);

    expect(res.status).toBe(204);
  });

  it('returns 404 when favorite does not exist', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(undefined);

    const app = buildApp();
    const res = await request(app)
      .delete(`/favorites/${FAV_ID}`)
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('FAVORITE_NOT_FOUND');
  });

  it('returns 403 when favorite belongs to another user', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({
      id: FAV_ID,
      user_id: 'other-user-id',
      business_id: BIZ_ID,
      staff_id: null,
    });

    const app = buildApp();
    const res = await request(app)
      .delete(`/favorites/${FAV_ID}`)
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 401 without auth token', async () => {
    const app = buildApp();
    const res = await request(app).delete(`/favorites/${FAV_ID}`);

    expect(res.status).toBe(401);
  });
});
