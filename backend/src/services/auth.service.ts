import jwt from 'jsonwebtoken';
import { db } from '../db';
import { config } from '../config';
import { AppError } from '../middleware/error';
import { createSmsProvider, ISmsProvider } from './sms';
import type { User } from '../db/types';

// ─── OTP store (in-memory) ───────────────────────────────────────────────────

interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

const otpStore = new Map<string, OtpEntry>();

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_MAX_ATTEMPTS = 5;

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

// ─── JWT helpers ─────────────────────────────────────────────────────────────

export interface TokenPayload {
  id: string;
  phone: string;
  role?: string;
  businessId?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

function signRefreshToken(payload: Pick<TokenPayload, 'id' | 'phone'>): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

function makeTokenPair(user: User): TokenPair {
  const payload: TokenPayload = { id: user.id, phone: user.phone };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

// ─── Auth service ─────────────────────────────────────────────────────────────

export class AuthService {
  constructor(private readonly sms: ISmsProvider = createSmsProvider()) {}

  async sendCode(phone: string): Promise<void> {
    const code = generateOtp();
    otpStore.set(phone, {
      code,
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
    });

    await this.sms.sendOtp(phone, code);

    // Log event (fire-and-forget)
    void db
      .insertInto('events')
      .values({
        event_type: 'auth.send_code',
        payload: JSON.stringify({ phone: phone.slice(-4) }), // last 4 digits only
        session_id: null,
        anonymous_user_hash: null,
        user_id: null,
      })
      .execute()
      .catch(() => undefined);
  }

  async verifyCode(
    phone: string,
    code: string,
  ): Promise<{ tokens: TokenPair; user: Omit<User, 'created_at'> }> {
    const entry = otpStore.get(phone);

    if (!entry) {
      throw new AppError(401, 'Code not found or expired', 'INVALID_CODE');
    }

    if (Date.now() > entry.expiresAt) {
      otpStore.delete(phone);
      throw new AppError(401, 'Code expired', 'CODE_EXPIRED');
    }

    entry.attempts += 1;
    if (entry.attempts > OTP_MAX_ATTEMPTS) {
      otpStore.delete(phone);
      throw new AppError(429, 'Too many attempts', 'TOO_MANY_ATTEMPTS');
    }

    if (entry.code !== code) {
      throw new AppError(401, 'Invalid code', 'INVALID_CODE');
    }

    otpStore.delete(phone);

    // Get or create user
    let user = await db
      .selectFrom('users')
      .selectAll()
      .where('phone', '=', phone)
      .executeTakeFirst();

    if (!user) {
      user = await db
        .insertInto('users')
        .values({ phone, name: '', language: 'ru' })
        .returningAll()
        .executeTakeFirstOrThrow();
    }

    const tokens = makeTokenPair(user);

    // Log event (fire-and-forget)
    void db
      .insertInto('events')
      .values({
        event_type: 'auth.verify_code',
        payload: JSON.stringify({ is_new_user: !user }),
        session_id: null,
        anonymous_user_hash: null,
        user_id: user.id,
      })
      .execute()
      .catch(() => undefined);

    return {
      tokens,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        language: user.language,
      },
    };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: Pick<TokenPayload, 'id' | 'phone'>;

    try {
      payload = jwt.verify(
        refreshToken,
        config.jwt.refreshSecret,
      ) as Pick<TokenPayload, 'id' | 'phone'>;
    } catch {
      throw new AppError(401, 'Invalid or expired refresh token', 'INVALID_TOKEN');
    }

    // Verify user still exists
    const user = await db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', payload.id)
      .executeTakeFirst();

    if (!user) {
      throw new AppError(401, 'User not found', 'USER_NOT_FOUND');
    }

    return makeTokenPair(user);
  }
}

export const authService = new AuthService();
