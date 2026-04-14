import type { Request, Response, NextFunction } from 'express';
import { businessStatsService, type StatsPeriod } from '../services/business-stats.service';

export async function getBusinessStats(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userId = req.user.id;
    const businessId = req.user.businessId;

    if (!businessId) {
      res.status(403).json({ error: 'No business associated with this account' });
      return;
    }

    const period = (req.query['period'] as StatsPeriod) ?? 'week';
    const staffId = req.query['staff_id'] as string | undefined;

    const stats = await businessStatsService.getStats({
      userId,
      businessId,
      period,
      staffId,
    });

    res.json({ stats });
  } catch (err) {
    next(err);
  }
}
