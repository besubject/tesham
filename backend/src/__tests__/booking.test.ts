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

// ─── Mock notification service ─────────────────────────────────────────────────

jest.mock('../services/notification.service', () => ({
  notificationService: {
    notifyBookingCreated: jest.fn().mockResolvedValue(undefined),
    notifyBookingCancelled: jest.fn().mockResolvedValue(undefined),
    notifyClientBookingConfirmed: jest.fn().mockResolvedValue(undefined),
    notifyClientBookingCancelledByBusiness: jest.fn().mockResolvedValue(undefined),
  },
}));

// ─── Mock DB ──────────────────────────────────────────────────────────────────

jest.mock('../db', () => {
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
import businessesRouter from '../routes/businesses';
import bookingsRouter from '../routes/bookings';
import { notificationService } from '../services/notification.service';

// ─── Typed mock db ────────────────────────────────────────────────────────────

const mockDb = db as unknown as {
  selectFrom: jest.Mock;
  insertInto: jest.Mock;
  updateTable: jest.Mock;
  innerJoin: jest.Mock;
  leftJoin: jest.Mock;
  select: jest.Mock;
  selectAll: jest.Mock;
  where: jest.Mock;
  orderBy: jest.Mock;
  limit: jest.Mock;
  offset: jest.Mock;
  set: jest.Mock;
  values: jest.Mock;
  returning: jest.Mock;
  executeTakeFirst: jest.Mock;
  executeTakeFirstOrThrow: jest.Mock;
  execute: jest.Mock;
  transaction: jest.Mock;
};

// ─── Test app ─────────────────────────────────────────────────────────────────

const buildApp = (): Application => {
  const app = express();
  app.use(express.json());
  app.use('/businesses', businessesRouter);
  app.use('/bookings', bookingsRouter);
  app.use(errorHandler);
  return app;
};

// ─── Auth helper ──────────────────────────────────────────────────────────────

function makeToken(userId: string = 'user-uuid-1'): string {
  return jwt.sign({ id: userId, phone: '+79001234567' }, 'test-secret', { expiresIn: '1h' });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BIZ_ID = 'biz-uuid-1';
const SLOT_ID = '550e8400-e29b-41d4-a716-446655440010';
const SERVICE_ID = '550e8400-e29b-41d4-a716-446655440020';
const STAFF_ID = '550e8400-e29b-41d4-a716-446655440030';
const BOOKING_ID = '550e8400-e29b-41d4-a716-446655440040';
const USER_ID = 'user-uuid-1';

const mockSlotRow = { id: SLOT_ID, is_booked: false, staff_id: STAFF_ID };
const mockStaffRow = { id: STAFF_ID, business_id: BIZ_ID };
const mockServiceRow = { id: SERVICE_ID, business_id: BIZ_ID };

const mockNewBooking = {
  id: BOOKING_ID,
  status: 'confirmed',
  business_id: BIZ_ID,
  staff_id: STAFF_ID,
  created_at: new Date('2026-04-05T10:00:00Z'),
};

const mockBookingDetail = {
  id: BOOKING_ID,
  status: 'confirmed',
  slot_date: '2026-04-10',
  slot_start_time: '10:00',
  service_name: 'Стрижка',
  service_price: 500,
  business_id: BIZ_ID,
  business_name: 'Барбер Шоп',
  staff_name: 'Ахмед',
  created_at: new Date('2026-04-05T10:00:00Z'),
  cancelled_at: null,
};

// ─── Setup ────────────────────────────────────────────────────────────────────

function reinitChainable(): void {
  mockDb.selectFrom.mockReturnValue(mockDb);
  mockDb.insertInto.mockReturnValue(mockDb);
  mockDb.updateTable.mockReturnValue(mockDb);
  mockDb.innerJoin.mockReturnValue(mockDb);
  mockDb.leftJoin.mockReturnValue(mockDb);
  mockDb.select.mockReturnValue(mockDb);
  mockDb.selectAll.mockReturnValue(mockDb);
  mockDb.where.mockReturnValue(mockDb);
  mockDb.orderBy.mockReturnValue(mockDb);
  mockDb.limit.mockReturnValue(mockDb);
  mockDb.offset.mockReturnValue(mockDb);
  mockDb.set.mockReturnValue(mockDb);
  mockDb.values.mockReturnValue(mockDb);
  mockDb.returning.mockReturnValue(mockDb);
  mockDb.execute.mockResolvedValue([]);
  mockDb.executeTakeFirst.mockResolvedValue(undefined);
  mockDb.transaction.mockReturnValue({
    execute: jest.fn().mockImplementation(async (fn: (trx: typeof mockDb) => unknown) => fn(mockDb)),
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  mockSqlFn.mockReturnValue(mockSqlResult);
  mockSqlResult.as.mockReturnThis();
  mockSqlExecute.mockResolvedValue({ rows: [] });
  reinitChainable();
  (notificationService.notifyBookingCreated as jest.Mock).mockResolvedValue(undefined);
  (notificationService.notifyBookingCancelled as jest.Mock).mockResolvedValue(undefined);
  (notificationService.notifyClientBookingConfirmed as jest.Mock).mockResolvedValue(undefined);
  (notificationService.notifyClientBookingCancelledByBusiness as jest.Mock).mockResolvedValue(
    undefined,
  );
});

// ─── GET /businesses/:id/slots ────────────────────────────────────────────────

describe('GET /businesses/:id/slots', () => {
  const mockSlotsRows = [
    {
      id: SLOT_ID,
      staff_id: STAFF_ID,
      staff_name: 'Ахмед',
      date: '2026-04-10',
      start_time: '10:00',
      is_booked: false,
    },
  ];

  it('returns available slots for a business', async () => {
    mockDb.execute.mockResolvedValueOnce(mockSlotsRows);

    const app = buildApp();
    const res = await request(app).get(`/businesses/${BIZ_ID}/slots`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('slots');
    expect(Array.isArray(res.body.slots)).toBe(true);
    expect(res.body.slots).toHaveLength(1);
  });

  it('returns empty array when no free slots', async () => {
    mockDb.execute.mockResolvedValueOnce([]);

    const app = buildApp();
    const res = await request(app).get(`/businesses/${BIZ_ID}/slots`);

    expect(res.status).toBe(200);
    expect(res.body.slots).toHaveLength(0);
  });

  it('rejects invalid date format', async () => {
    const app = buildApp();
    const res = await request(app).get(`/businesses/${BIZ_ID}/slots?date=not-a-date`);

    expect(res.status).toBe(400);
  });

  it('rejects invalid staff_id format', async () => {
    const app = buildApp();
    const res = await request(app).get(`/businesses/${BIZ_ID}/slots?staff_id=not-a-uuid`);

    expect(res.status).toBe(400);
  });
});

// ─── POST /bookings ───────────────────────────────────────────────────────────

describe('POST /bookings', () => {
  it('creates a booking and marks slot as booked', async () => {
    // 1. FOR UPDATE query returns free slot
    mockSqlExecute.mockResolvedValueOnce({ rows: [mockSlotRow] });
    // 2. staff lookup, 3. service lookup, 4. insert returning, 5. getBookingDetail
    mockDb.executeTakeFirst
      .mockResolvedValueOnce(mockStaffRow)
      .mockResolvedValueOnce(mockServiceRow)
      .mockResolvedValueOnce(mockNewBooking)
      .mockResolvedValueOnce(mockBookingDetail);

    const app = buildApp();
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`)
      .send({ slot_id: SLOT_ID, service_id: SERVICE_ID });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('booking');
    expect(res.body.booking.id).toBe(BOOKING_ID);
    expect(res.body.booking.status).toBe('confirmed');
  });

  it('returns 409 when slot is already booked', async () => {
    mockSqlExecute.mockResolvedValueOnce({ rows: [{ ...mockSlotRow, is_booked: true }] });

    const app = buildApp();
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`)
      .send({ slot_id: SLOT_ID, service_id: SERVICE_ID });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_ALREADY_BOOKED');
  });

  it('returns 404 when slot does not exist', async () => {
    mockSqlExecute.mockResolvedValueOnce({ rows: [] });

    const app = buildApp();
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`)
      .send({ slot_id: SLOT_ID, service_id: SERVICE_ID });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SLOT_NOT_FOUND');
  });

  it('returns 401 without auth token', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/bookings')
      .send({ slot_id: SLOT_ID, service_id: SERVICE_ID });

    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid body (missing slot_id)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`)
      .send({ service_id: SERVICE_ID });

    expect(res.status).toBe(400);
  });

  it('returns 400 for non-UUID slot_id', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`)
      .send({ slot_id: 'not-a-uuid', service_id: SERVICE_ID });

    expect(res.status).toBe(400);
  });
});

// ─── GET /bookings/my ─────────────────────────────────────────────────────────

describe('GET /bookings/my', () => {
  it('returns list of user bookings', async () => {
    mockDb.execute.mockResolvedValueOnce([mockBookingDetail]);

    const app = buildApp();
    const res = await request(app)
      .get('/bookings/my')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('bookings');
    expect(Array.isArray(res.body.bookings)).toBe(true);
    expect(res.body.bookings).toHaveLength(1);
  });

  it('returns empty list when user has no bookings', async () => {
    mockDb.execute.mockResolvedValueOnce([]);

    const app = buildApp();
    const res = await request(app)
      .get('/bookings/my')
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body.bookings).toHaveLength(0);
  });

  it('returns 401 without auth token', async () => {
    const app = buildApp();
    const res = await request(app).get('/bookings/my');

    expect(res.status).toBe(401);
  });
});

// ─── DELETE /bookings/:id ─────────────────────────────────────────────────────

describe('DELETE /bookings/:id', () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);
  const futureDateStr = futureDate.toISOString().slice(0, 10);

  const mockBookingRow = {
    id: BOOKING_ID,
    user_id: USER_ID,
    status: 'confirmed',
    slot_id: SLOT_ID,
    slot_date: futureDateStr,
    start_time: '23:59',
    cancellation_threshold_minutes: 60,
  };

  it('cancels a confirmed booking and frees the slot', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockBookingRow);

    const app = buildApp();
    const res = await request(app)
      .delete(`/bookings/${BOOKING_ID}`)
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).not.toHaveProperty('warning');
  });

  it('returns warning when cancelling within threshold', async () => {
    const soonDate = new Date();
    soonDate.setMinutes(soonDate.getMinutes() + 30); // 30 min from now, threshold is 60
    const soonDateStr = soonDate.toISOString().slice(0, 10);
    const soonTime = `${String(soonDate.getHours()).padStart(2, '0')}:${String(soonDate.getMinutes()).padStart(2, '0')}`;

    mockDb.executeTakeFirst.mockResolvedValueOnce({
      ...mockBookingRow,
      slot_date: soonDateStr,
      start_time: soonTime,
      cancellation_threshold_minutes: 60,
    });

    const app = buildApp();
    const res = await request(app)
      .delete(`/bookings/${BOOKING_ID}`)
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('warning');
    expect(typeof res.body.warning).toBe('string');
  });

  it('returns 404 when booking does not exist', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(undefined);

    const app = buildApp();
    const res = await request(app)
      .delete(`/bookings/${BOOKING_ID}`)
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('BOOKING_NOT_FOUND');
  });

  it('returns 403 when booking belongs to another user', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({
      ...mockBookingRow,
      user_id: 'other-user-id',
    });

    const app = buildApp();
    const res = await request(app)
      .delete(`/bookings/${BOOKING_ID}`)
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 400 when booking is already cancelled', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({
      ...mockBookingRow,
      status: 'cancelled',
    });

    const app = buildApp();
    const res = await request(app)
      .delete(`/bookings/${BOOKING_ID}`)
      .set('Authorization', `Bearer ${makeToken(USER_ID)}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BOOKING_NOT_CANCELLABLE');
  });

  it('returns 401 without auth token', async () => {
    const app = buildApp();
    const res = await request(app).delete(`/bookings/${BOOKING_ID}`);

    expect(res.status).toBe(401);
  });
});
