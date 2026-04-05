import { Request, Response, NextFunction } from 'express';
import { reviewService } from '../services/review.service';

export async function getBusinessReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const q = req.query as unknown as { page: number; limit: number };

    const result = await reviewService.getBusinessReviews(id, q.page, q.limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createReview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as { booking_id: string; rating: number; text?: string };
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }
    const userId = req.user.id;

    const review = await reviewService.createReview({
      booking_id: body.booking_id,
      rating: body.rating,
      text: body.text,
      user_id: userId,
    });

    res.status(201).json(review);
  } catch (err) {
    next(err);
  }
}
