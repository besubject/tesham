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

// ─── Mock config for JWT ──────────────────────────────────────────────────────

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
import businessRouter from '../routes/business';

// ─── Typed mock db ────────────────────────────────────────────────────────────

const mockDb = db as unknown as {
  selectFrom: jest.Mock;
  insertInto: jest.Mock;
  updateTable: jest.Mock;
  deleteFrom: jest.Mock;
  select: jest.Mock;
  selectAll: jest.Mock;
  where: jest.Mock;
  orderBy: jest.Mock;
  values: jest.Mock;
  returning: jest.Mock;
  set: jest.Mock;
  executeTakeFirst: jest.Mock;
  execute: jest.Mock;
};

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

const mockBusiness = {
  id: 'biz-1',
  name: 'Test Salon',
  category_id: 'cat-1',
  address: 'Test St 1',
  phone: '+70001234567',
  instagram_url: null,
  website_url: null,
  working_hours: {},
  photos: [],
  portfolio_photos: [],
  cancellation_threshold_minutes: 30,
  reminder_settings: {},
  is_active: true,
};

const mockAdminStaff = { id: 'staff-admin-1', role: 'admin' };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /business/profile', () => {
  it('returns profile for authenticated business user', async () => {
    mockDb.selectFrom.mockReturnValue(mockDb);
    mockDb.selectAll.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockBusiness);

    const app = buildApp();
    const res = await request(app)
      .get('/business/profile')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({ id: 'biz-1', name: 'Test Salon' });
  });

  it('returns 401 without token', async () => {
    const app = buildApp();
    const res = await request(app).get('/business/profile');
    expect(res.status).toBe(401);
  });

  it('returns 403 without businessId in token', async () => {
    const token = jwt.sign({ id: 'u1', phone: '+70001' }, 'test-secret');
    const app = buildApp();
    const res = await request(app)
      .get('/business/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('PATCH /business/profile', () => {
  it('admin can update profile', async () => {
    mockDb.selectFrom.mockReturnValue(mockDb);
    mockDb.select.mockReturnValue(mockDb);
    mockDb.selectAll.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.set.mockReturnValue(mockDb);
    mockDb.updateTable.mockReturnValue(mockDb);
    // 1st call: requireAdmin → staff lookup
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockAdminStaff);
    // 2nd call: updateTable execute → void
    mockDb.execute.mockResolvedValueOnce([]);
    // 3rd call: getProfile after update
    mockDb.executeTakeFirst.mockResolvedValueOnce({ ...mockBusiness, name: 'New Name' });

    const app = buildApp();
    const res = await request(app)
      .patch('/business/profile')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.profile.name).toBe('New Name');
  });

  it('employee cannot update profile (403)', async () => {
    mockDb.selectFrom.mockReturnValue(mockDb);
    mockDb.select.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    // requireAdmin returns employee role
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: 'staff-emp-1', role: 'employee' });

    const app = buildApp();
    const res = await request(app)
      .patch('/business/profile')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ name: 'New Name' });

    expect(res.status).toBe(403);
  });
});

describe('GET /business/staff', () => {
  it('returns staff list', async () => {
    const mockStaffRows = [
      {
        id: 'staff-1',
        name: 'Alice',
        role: 'admin',
        avatar_url: null,
        is_active: true,
        user_id: 'u1',
        phone: '+70001',
      },
    ];

    mockDb.selectFrom.mockReturnValue(mockDb);
    mockDb.select.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.orderBy.mockReturnValue(mockDb);
    mockDb.execute.mockResolvedValueOnce(mockStaffRows);

    const app = buildApp();
    const res = await request(app)
      .get('/business/staff')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.staff).toHaveLength(1);
    expect(res.body.staff[0].name).toBe('Alice');
  });
});

