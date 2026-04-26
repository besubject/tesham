import type { Request, Response, NextFunction } from 'express';
import { clientsService, type ClientSegment } from '../services/clients.service';

export async function getClientSegments(
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

    const segments = await clientsService.getSegments({
      userId: req.user.id,
      businessId,
    });

    res.json({ segments });
  } catch (err) {
    next(err);
  }
}

export async function getClientList(
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

    const segment = req.query['segment'] as ClientSegment | undefined;
    const search = req.query['search'] as string | undefined;
    const limit = Math.min(Number(req.query['limit'] ?? 20), 100);
    const cursor = req.query['cursor'] as string | undefined;
    const isAdmin = req.user.role !== 'employee';

    const result = await clientsService.getClients({
      userId: req.user.id,
      businessId,
      segment,
      search,
      limit,
      cursor,
      isAdmin,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getClientCard(
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

    const clientId = req.params['clientId'] as string;
    const bookingCursor = req.query['booking_cursor'] as string | undefined;
    const isAdmin = req.user.role !== 'employee';

    const card = await clientsService.getClientCard({
      userId: req.user.id,
      businessId,
      clientId,
      isAdmin,
      bookingCursor,
    });

    res.json({ client: card });
  } catch (err) {
    next(err);
  }
}
