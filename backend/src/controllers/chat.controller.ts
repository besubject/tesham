import { Request, Response, NextFunction } from 'express';
import { chatService } from '../services/chat.service';
import type { ChatMessageType } from '../db/types';

export async function getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }

    const bookingId = req.params.id as string;
    const { cursor, limit } = req.query as { cursor?: string; limit?: string };

    const result = await chatService.getMessages(
      bookingId,
      req.user.id,
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }

    const bookingId = req.params.id as string;
    const { message_type, content } = req.body as { message_type: ChatMessageType; content: string };

    const message = await chatService.sendMessage(bookingId, req.user.id, message_type, content);

    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }

    const bookingId = req.params.id as string;
    const result = await chatService.markAsRead(bookingId, req.user.id);

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getUnreadCount(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }

    const bookingId = req.params.id as string;
    const result = await chatService.getUnreadCount(bookingId, req.user.id);

    res.json(result);
  } catch (err) {
    next(err);
  }
}
