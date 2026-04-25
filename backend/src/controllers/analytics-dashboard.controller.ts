import type { Request, Response, NextFunction } from 'express';
import {
  analyticsDashboardService,
  type AnalyticsPeriod,
} from '../services/analytics-dashboard.service';

export async function getAnalyticsDashboard(
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

    const period = (req.query['period'] as AnalyticsPeriod) ?? 'week';
    const todayStr = new Date().toISOString().slice(0, 10);
    const date =
      typeof req.query['date'] === 'string' ? req.query['date'] : todayStr;

    const dashboard = await analyticsDashboardService.getDashboard({
      userId,
      businessId,
      period,
      date,
    });

    res.json({ dashboard });
  } catch (err) {
    next(err);
  }
}
