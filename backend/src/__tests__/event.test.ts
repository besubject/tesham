import request from 'supertest';
import express, { Application } from 'express';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

// ─── Mock DB ──────────────────────────────────────────────────────────────────

const mockExecute = jest.fn().mockResolvedValue([]);

const chainable = {
  selectFrom: jest.fn(),
  insertInto: jest.fn(),
  updateTable: jest.fn(),
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
  execute: mockExecute,
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

jest.mock('../db', () => ({ db: chainable }));

// ─── Mock config ──────────────────────────────────────────────────────────────

const TEST_SALT = 'test-analytics-salt';
const TEST_USER_ID = 'user-uuid-test-1';

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
    analyticsSalt: 'test-analytics-salt',
  },
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { db } from '../db';
import { errorHandler } from '../middleware/error';
import eventsRouter from '../routes/events';

// ─── Test app ─────────────────────────────────────────────────────────────────

const buildApp = (): Application => {
  const app = express();
  app.use(express.json());
  app.use('/events', eventsRouter);
  app.use(errorHandler);
  return app;
};

function makeToken(userId: string = TEST_USER_ID): string {
  return jwt.sign({ id: userId, phone: '+79001234567' }, 'test-secret', { expiresIn: '1h' });
}

const mockDb = db as unknown as {
  insertInto: jest.Mock;
  values: jest.Mock;
  execute: jest.Mock;
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /events', () => {
  let app: Application;

  beforeEach(() => {
    app = buildApp();
    jest.resetAllMocks();
    Object.keys(chainable).forEach((key) => {
      if (!terminal.has(key)) {
        const fn = (chainable as Record<string, jest.Mock>)[key];
        if (fn) fn.mockReturnValue(chainable);
      }
    });
    mockExecute.mockResolvedValue([]);
  });

  it('creates event record and returns 202', async () => {
    const res = await request(app)
      .post('/events')
      .send({
        event_type: 'test_event',
        payload: { foo: 'bar' },
        device_type: 'ios',
        app_version: '1.0.0',
      });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ ok: true });
    expect(mockDb.insertInto).toHaveBeenCalledWith('events');
  });

  it('creates event with session_id and lat/lng', async () => {
    const res = await request(app)
      .post('/events')
      .send({
        event_type: 'search_query',
        payload: { query: 'барбер' },
        session_id: 'sess-123',
        lat: 43.317,
        lng: 45.694,
      });

    expect(res.status).toBe(202);
    expect(mockDb.insertInto).toHaveBeenCalledWith('events');
    const valuesCall = mockDb.values.mock.calls[0][0] as Record<string, unknown>;
    expect(valuesCall['session_id']).toBe('sess-123');
    expect(valuesCall['lat']).toBe('43.317');
    expect(valuesCall['lng']).toBe('45.694');
  });

  it('computes anonymous_user_hash from user_id — hash does not contain raw user_id', async () => {
    await request(app)
      .post('/events')
      .set('Authorization', `Bearer ${makeToken(TEST_USER_ID)}`)
      .send({
        event_type: 'business_card_view',
        payload: { business_id: 'biz-1' },
      });

    expect(mockDb.insertInto).toHaveBeenCalledWith('events');
    const valuesCall = mockDb.values.mock.calls[0][0] as Record<string, unknown>;
    const expectedHash = createHash('sha256')
      .update(TEST_USER_ID + TEST_SALT)
      .digest('hex');

    expect(valuesCall['anonymous_user_hash']).toBe(expectedHash);
    expect(valuesCall['anonymous_user_hash']).not.toContain(TEST_USER_ID);
    expect(valuesCall['user_id']).toBe(TEST_USER_ID);
  });

  it('sets anonymous_user_hash to null when no auth', async () => {
    await request(app)
      .post('/events')
      .send({ event_type: 'page_view' });

    const valuesCall = mockDb.values.mock.calls[0][0] as Record<string, unknown>;
    expect(valuesCall['anonymous_user_hash']).toBeNull();
    expect(valuesCall['user_id']).toBeNull();
  });

  it('returns 400 for missing event_type', async () => {
    const res = await request(app)
      .post('/events')
      .send({ payload: { foo: 'bar' } });

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid lat range', async () => {
    const res = await request(app)
      .post('/events')
      .send({ event_type: 'test', lat: 200 });

    expect(res.status).toBe(400);
  });
});

describe('trackEvent — automatic event logging', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    Object.keys(chainable).forEach((key) => {
      if (!terminal.has(key)) {
        const fn = (chainable as Record<string, jest.Mock>)[key];
        if (fn) fn.mockReturnValue(chainable);
      }
    });
    mockExecute.mockResolvedValue([]);
  });

  it('booking_complete logged on booking creation', async () => {
    const { trackEvent } = await import('../utils/track-event');

    trackEvent({
      event_type: 'booking_complete',
      payload: { booking_id: 'bkng-1', business_id: 'biz-1' },
      user_id: TEST_USER_ID,
    });

    expect(mockDb.insertInto).toHaveBeenCalledWith('events');
    const valuesCall = mockDb.values.mock.calls[0][0] as Record<string, unknown>;
    expect(valuesCall['event_type']).toBe('booking_complete');
  });

  it('booking_cancel logged on booking cancellation', async () => {
    const { trackEvent } = await import('../utils/track-event');

    trackEvent({
      event_type: 'booking_cancel',
      payload: { booking_id: 'bkng-1', within_threshold: false },
      user_id: TEST_USER_ID,
    });

    expect(mockDb.insertInto).toHaveBeenCalledWith('events');
    const valuesCall = mockDb.values.mock.calls[0][0] as Record<string, unknown>;
    expect(valuesCall['event_type']).toBe('booking_cancel');
  });
});