describe('POST /business/staff', () => {
  it('admin can add staff member', async () => {
    mockDb.selectFrom.mockReturnValue(mockDb);
    mockDb.select.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.values.mockReturnValue(mockDb);
    mockDb.returning.mockReturnValue(mockDb);
    mockDb.insertInto.mockReturnValue(mockDb);
    // requireAdmin check
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockAdminStaff);
    // user lookup by phone
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: 'new-user', phone: '+70009999999' });
    // existing staff check
    mockDb.executeTakeFirst.mockResolvedValueOnce(undefined);
    // insert
    mockDb.execute.mockResolvedValueOnce([
      {
        id: 'new-staff-id',
        name: 'Bob',
        role: 'employee',
        avatar_url: null,
        is_active: true,
        user_id: 'new-user',
      },
    ]);

    const app = buildApp();
    const res = await request(app)
      .post('/business/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bob', phone: '+70009999999', role: 'employee' });

    expect(res.status).toBe(201);
    expect(res.body.staff.name).toBe('Bob');
  });

  it('employee cannot add staff (403)', async () => {
    mockDb.selectFrom.mockReturnValue(mockDb);
    mockDb.select.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: 'staff-emp-1', role: 'employee' });

    const app = buildApp();
    const res = await request(app)
      .post('/business/staff')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ name: 'Bob', phone: '+70009999999', role: 'employee' });

    expect(res.status).toBe(403);
  });

  it('returns 409 if user already a staff member', async () => {
    mockDb.selectFrom.mockReturnValue(mockDb);
    mockDb.select.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    // requireAdmin
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockAdminStaff);
    // user lookup
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: 'existing-user', phone: '+70009999999' });
    // existing staff — already exists
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: 'existing-staff' });

    const app = buildApp();
    const res = await request(app)
      .post('/business/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Alice', phone: '+70009999999', role: 'employee' });

    expect(res.status).toBe(409);
  });

  it('returns 404 if user not found by phone', async () => {
    mockDb.selectFrom.mockReturnValue(mockDb);
    mockDb.select.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    // requireAdmin
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockAdminStaff);
    // user lookup — not found
    mockDb.executeTakeFirst.mockResolvedValueOnce(undefined);

    const app = buildApp();
    const res = await request(app)
      .post('/business/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Nobody', phone: '+70009999999', role: 'employee' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /business/staff/:id', () => {
  it('admin can delete staff member', async () => {
    mockDb.selectFrom.mockReturnValue(mockDb);
    mockDb.select.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.set.mockReturnValue(mockDb);
    mockDb.updateTable.mockReturnValue(mockDb);
    // requireAdmin
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockAdminStaff);
    // requestor staff id lookup (for self-check)
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: 'staff-admin-1' });
    // target staff exists
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: 'staff-to-delete' });
    // update execute
    mockDb.execute.mockResolvedValueOnce([]);

    const app = buildApp();
    const res = await request(app)
      .delete('/business/staff/staff-to-delete')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
  });

  it('employee cannot delete staff (403)', async () => {
    mockDb.selectFrom.mockReturnValue(mockDb);
    mockDb.select.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    // requireAdmin returns employee
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: 'staff-emp-1', role: 'employee' });

    const app = buildApp();
    const res = await request(app)
      .delete('/business/staff/some-staff-id')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(403);
  });
});

// ─── PATCH /business/reviews/:id ──────────────────────────────────────────────

const REVIEW_ID = 'rev-uuid-1';
const REPLY_TEXT = 'Спасибо за отзыв!';

describe('PATCH /business/reviews/:id', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    const terminal = new Set(['executeTakeFirst', 'executeTakeFirstOrThrow', 'execute', 'transaction']);
    Object.keys(mockDb).forEach((key) => {
      if (!terminal.has(key)) {
        const fn = (mockDb as Record<string, jest.Mock>)[key];
        if (fn) fn.mockReturnValue(mockDb);
      }
    });

    mockDb.execute.mockResolvedValue([]);
    mockDb.executeTakeFirst.mockResolvedValue(undefined);
  });

  it('admin can reply to a review', async () => {
    // review exists and belongs to business
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: REVIEW_ID });
    // update execute
    mockDb.execute.mockResolvedValueOnce([]);

    const app = buildApp();
    const res = await request(app)
      .patch(`/business/reviews/${REVIEW_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reply_text: REPLY_TEXT });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', REVIEW_ID);
    expect(res.body).toHaveProperty('reply_text', REPLY_TEXT);
    expect(res.body).toHaveProperty('reply_at');
  });

  it('returns 403 when employee tries to reply', async () => {
    const app = buildApp();
    const res = await request(app)
      .patch(`/business/reviews/${REVIEW_ID}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ reply_text: REPLY_TEXT });

    expect(res.status).toBe(403);
  });

  it('returns 401 when not authenticated', async () => {
    const app = buildApp();
    const res = await request(app)
      .patch(`/business/reviews/${REVIEW_ID}`)
      .send({ reply_text: REPLY_TEXT });

    expect(res.status).toBe(401);
  });

  it('returns 400 when reply_text is missing', async () => {
    const app = buildApp();
    const res = await request(app)
      .patch(`/business/reviews/${REVIEW_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 400 when reply_text is empty string', async () => {
    const app = buildApp();
    const res = await request(app)
      .patch(`/business/reviews/${REVIEW_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reply_text: '' });

    expect(res.status).toBe(400);
  });

  it('returns 404 when review not found or belongs to different business', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(undefined);

    const app = buildApp();
    const res = await request(app)
      .patch(`/business/reviews/nonexistent-review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reply_text: REPLY_TEXT });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('REVIEW_NOT_FOUND');
  });
});
