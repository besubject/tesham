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
    notifyNewChatMessage: jest.fn().mockResolvedValue(undefined),
    notifyBookingCreated: jest.fn().mockResolvedValue(undefined),
    notifyBookingCancelled: jest.fn().mockResolvedValue(undefined),
    notifyClientBookingConfirmed: jest.fn().mockResolvedValue(undefined),
    notifyClientBookingCancelledByBusiness: jest.fn().mockResolvedValue(undefined),
  },
}));

// ─── Mock track-event ──────────────────────────────────────────────────────────

jest.mock('../utils/track-event', () => ({ trackEvent: jest.fn() }));

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
    analyticsSalt: 'test-salt',
  },
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { db } from '../db';
import { errorHandler } from '../middleware/error';
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
  app.use('/bookings', bookingsRouter);
  app.use(errorHandler);
  return app;
};

// ─── Auth helpers ──────────────────────────────────────────────────────────────

function makeToken(userId: string): string {
  return jwt.sign({ id: userId, phone: '+79001234567' }, 'test-secret', { expiresIn: '1h' });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BOOKING_ID = '550e8400-e29b-41d4-a716-446655440040';
const CLIENT_ID = 'client-user-uuid-1';
const STAFF_USER_ID = 'staff-user-uuid-2';
const ADMIN_USER_ID = 'admin-user-uuid-3';
const UNRELATED_USER_ID = 'unrelated-user-uuid-9';
const BUSINESS_ID = 'biz-uuid-1';
const STAFF_ID = 'staff-id-1';
const MSG_ID = 'msg-uuid-1';

const mockBookingRow = {
  booking_id: BOOKING_ID,
  client_user_id: CLIENT_ID,
  business_id: BUSINESS_ID,
  status: 'confirmed',
  source: 'app',
  staff_user_id: STAFF_USER_ID,
};

const mockBookingRowCompleted = {
  ...mockBookingRow,
  status: 'completed',
};

const mockWalkInBookingRow = {
  ...mockBookingRow,
  source: 'walk_in',
};

const mockMessage = {
  id: MSG_ID,
  booking_id: BOOKING_ID,
  sender_id: CLIENT_ID,
  sender_role: 'client',
  message_type: 'text',
  content: 'Привет!',
  is_read: false,
  created_at: new Date('2026-04-14T10:00:00Z'),
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
  (notificationService.notifyNewChatMessage as jest.Mock).mockResolvedValue(undefined);
});

// ─── POST /bookings/:id/messages ──────────────────────────────────────────────

describe('POST /bookings/:id/messages', () => {
  it('sends a text message as client', async () => {
    // First call: resolveAccess → returns booking row (client match)
    mockDb.executeTakeFirst
      .mockResolvedValueOnce(mockBookingRow)  // resolveAccess
      .mockResolvedValueOnce(mockMessage);    // insertInto returning

    const app = buildApp();
    const res = await request(app)
      .post(`/bookings/${BOOKING_ID}/messages`)
      .set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`)
      .send({ message_type: 'text', content: 'Привет!' });

    expect(res.status).toBe(201);
    expect(res.body.message).toBeDefined();
    expect(res.body.message.content).toBe('Привет!');
  });

  it('returns 403 when booking is not confirmed (completed)', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockBookingRowCompleted);

    const app = buildApp();
    const res = await request(app)
      .post(`/bookings/${BOOKING_ID}/messages`)
      .set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`)
      .send({ message_type: 'text', content: 'Привет!' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('BOOKING_NOT_ACTIVE');
  });

  it('returns 403 when chat is unavailable for non-app booking', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockWalkInBookingRow);

    const app = buildApp();
    const res = await request(app)
      .post(`/bookings/${BOOKING_ID}/messages`)
      .set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`)
      .send({ message_type: 'text', content: 'Привет!' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CHAT_NOT_AVAILABLE');
  });

  it('returns 403 for user with no access to booking', async () => {
    // resolveAccess: booking found but user is neither client nor staff
    mockDb.executeTakeFirst
      .mockResolvedValueOnce(mockBookingRow)  // resolveAccess booking
      .mockResolvedValueOnce(undefined);      // admin check returns nothing

    const app = buildApp();
    const res = await request(app)
      .post(`/bookings/${BOOKING_ID}/messages`)
      .set('Authorization', `Bearer ${makeToken(UNRELATED_USER_ID)}`)
      .send({ message_type: 'text', content: 'Hack' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 400 for empty content', async () => {
    const app = buildApp();
    const res = await request(app)
      .post(`/bookings/${BOOKING_ID}/messages`)
      .set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`)
      .send({ message_type: 'text', content: '' });

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    const app = buildApp();
    const res = await request(app)
      .post(`/bookings/${BOOKING_ID}/messages`)
      .send({ message_type: 'text', content: 'Привет!' });

    expect(res.status).toBe(401);
  });
});

