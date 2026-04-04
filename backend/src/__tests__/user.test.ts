import request from 'supertest';
import jwt from 'jsonwebtoken';
import express, { Application } from 'express';

// ─── Mock DB (must be before imports that use db) ─────────────────────────────

jest.mock('../db', () => {
  const chainable = {
    selectFrom: jest.fn(),
    insertInto: jest.fn(),
    updateTable: jest.fn(),
    deleteFrom: jest.fn(),
    selectAll: jest.fn(),
    select: jest.fn(),
    where: jest.fn(),
    set: jest.fn(),
    values: jest.fn(),
    returningAll: jest.fn(),
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
import userRouter from '../routes/user';
import { config } from '../config';

// ─── Typed mock db reference ──────────────────────────────────────────────────

const mockDb = db as unknown as {
  selectFrom: jest.Mock;
  insertInto: jest.Mock;
  updateTable: jest.Mock;
  deleteFrom: jest.Mock;
  selectAll: jest.Mock;
  select: jest.Mock;
  where: jest.Mock;
  set: jest.Mock;
  values: jest.Mock;
  returningAll: jest.Mock;
  executeTakeFirst: jest.Mock;
  execute: jest.Mock;
};

// ─── Test app ─────────────────────────────────────────────────────────────────

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/user', userRouter);
  app.use(errorHandler);
  return app;
}

function makeToken(userId = 'user-123', phone = '+79001234567'): string {
  return jwt.sign({ id: userId, phone }, config.jwt.accessSecret, { expiresIn: '1h' });
}

const mockUser = {
  id: 'user-123',
  phone: '+79001234567',
  name: 'Ахмед',
  language: 'ru' as const,
  created_at: new Date('2026-04-04'),
};

// ─── Reset mocks ──────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.executeTakeFirst.mockResolvedValue(undefined);
  mockDb.execute.mockResolvedValue([]);

  // Default: all chainable methods return chainable
  const chainable = mockDb as unknown as Record<string, jest.Mock>;
  ['selectFrom', 'insertInto', 'updateTable', 'deleteFrom', 'selectAll', 'select', 'where', 'set', 'values', 'returningAll'].forEach((k) => {
    (chainable[k] as jest.Mock | undefined)?.mockReturnValue(mockDb);
  });
});

// ─── GET /user/me ─────────────────────────────────────────────────────────────

describe('GET /user/me', () => {
  it('returns 401 without token', async () => {
    const app = buildApp();
    const res = await request(app).get('/user/me');
    expect(res.status).toBe(401);
  });

  it('returns user with valid token', async () => {
    mockDb.executeTakeFirst.mockResolvedValue(mockUser);

    const app = buildApp();
    const res = await request(app)
      .get('/user/me')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('user-123');
    expect(res.body.phone).toBe('+79001234567');
    expect(res.body.name).toBe('Ахмед');
    expect(res.body.language).toBe('ru');
  });

  it('returns 404 if user not found in DB', async () => {
    mockDb.executeTakeFirst.mockResolvedValue(undefined);

    const app = buildApp();
    const res = await request(app)
      .get('/user/me')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });
});

// ─── PATCH /user/me ───────────────────────────────────────────────────────────

describe('PATCH /user/me', () => {
  it('returns 401 without token', async () => {
    const app = buildApp();
    const res = await request(app).patch('/user/me').send({ name: 'Магомед' });
    expect(res.status).toBe(401);
  });

  it('updates name successfully', async () => {
    const updatedUser = { ...mockUser, name: 'Магомед' };
    mockDb.executeTakeFirst.mockResolvedValue(updatedUser);

    const app = buildApp();
    const res = await request(app)
      .patch('/user/me')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ name: 'Магомед' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Магомед');
  });

  it('updates language to ce', async () => {
    const updatedUser = { ...mockUser, language: 'ce' as const };
    mockDb.executeTakeFirst.mockResolvedValue(updatedUser);

    const app = buildApp();
    const res = await request(app)
      .patch('/user/me')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ language: 'ce' });

    expect(res.status).toBe(200);
    expect(res.body.language).toBe('ce');
  });

  it('returns 400 for invalid language', async () => {
    const app = buildApp();
    const res = await request(app)
      .patch('/user/me')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ language: 'fr' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for unknown fields (strict schema)', async () => {
    const app = buildApp();
    const res = await request(app)
      .patch('/user/me')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ phone: '+79999999999' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for empty name', async () => {
    const app = buildApp();
    const res = await request(app)
      .patch('/user/me')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ name: '' });

    expect(res.status).toBe(400);
  });
});

// ─── DELETE /user/me ──────────────────────────────────────────────────────────

describe('DELETE /user/me', () => {
  it('returns 401 without token', async () => {
    const app = buildApp();
    const res = await request(app).delete('/user/me');
    expect(res.status).toBe(401);
  });

  it('deletes user and returns 204', async () => {
    // First call: selectFrom('users') for existence check → user found
    mockDb.executeTakeFirst.mockResolvedValue({ id: 'user-123' });

    const app = buildApp();
    const res = await request(app)
      .delete('/user/me')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(204);
  });

  it('returns 404 if user does not exist', async () => {
    mockDb.executeTakeFirst.mockResolvedValue(undefined);

    const app = buildApp();
    const res = await request(app)
      .delete('/user/me')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(404);
  });
});
