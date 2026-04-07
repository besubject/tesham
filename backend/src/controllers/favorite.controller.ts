import { Request, Response, NextFunction } from 'express';
import { favoriteService } from '../services/favorite.service';

export async function getFavorites(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }

    const result = await favoriteService.getFavorites(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function addFavorite(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }

    const { business_id, staff_id } = req.body as { business_id?: string; staff_id?: string };

    const favorite = await favoriteService.addFavorite({
      user_id: req.user.id,
      business_id,
      staff_id,
    });

    res.status(201).json({ favorite });
  } catch (err) {
    next(err);
  }
}

export async function removeFavorite(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }

    const favoriteId = req.params.id as string;

    await favoriteService.removeFavorite(favoriteId, req.user.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
