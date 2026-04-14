/**
 * E2E flow test — TASK-041
 *
 * Полный сквозной тест основного флоу клиента:
 *   1. Auth: send-code → verify-code → JWT
 *   2. Browse: GET /businesses (поиск/листинг)
 *   3. Card:   GET /businesses/:id (карточка)
 *   4. Slots:  GET /businesses/:id/slots (доступные слоты)
 *   5. Book:   POST /bookings (запись)
 *   6. List:   GET /bookings/my (мои записи)
 *   7. Cancel: DELETE /bookings/:id (отмена)
 *
 * Каждый шаг — отдельный it() для изоляции и понятности.
 * DB замоканa, маршруты Express и валидация — реальные.
 */

import request from 'supertest';
import express, { Application } from 'express';
import jwt from 'jsonwebtoken';

// ─── sql mock ─────────────────────────────────────────────────────────────────

const mockSqlExecute = jest.fn().mockResolvedValue({ rows: [] });
const mockSqlResult = {
  execute: mockSqlExecute,
  as: jest.fn().mockReturnThis(),
};
const mockSqlFn = jest.fn().mockReturnValue(mockSqlResult);

jest.mock('kysely', () => ({ sql: mockSqlFn }));

// ─── Notification service mock ────────────────────────────────────────────────

jest.mock('../services/notification.service', () => ({
  notificationService: {
    notifyBookingCreated: jest.fn().mockResolvedValue(undefined),
    notifyBookingCancelled: jest.fn().mockResolvedValue(undefined),
    notifyClientBookingConfirmed: jest.fn().mockResolvedValue(undefined),
    notifyClientBookingCancelledByBusiness: jest.fn().mockResolvedValue(undefined),
  },
}));

// ─── DB mock ──────────────────────────────────────────────────────────────────

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
    groupBy: jest.fn(),
    limit: jest.fn(),
    offset: jest.fn(),
    set: jest.fn(),
    values: jest.fn(),
    returning: jest.fn(),
    returningAll: jest.fn(),
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

// ─── Config mock ──────────────────────────────────────────────────────────────

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
    s3: { urlExpiration: 3600 },
    smsru: { apiId: '' },
  },
}));

// ─── Imports (после моков) ────────────────────────────────────────────────────

import { db } from '../db';
import { errorHandler } from '../middleware/error';
import authRouter from '../routes/auth';
import businessesRouter from '../routes/businesses';
import bookingsRouter from '../routes/bookings';
import { notificationService } from '../services/notification.service';

// ─── Типизированный mock DB ───────────────────────────────────────────────────

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
  groupBy: jest.Mock;
  limit: jest.Mock;
  offset: jest.Mock;
  set: jest.Mock;
  values: jest.Mock;
  returning: jest.Mock;
  returningAll: jest.Mock;
  executeTakeFirst: jest.Mock;
  executeTakeFirstOrThrow: jest.Mock;
  execute: jest.Mock;
  transaction: jest.Mock;
};

// ─── Тестовое приложение ──────────────────────────────────────────────────────

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);
  app.use('/businesses', businessesRouter);
  app.use('/bookings', bookingsRouter);
  app.use(errorHandler);
  return app;
}

// ─── Константы тестового бизнеса/слота/записи ─────────────────────────────────

const USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const USER_PHONE = '+79001234567';
const BIZ_ID = '550e8400-e29b-41d4-a716-446655440002';
const SLOT_ID = '550e8400-e29b-41d4-a716-446655440010';
const SERVICE_ID = '550e8400-e29b-41d4-a716-446655440020';
const STAFF_ID = '550e8400-e29b-41d4-a716-446655440030';
const BOOKING_ID = '550e8400-e29b-41d4-a716-446655440040';

const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 7);
const futureDateStr = futureDate.toISOString().slice(0, 10);

const mockBusinessRow = {
  id: BIZ_ID,
  name: 'Барбершоп Грозный',
  address: 'ул. Ленина 1',
  phone: '+79001234567',
  photos: [],
  working_hours: { mon: '09:00-18:00' },
  instagram_url: null,
  website_url: null,
  category_id: 'cat-uuid-1',
  category_name_ru: 'Барбершоп',
  category_name_ce: 'Барбершоп',
  rating_avg: 4.8,
  rating_count: 25,
  lat: 43.3168,
  lng: 45.6981,
  is_active: true,
  description: 'Лучший барбер в городе',
  cancellation_threshold_minutes: 60,
};

const mockSlotRow = { id: SLOT_ID, is_booked: false, staff_id: STAFF_ID };
const mockStaffRow = { id: STAFF_ID, business_id: BIZ_ID, name: 'Ахмед' };
const mockServiceRow = { id: SERVICE_ID, business_id: BIZ_ID, name: 'Стрижка', price: 500 };

const mockNewBooking = {
  id: BOOKING_ID,
  status: 'confirmed',
  business_id: BIZ_ID,
  staff_id: STAFF_ID,
  created_at: new Date(),
};

