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
  const chainable: Record<string, jest.Mock> = {
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
    groupBy: jest.fn(),
  };

  const terminal = new Set([
    'executeTakeFirst',
    'executeTakeFirstOrThrow',
    'execute',
    'transaction',
  ]);

  Object.keys(chainable).forEach((key) => {
    if (!terminal.has(key)) {
      chainable[key]?.mockReturnValue(chainable);
    }
  });

  return { db: chainable };
});

// ─── Mock track-event ─────────────────────────────────────────────────────────

jest.mock('../utils/track-event', () => ({ trackEvent: jest.fn() }));

// ─── Mock notification service ────────────────────────────────────────────────

jest.mock('../services/notification.service', () => ({
  notificationService: {
    notifyBookingCreated: jest.fn(),
    notifyBookingCancelled: jest.fn(),
    notifyClientBookingCancelledByBusiness: jest.fn(),
  },
}));

// ─── Mock config ──────────────────────────────────────────────────────────────

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
    smsru: { apiId: null },
  },
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { db } from '../db';
import { errorHandler } from '../middleware/error';
import businessRouter from '../routes/business';

// ─── Typed mock db ────────────────────────────────────────────────────────────

const mockDb = db as unknown as Record<string, jest.Mock>;

function getMock(name: string): jest.Mock {
  const mock = mockDb[name];
  if (!mock) {
    throw new Error(`Mock "${name}" is not configured`);
  }
  return mock;
}

// ─── Test app ─────────────────────────────────────────────────────────────────

const buildApp = (): Application => {
  const app = express();
  app.use(express.json());
  app.use('/business', businessRouter);
  app.use(errorHandler);
  return app;
};

const ADMIN_PAYLOAD = {
  id: 'user-admin-1',
  phone: '+79001234567',
  role: 'admin',
  businessId: 'biz-1',
};

const EMPLOYEE_PAYLOAD = {
  id: 'user-emp-1',
  phone: '+79001234568',
  role: 'employee',
  businessId: 'biz-1',
};

const adminToken = jwt.sign(ADMIN_PAYLOAD, 'test-secret', { expiresIn: '1h' });
const employeeToken = jwt.sign(EMPLOYEE_PAYLOAD, 'test-secret', { expiresIn: '1h' });

const STAFF_ADMIN_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const STAFF_EMP_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

