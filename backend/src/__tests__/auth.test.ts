import request from 'supertest';
import jwt from 'jsonwebtoken';
import express, { Application } from 'express';

// ─── Mock DB (must be before imports that use db) ─────────────────────────────

const mockExecuteTakeFirst = jest.fn();
const mockExecuteTakeFirstOrThrow = jest.fn();
const mockExecute = jest.fn().mockResolvedValue([]);

jest.mock('../db', () => {
  const chainable = {
    selectFrom: jest.fn(),
    insertInto: jest.fn(),
    updateTable: jest.fn(),
    select: jest.fn(),
    selectAll: jest.fn(),
    set: jest.fn(),
    where: jest.fn(),
    values: jest.fn(),
    returningAll: jest.fn(),
    executeTakeFirst: jest.fn(),
    executeTakeFirstOrThrow: jest.fn(),
    execute: jest.fn(),
  };

  // Make every method return the chainable object for builder pattern
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
import authRouter from '../routes/auth';
import { config } from '../config';
import { AuthService } from '../services/auth.service';
import { MockSmsProvider } from '../services/sms';

// ─── Typed mock db reference ──────────────────────────────────────────────────

const mockDb = db as unknown as {
  selectFrom: jest.Mock;
  insertInto: jest.Mock;
  updateTable: jest.Mock;
  select: jest.Mock;
  selectAll: jest.Mock;
  set: jest.Mock;
  where: jest.Mock;
  values: jest.Mock;
  returningAll: jest.Mock;
  executeTakeFirst: jest.Mock;
  executeTakeFirstOrThrow: jest.Mock;
  execute: jest.Mock;
};

// ─── Mock user ────────────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-uuid-1',
  phone: '+79001234567',
  name: '',
  language: 'ru' as const,
  created_at: new Date(),
};

// ─── Test app factory ─────────────────────────────────────────────────────────

function makeApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);
  app.use(errorHandler);
  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  // Re-configure chain after clearAllMocks
  const chain = mockDb as Record<string, jest.Mock | undefined>;
  ['selectFrom', 'insertInto', 'updateTable', 'select', 'selectAll', 'set', 'where', 'values', 'returningAll'].forEach((k) => {
    chain[k]?.mockReturnValue(mockDb);
  });
  chain['execute']?.mockResolvedValue([]);
});

describe('POST /auth/send-code', () => {
  it('returns 200 for valid phone', async () => {
    const app = makeApp();
    mockDb.execute.mockResolvedValue([]);

    const res = await request(app)
      .post('/auth/send-code')
      .send({ phone: '+79001234567' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Code sent');
  });

  it('returns 400 for invalid phone', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/auth/send-code')
      .send({ phone: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /auth/verify-code', () => {
  it('returns 401 for wrong code after sending valid code', async () => {
    const app = makeApp();
    mockDb.execute.mockResolvedValue([]);

    await request(app).post('/auth/send-code').send({ phone: '+79001234580' });

    const res = await request(app)
      .post('/auth/verify-code')
      .send({ phone: '+79001234580', code: '000000' });
    expect(res.status).toBe(401);
  });

  it('returns 401 when no code was sent', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/auth/verify-code')
      .send({ phone: '+79001234590', code: '123456' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for non-numeric code', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/auth/verify-code')
      .send({ phone: '+79001234567', code: 'abc123' });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/refresh', () => {
  it('returns new token pair for valid refresh token', async () => {
    const app = makeApp();
    const refreshToken = jwt.sign(
      { id: mockUser.id, phone: mockUser.phone },
      config.jwt.refreshSecret,
      { expiresIn: '30d' },
    );

    mockDb.executeTakeFirst.mockResolvedValueOnce(mockUser);

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.tokens.accessToken).toBeDefined();
    expect(res.body.tokens.refreshToken).toBeDefined();
  });

  it('returns 401 for invalid refresh token', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: 'invalid.token.here' });
    expect(res.status).toBe(401);
  });

  it('returns 401 when user no longer exists', async () => {
    const app = makeApp();
    const refreshToken = jwt.sign(
      { id: 'deleted-user-id', phone: '+79001234567' },
      config.jwt.refreshSecret,
      { expiresIn: '30d' },
    );

    mockDb.executeTakeFirst.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing refreshToken', async () => {
    const app = makeApp();
    const res = await request(app).post('/auth/refresh').send({});
    expect(res.status).toBe(400);
  });
});

describe('AuthService unit tests', () => {
  it('returns tokens and user for correct OTP code', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const sms = new MockSmsProvider();
    const service = new AuthService(sms);

    mockDb.execute.mockResolvedValue([]);
    await service.sendCode('+79001234571');

    const logArgs = consoleSpy.mock.calls[0] ?? [];
    // Extract code after the last colon (format: "[MockSMS] OTP for +7XXX: CODE")
    const code = String(logArgs[0] ?? '').split(': ').pop() ?? '';
    consoleSpy.mockRestore();

    const createdUser = { ...mockUser, phone: '+79001234571' };
    mockDb.executeTakeFirst.mockResolvedValueOnce(undefined);
    mockDb.executeTakeFirstOrThrow
      .mockResolvedValueOnce(createdUser)
      .mockResolvedValueOnce({
        ...createdUser,
        last_login_at: new Date(),
      });
    mockDb.execute.mockResolvedValue([]);

    const result = await service.verifyCode('+79001234571', code);
    expect(result.requiresEmailVerification).toBe(false);
    if (result.requiresEmailVerification) throw new Error('unexpected');
    expect(result.user.phone).toBe('+79001234571');
    expect(result.tokens.accessToken).toBeDefined();
    expect(result.tokens.refreshToken).toBeDefined();
  });

  it('throws 401 for invalid code (no OTP sent)', async () => {
    const sms = new MockSmsProvider();
    const service = new AuthService(sms);

    await expect(service.verifyCode('+79001234572', '123456')).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CODE',
    });
  });

  it('throws 429 after exceeding max OTP attempts', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const sms = new MockSmsProvider();
    const service = new AuthService(sms);

    mockDb.execute.mockResolvedValue([]);
    await service.sendCode('+79001234573');
    consoleSpy.mockRestore();

    // 5 wrong attempts
    for (let i = 0; i < 5; i++) {
      await service.verifyCode('+79001234573', '000000').catch(() => undefined);
    }

    // 6th attempt should get 429
    await expect(service.verifyCode('+79001234573', '000000')).rejects.toMatchObject({
      statusCode: 429,
      code: 'TOO_MANY_ATTEMPTS',
    });
  });
});

// Suppress unused import warning
void mockExecuteTakeFirst;
void mockExecuteTakeFirstOrThrow;
void mockExecute;
