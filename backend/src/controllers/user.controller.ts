import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
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

    await userService.delete(req.user.id);

    res.status(204).send();
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