// ─── GET /bookings/:id/messages ───────────────────────────────────────────────

describe('GET /bookings/:id/messages', () => {
  it('returns messages in chronological order for client', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockBookingRow); // resolveAccess
    mockDb.execute.mockResolvedValueOnce([mockMessage]);

    const app = buildApp();
    const res = await request(app)
      .get(`/bookings/${BOOKING_ID}/messages`)
      .set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.messages)).toBe(true);
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.next_cursor).toBeNull();
  });

  it('allows access for staff user', async () => {
    const staffBookingRow = { ...mockBookingRow };
    mockDb.executeTakeFirst.mockResolvedValueOnce(staffBookingRow); // resolveAccess (staff match)
    mockDb.execute.mockResolvedValueOnce([]);

    const app = buildApp();
    const res = await request(app)
      .get(`/bookings/${BOOKING_ID}/messages`)
      .set('Authorization', `Bearer ${makeToken(STAFF_USER_ID)}`);

    expect(res.status).toBe(200);
  });

  it('allows admin of business to read messages', async () => {
    // Booking row exists, user is not client/staff → check admin
    mockDb.executeTakeFirst
      .mockResolvedValueOnce(mockBookingRow)          // resolveAccess booking
      .mockResolvedValueOnce({ id: STAFF_ID });       // admin staff found
    mockDb.execute.mockResolvedValueOnce([]);

    const app = buildApp();
    const res = await request(app)
      .get(`/bookings/${BOOKING_ID}/messages`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_USER_ID)}`);

    expect(res.status).toBe(200);
  });
});

// ─── PATCH /bookings/:id/messages/read ───────────────────────────────────────

describe('PATCH /bookings/:id/messages/read', () => {
  it('marks messages as read and returns updated count', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockBookingRow); // resolveAccess
    mockDb.execute.mockResolvedValueOnce([{ numUpdatedRows: BigInt(3) }]);

    const app = buildApp();
    const res = await request(app)
      .patch(`/bookings/${BOOKING_ID}/messages/read`)
      .set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(3);
  });

  it('returns 403 for unrelated user', async () => {
    mockDb.executeTakeFirst
      .mockResolvedValueOnce(mockBookingRow)  // booking found
      .mockResolvedValueOnce(undefined);      // no admin match

    const app = buildApp();
    const res = await request(app)
      .patch(`/bookings/${BOOKING_ID}/messages/read`)
      .set('Authorization', `Bearer ${makeToken(UNRELATED_USER_ID)}`);

    expect(res.status).toBe(403);
  });
});

// ─── GET /bookings/:id/messages/unread-count ──────────────────────────────────

describe('GET /bookings/:id/messages/unread-count', () => {
  it('returns unread count for client (messages from staff)', async () => {
    mockDb.executeTakeFirst
      .mockResolvedValueOnce(mockBookingRow)   // resolveAccess
      .mockResolvedValueOnce({ count: '2' }); // count query

    const app = buildApp();
    const res = await request(app)
      .get(`/bookings/${BOOKING_ID}/messages/unread-count`)
      .set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body.unread_count).toBe(2);
  });

  it('returns 0 when no unread messages', async () => {
    mockDb.executeTakeFirst
      .mockResolvedValueOnce(mockBookingRow)   // resolveAccess
      .mockResolvedValueOnce({ count: '0' }); // count query

    const app = buildApp();
    const res = await request(app)
      .get(`/bookings/${BOOKING_ID}/messages/unread-count`)
      .set('Authorization', `Bearer ${makeToken(CLIENT_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body.unread_count).toBe(0);
  });
});
