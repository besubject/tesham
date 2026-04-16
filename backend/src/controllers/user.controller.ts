import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import { emailService } from '../services/email.service';
import { authService } from '../services/auth.service';
import { db } from '../db';
import { AppError } from '../middleware/error';

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    }

    const user = await userService.getById(req.user.id);

    res.json({
      id: user.id,
      phone: user.phone,
      name: user.name,
      language: user.language,
      email: user.email,
      email_verified: user.email_verified,
      created_at: user.created_at,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    }

    const user = await userService.update(req.user.id, req.body as { name?: string; language?: 'ru' | 'ce' });

    res.json({
      id: user.id,
      phone: user.phone,
      name: user.name,
      language: user.language,
      email: user.email,
      email_verified: user.email_verified,
      created_at: user.created_at,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    }

    const { code } = req.body as { code: string };
    const user = await userService.getById(req.user.id);

    await authService.verifyOtp(user.phone, code);
    await userService.delete(req.user.id);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function sendDeleteCode(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    }

    const user = await userService.getById(req.user.id);
    await authService.sendCode(user.phone);

    res.json({ message: 'Verification code sent' });
  } catch (err) {
    next(err);
  }
}

export async function registerPushToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    }

    const { token } = req.body as { token: string };

    // Upsert: ignore conflict on unique token (another user's token shouldn't exist,
    // but device reuse after factory reset could duplicate — just delete the old one first).
    await db
      .deleteFrom('push_tokens')
      .where('token', '=', token)
      .where('user_id', '!=', req.user.id)
      .execute();

    await db
      .insertInto('push_tokens')
      .values({ user_id: req.user.id, token })
      .onConflict((oc) => oc.column('token').doNothing())
      .execute();

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function setEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    }

    const { email } = req.body as { email: string };

    // Check email not already taken by another user
    const existing = await db
      .selectFrom('users')
      .select('id')
      .where('email', '=', email)
      .where('id', '!=', req.user.id)
      .executeTakeFirst();

    if (existing) {
      throw new AppError(409, 'Email already in use', 'EMAIL_TAKEN');
    }

    // Save email (unverified) and send code
    await db
      .updateTable('users')
      .set({ email, email_verified: false })
      .where('id', '=', req.user.id)
      .execute();

    await emailService.sendVerifyEmailCode(req.user.id, email);

    res.json({ message: 'Verification code sent' });
  } catch (err) {
    next(err);
  }
}

export async function verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    }

    const { code } = req.body as { code: string };

    const ok = emailService.checkVerifyEmailCode(req.user.id, code);
    if (!ok) {
      throw new AppError(400, 'Invalid or expired code', 'INVALID_CODE');
    }

    await db
      .updateTable('users')
      .set({ email_verified: true })
      .where('id', '=', req.user.id)
      .execute();

    void db
      .insertInto('events')
      .values({
        event_type: 'user.email_verified',
        payload: JSON.stringify({}),
        session_id: null,
        anonymous_user_hash: null,
        user_id: req.user.id,
      })
      .execute()
      .catch(() => undefined);

    res.json({ message: 'Email verified' });
  } catch (err) {
    next(err);
  }
}

export async function removePushToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    }

    const token = req.params.token as string;

    await db
      .deleteFrom('push_tokens')
      .where('token', '=', token)
      .where('user_id', '=', req.user.id)
      .execute();

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