const mockAdminStaff = { id: STAFF_ADMIN_ID, role: 'admin' };
const mockEmployeeStaff = { id: STAFF_EMP_ID, role: 'employee' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setupChain(): void {
  // All chainable methods return the mock db itself
  for (const key of Object.keys(mockDb)) {
    const terminal = new Set(['executeTakeFirst', 'executeTakeFirstOrThrow', 'execute', 'transaction']);
    if (!terminal.has(key)) {
      mockDb[key]?.mockReturnValue(mockDb);
    }
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /business/stats', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockSqlExecute.mockResolvedValue({ rows: [] });
    mockSqlResult.as.mockReturnThis();
    mockSqlFn.mockReturnValue(mockSqlResult);
    setupChain();
  });

  it('returns 401 without token', async () => {
    const app = buildApp();
    const res = await request(app).get('/business/stats?period=week');
    expect(res.status).toBe(401);
  });

  it('returns 403 without businessId in token', async () => {
    const token = jwt.sign({ id: 'u1', phone: '+70001' }, 'test-secret');
    const app = buildApp();
    const res = await request(app)
      .get('/business/stats?period=week')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid period', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/business/stats?period=year')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('admin gets full stats for week period', async () => {
    setupChain();

    // Call 1: resolveStaff
    getMock('executeTakeFirst')
      .mockResolvedValueOnce(mockAdminStaff)
      // Call 2: booking agg
      // (execute returns array)
      // Call 3: rating
      .mockResolvedValueOnce({ avg_rating: '4.5' });

    // execute for booking agg → array of status/source rows
    getMock('execute')
      .mockResolvedValueOnce([
        { status: 'completed', source: 'app', cnt: '5' },
        { status: 'no_show', source: 'walk_in', cnt: '1' },
        { status: 'confirmed', source: 'app', cnt: '3' },
      ])
      // execute for by_staff agg
      .mockResolvedValueOnce([
        { staff_id: 'staff-admin-1', staff_name: 'Alice', status: 'completed', cnt: '5' },
        { staff_id: 'staff-admin-1', staff_name: 'Alice', status: 'no_show', cnt: '1' },
      ]);

    const app = buildApp();
    const res = await request(app)
      .get('/business/stats?period=week')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const { stats } = res.body as { stats: Record<string, unknown> };
    expect(stats['period']).toBe('week');
    expect(stats['bookings_count']).toBe(9);
    expect(stats['avg_rating']).toBe(4.5);
    expect(stats['show_rate_pct']).toBe(83.3);
    expect(stats['by_source']).toEqual({ app: 8, walk_in: 1 });
    expect(Array.isArray(stats['by_staff'])).toBe(true);
  });

  it('employee sees only their own stats', async () => {
    setupChain();

    // resolveStaff → employee
    getMock('executeTakeFirst')
      .mockResolvedValueOnce(mockEmployeeStaff)
      .mockResolvedValueOnce({ avg_rating: '4.0' });

    // booking agg for employee (filtered by staff_id)
    getMock('execute')
      .mockResolvedValueOnce([
        { status: 'completed', source: 'app', cnt: '2' },
      ])
      // by_staff is NOT computed for employee (no second execute needed)
      .mockResolvedValueOnce([]);

    const app = buildApp();
    const res = await request(app)
      .get('/business/stats?period=month')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    const { stats } = res.body as { stats: Record<string, unknown> };
    expect(stats['period']).toBe('month');
    // Employee: by_staff is empty (not returned for single-staff view)
    expect(stats['by_staff']).toEqual([]);
  });

  it('admin can filter by staff_id', async () => {
    setupChain();

    getMock('executeTakeFirst')
      .mockResolvedValueOnce(mockAdminStaff)
      .mockResolvedValueOnce({ avg_rating: null });

    getMock('execute')
      .mockResolvedValueOnce([
        { status: 'confirmed', source: 'walk_in', cnt: '1' },
      ])
      .mockResolvedValueOnce([]);

    const app = buildApp();
    const res = await request(app)
      .get(`/business/stats?period=day&staff_id=${STAFF_ADMIN_ID}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const { stats } = res.body as { stats: Record<string, unknown> };
    expect(stats['period']).toBe('day');
    expect(stats['avg_rating']).toBeNull();
  });

  it('defaults to week period when period is omitted', async () => {
    setupChain();

    getMock('executeTakeFirst')
      .mockResolvedValueOnce(mockAdminStaff)
      .mockResolvedValueOnce({ avg_rating: null });

    getMock('execute')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const app = buildApp();
    const res = await request(app)
      .get('/business/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.stats.period).toBe('week');
  });

  it('includes cancelled bookings in show rate denominator', async () => {
    setupChain();

    getMock('executeTakeFirst')
      .mockResolvedValueOnce(mockAdminStaff)
      .mockResolvedValueOnce({ avg_rating: null });

    getMock('execute')
      .mockResolvedValueOnce([
        { status: 'completed', source: 'app', cnt: '1' },
        { status: 'cancelled', source: 'app', cnt: '2' },
      ])
      .mockResolvedValueOnce([
        { staff_id: 'staff-admin-1', staff_name: 'Alice', status: 'completed', cnt: '1' },
        { staff_id: 'staff-admin-1', staff_name: 'Alice', status: 'cancelled', cnt: '2' },
      ]);

    const app = buildApp();
    const res = await request(app)
      .get('/business/stats?period=week')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const { stats } = res.body as { stats: Record<string, unknown> };
    expect(stats['show_rate_pct']).toBe(33.3);

    const byStaff = stats['by_staff'] as Array<Record<string, unknown>>;
    expect(byStaff[0]?.['show_rate_pct']).toBe(33.3);
  });

  it('returns 403 if user is not a staff member of the business', async () => {
    setupChain();

    // resolveStaff returns null → not a staff member
    getMock('executeTakeFirst').mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app)
      .get('/business/stats?period=week')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(403);
  });
});
