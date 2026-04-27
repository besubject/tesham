import type { Request, Response, NextFunction } from 'express';
import { broadcastsService } from '../services/broadcasts.service';

export async function createBroadcast(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const businessId = req.user.businessId;
    if (!businessId) {
      res.status(403).json({ error: 'No business associated with this account' });
      return;
    }

    const { audience, title, body } = req.body as {
      audience: string;
      title: string;
      body: string;
    };

    const broadcast = await broadcastsService.createBroadcast({
      userId: req.user.id,
      businessId,
      audience: audience as import('../db/types').BroadcastAudience,
      title,
      body,
    });

    res.status(201).json({ broadcast });
  } catch (err) {
    next(err);
  }
}

export async function getBroadcasts(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const businessId = req.user.businessId;
    if (!businessId) {
      res.status(403).json({ error: 'No business associated with this account' });
      return;
    }

    const limit = Math.min(Number(req.query['limit'] ?? 20), 100);
    const cursor = req.query['cursor'] as string | undefined;

    const result = await broadcastsService.getBroadcasts({
      userId: req.user.id,
      businessId,
      limit,
      cursor,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getBroadcastDetail(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const businessId = req.user.businessId;
    if (!businessId) {
      res.status(403).json({ error: 'No business associated with this account' });
      return;
    }

    const broadcastId = req.params['broadcastId'] as string;
    const recipientCursor = req.query['recipient_cursor'] as string | undefined;

    const detail = await broadcastsService.getBroadcastDetail({
      userId: req.user.id,
      businessId,
      broadcastId,
      recipientCursor,
    });

    res.json({ broadcast: detail });
  } catch (err) {
    next(err);
  }
}