const mockBookingDetail = {
  id: BOOKING_ID,
  status: 'confirmed',
  slot_date: futureDateStr,
  slot_start_time: '10:00',
  service_name: 'Стрижка',
  service_price: 500,
  business_id: BIZ_ID,
  business_name: 'Барбершоп Грозный',
  staff_name: 'Ахмед',
  created_at: new Date(),
  cancelled_at: null,
};

// ─── Reset chainable mocks ────────────────────────────────────────────────────

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
  mockDb.groupBy.mockReturnValue(mockDb);
  mockDb.limit.mockReturnValue(mockDb);
  mockDb.offset.mockReturnValue(mockDb);
  mockDb.set.mockReturnValue(mockDb);
  mockDb.values.mockReturnValue(mockDb);
  mockDb.returning.mockReturnValue(mockDb);
  mockDb.returningAll.mockReturnValue(mockDb);
  mockDb.execute.mockResolvedValue([]);
  mockDb.executeTakeFirst.mockResolvedValue(undefined);
  mockDb.transaction.mockReturnValue({
    execute: jest
      .fn()
      .mockImplementation(async (fn: (trx: typeof mockDb) => unknown) => fn(mockDb)),
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  mockSqlFn.mockReturnValue(mockSqlResult);
  mockSqlResult.as.mockReturnThis();
  mockSqlExecute.mockResolvedValue({ rows: [] });
  reinitChainable();
  // Restore notification service mocks (resetAllMocks clears them)
  (notificationService.notifyBookingCreated as jest.Mock).mockResolvedValue(undefined);
  (notificationService.notifyBookingCancelled as jest.Mock).mockResolvedValue(undefined);
  (notificationService.notifyClientBookingConfirmed as jest.Mock).mockResolvedValue(undefined);
  (notificationService.notifyClientBookingCancelledByBusiness as jest.Mock).mockResolvedValue(
    undefined,
  );
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAccessToken(userId: string = USER_ID): string {
  return jwt.sign({ id: userId, phone: USER_PHONE }, 'test-secret', { expiresIn: '1h' });
}

// ═══════════════════════════════════════════════════════════════════════════════
// E2E flow
// ═══════════════════════════════════════════════════════════════════════════════

describe('E2E flow: регистрация → поиск → запись → отмена', () => {
  // ─── 1. Auth flow ──────────────────────────────────────────────────────────

  describe('Step 1: Auth flow', () => {
    it('1.1 send-code accepts valid phone', async () => {
      mockDb.execute.mockResolvedValue([]);

      const app = buildApp();
      const res = await request(app).post('/auth/send-code').send({ phone: USER_PHONE });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Code sent');
    });

    it('1.2 access token helper produces a valid JWT for downstream calls', () => {
      const token = makeAccessToken();
      const decoded = jwt.verify(token, 'test-secret') as { id: string; phone: string };
      expect(decoded.id).toBe(USER_ID);
      expect(decoded.phone).toBe(USER_PHONE);
    });

    it('1.3 verify-code rejects wrong code', async () => {
      const app = buildApp();
      mockDb.execute.mockResolvedValue([]);

      // Send a real code via HTTP (we don't know the value)
      await request(app).post('/auth/send-code').send({ phone: USER_PHONE });

      const res = await request(app)
        .post('/auth/verify-code')
        .send({ phone: USER_PHONE, code: '000000' });

      expect(res.status).toBe(401);
    });
  });

  // ─── 2. Browse / search ─────────────────────────────────────────────────────

  describe('Step 2: Browse businesses', () => {
    it('2.1 GET /businesses returns paginated list', async () => {
      mockDb.execute.mockResolvedValueOnce([mockBusinessRow]);
      mockDb.executeTakeFirst.mockResolvedValueOnce({ total: '1' });

      const app = buildApp();
      const res = await request(app).get('/businesses?page=1&limit=20');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.pagination.page).toBe(1);
    });

    it('2.2 GET /businesses?category_id filters by category', async () => {
      mockDb.execute.mockResolvedValueOnce([mockBusinessRow]);
      mockDb.executeTakeFirst.mockResolvedValueOnce({ total: '1' });

      const app = buildApp();
      const res = await request(app).get(
        '/businesses?category_id=550e8400-e29b-41d4-a716-446655440099',
      );

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  // ─── 3. Business card ───────────────────────────────────────────────────────

  describe('Step 3: Business card', () => {
    it('3.1 GET /businesses/:id returns business detail', async () => {
      mockDb.executeTakeFirst.mockResolvedValueOnce(mockBusinessRow);
      mockDb.execute
        .mockResolvedValueOnce([mockServiceRow]) // services
        .mockResolvedValueOnce([mockStaffRow]); // staff

      const app = buildApp();
      const res = await request(app).get(`/businesses/${BIZ_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(BIZ_ID);
      expect(res.body.name).toBe('Барбершоп Грозный');
    });

    it('3.2 GET /businesses/:id returns 404 for unknown id', async () => {
      mockDb.executeTakeFirst.mockResolvedValueOnce(undefined);

      const app = buildApp();
      const res = await request(app).get(
        '/businesses/550e8400-e29b-41d4-a716-446655449999',
      );

      expect(res.status).toBe(404);
    });
  });

  // ─── 4. Slots ───────────────────────────────────────────────────────────────

  describe('Step 4: Available slots', () => {
    it('4.1 GET /businesses/:id/slots returns slot list', async () => {
      mockDb.execute.mockResolvedValueOnce([
        {
          id: SLOT_ID,
          staff_id: STAFF_ID,
          staff_name: 'Ахмед',
          date: futureDateStr,
          start_time: '10:00',
          is_booked: false,
        },
      ]);

      const app = buildApp();
      const res = await request(app).get(`/businesses/${BIZ_ID}/slots`);

      expect(res.status).toBe(200);
      expect(res.body.slots).toHaveLength(1);
    });
  });

  // ─── 5. Booking ─────────────────────────────────────────────────────────────

  describe('Step 5: Create booking', () => {
    it('5.1 POST /bookings creates a booking (auth required)', async () => {
      // FOR UPDATE → free slot
      mockSqlExecute.mockResolvedValueOnce({ rows: [mockSlotRow] });
      // staff lookup, service lookup, insert returning, getBookingDetail
      mockDb.executeTakeFirst
        .mockResolvedValueOnce(mockStaffRow)
        .mockResolvedValueOnce(mockServiceRow)
        .mockResolvedValueOnce(mockNewBooking)
        .mockResolvedValueOnce(mockBookingDetail);

      const app = buildApp();
      const res = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${makeAccessToken()}`)
        .send({ slot_id: SLOT_ID, service_id: SERVICE_ID });

      expect(res.status).toBe(201);
      expect(res.body.booking.id).toBe(BOOKING_ID);
      expect(res.body.booking.status).toBe('confirmed');
    });

    it('5.2 POST /bookings rejects without auth', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/bookings')
        .send({ slot_id: SLOT_ID, service_id: SERVICE_ID });

      expect(res.status).toBe(401);
    });

    it('5.3 POST /bookings returns 409 if slot already booked', async () => {
      mockSqlExecute.mockResolvedValueOnce({
        rows: [{ ...mockSlotRow, is_booked: true }],
      });

      const app = buildApp();
      const res = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${makeAccessToken()}`)
        .send({ slot_id: SLOT_ID, service_id: SERVICE_ID });

      expect(res.status).toBe(409);
    });
  });

  // ─── 6. List my bookings ────────────────────────────────────────────────────

  describe('Step 6: My bookings', () => {
    it('6.1 GET /bookings/my returns the user\u0027s bookings', async () => {
      mockDb.execute.mockResolvedValueOnce([mockBookingDetail]);

      const app = buildApp();
      const res = await request(app)
        .get('/bookings/my')
        .set('Authorization', `Bearer ${makeAccessToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.bookings).toHaveLength(1);
      expect(res.body.bookings[0].id).toBe(BOOKING_ID);
    });
  });

  // ─── 7. Cancel ──────────────────────────────────────────────────────────────

  describe('Step 7: Cancel booking', () => {
    it('7.1 DELETE /bookings/:id cancels future booking', async () => {
      mockDb.executeTakeFirst.mockResolvedValueOnce({
        id: BOOKING_ID,
        user_id: USER_ID,
        status: 'confirmed',
        slot_id: SLOT_ID,
        slot_date: futureDateStr,
        start_time: '10:00',
        cancellation_threshold_minutes: 60,
      });

      const app = buildApp();
      const res = await request(app)
        .delete(`/bookings/${BOOKING_ID}`)
        .set('Authorization', `Bearer ${makeAccessToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('7.2 DELETE /bookings/:id forbids cancelling someone else\u0027s booking', async () => {
      mockDb.executeTakeFirst.mockResolvedValueOnce({
        id: BOOKING_ID,
        user_id: 'other-user',
        status: 'confirmed',
        slot_id: SLOT_ID,
        slot_date: futureDateStr,
        start_time: '10:00',
        cancellation_threshold_minutes: 60,
      });

      const app = buildApp();
      const res = await request(app)
        .delete(`/bookings/${BOOKING_ID}`)
        .set('Authorization', `Bearer ${makeAccessToken()}`);

      expect(res.status).toBe(403);
    });

    it('7.3 DELETE /bookings/:id returns 404 for unknown booking', async () => {
      mockDb.executeTakeFirst.mockResolvedValueOnce(undefined);

      const app = buildApp();
      const res = await request(app)
        .delete(`/bookings/${BOOKING_ID}`)
        .set('Authorization', `Bearer ${makeAccessToken()}`);

      expect(res.status).toBe(404);
    });
  });
});
