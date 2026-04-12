import jwt from 'jsonwebtoken';
import { db } from '../db';
import { config } from '../config';
import { AppError } from '../middleware/error';
import { createSmsProvider, ISmsProvider } from './sms';
import { emailService } from './email.service';
import type { User } from '../db/types';

const INACTIVITY_THRESHOLD_MS = 12 * 30 * 24 * 60 * 60 * 1000; // ~12 months

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

    if (config.nodeEnv === 'development') {
      console.log(`[DEV] OTP for ${phone}: ${code}`);
    }

    await this.sms.sendOtp(phone, code).catch((err: unknown) => {
      if (config.nodeEnv === 'development') {
        console.warn('[DEV] SMS send failed (using console code above):', err);
      } else {
        throw err;
      }
    });

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
  ): Promise<
    | { requiresEmailVerification: true }
    | { requiresEmailVerification: false; tokens: TokenPair; user: Omit<User, 'created_at'> }
  > {
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
    const isNewUser = !(await db
      .selectFrom('users')
      .select('id')
      .where('phone', '=', phone)
      .executeTakeFirst());

    let user = isNewUser
      ? await db
          .insertInto('users')
          .values({ phone, name: '', language: 'ru', last_login_at: new Date() })
          .returningAll()
          .executeTakeFirstOrThrow()
      : await db
          .selectFrom('users')
          .selectAll()
          .where('phone', '=', phone)
          .executeTakeFirstOrThrow();

    // Phone recycling protection: if user has a verified email and has been
    // inactive for 12+ months, require email confirmation before issuing tokens.
    if (!isNewUser && user.email && user.email_verified) {
      const lastLogin = user.last_login_at ? new Date(user.last_login_at).getTime() : 0;
      const inactive = Date.now() - lastLogin > INACTIVITY_THRESHOLD_MS;
      if (inactive) {
        await emailService.sendLoginEmailCode(phone, user.email);
        void db
          .insertInto('events')
          .values({
            event_type: 'auth.email_verification_required',
            payload: JSON.stringify({}),
            session_id: null,
            anonymous_user_hash: null,
            user_id: user.id,
          })
          .execute()
          .catch(() => undefined);
        return { requiresEmailVerification: true };
      }
    }

    // Update last_login_at
    user = await db
      .updateTable('users')
      .set({ last_login_at: new Date() })
      .where('id', '=', user.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    const tokens = makeTokenPair(user);

    // Log event (fire-and-forget)
    void db
      .insertInto('events')
      .values({
        event_type: 'auth.verify_code',
        payload: JSON.stringify({ is_new_user: isNewUser }),
        session_id: null,
        anonymous_user_hash: null,
        user_id: user.id,
      })
      .execute()
      .catch(() => undefined);

    return {
      requiresEmailVerification: false,
      tokens,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        language: user.language,
        email: user.email,
        email_verified: user.email_verified,
        last_login_at: user.last_login_at,
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

  async verifyEmailLoginCode(
    phone: string,
    code: string,
  ): Promise<{ tokens: TokenPair; user: Omit<User, 'created_at'> }> {
    const ok = emailService.checkLoginEmailCode(phone, code);
    if (!ok) {
      throw new AppError(400, 'Invalid or expired code', 'INVALID_CODE');
    }

    const user = await db
      .updateTable('users')
      .set({ last_login_at: new Date() })
      .where('phone', '=', phone)
      .returningAll()
      .executeTakeFirst();

    if (!user) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    void db
      .insertInto('events')
      .values({
        event_type: 'auth.email_login_verified',
        payload: JSON.stringify({}),
        session_id: null,
        anonymous_user_hash: null,
        user_id: user.id,
      })
      .execute()
      .catch(() => undefined);

    return {
      tokens: makeTokenPair(user),
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        language: user.language,
        email: user.email,
        email_verified: user.email_verified,
        last_login_at: user.last_login_at,
      },
    };
  }
}

export const authService = new AuthService();
