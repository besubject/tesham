import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/error';
import { businessService } from '../services/business.service';

export async function listBusinesses(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // req.query has been coerced by validate() middleware using Zod
    const q = req.query as unknown as {
      query?: string;
      category_id?: string;
      sort?: 'rating' | 'distance';
      lat?: number;
      lng?: number;
      page: number;
      limit: number;
      cursor?: string;
    };

    // sort=distance requires lat/lng — validated by Zod refine, but defensive check here too
    if (q.sort === 'distance' && (q.lat === undefined || q.lng === undefined)) {
      throw new AppError(400, 'lat and lng are required when sort=distance', 'MISSING_GEO_PARAMS');
    }

    const result = await businessService.list({
      query: q.query,
      category_id: q.category_id,
      sort: q.sort,
      lat: q.lat,
      lng: q.lng,
      page: q.page,
      limit: q.limit,
      cursor: q.cursor,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getPopularBusinesses(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limitParam = req.query['limit'];
    const limit = limitParam !== undefined ? Math.min(Math.max(1, Number(limitParam)), 50) : 10;

    const headerLang = req.headers['accept-language'];
    const acceptLang: string = Array.isArray(headerLang)
      ? (headerLang[0] ?? 'ru')
      : (headerLang ?? 'ru');
    const lang: 'ru' | 'ce' = acceptLang.startsWith('ce') ? 'ce' : 'ru';

    const data = await businessService.getPopular(limit, lang);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getBusiness(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const headerLang = req.headers['accept-language'];
    const acceptLang: string = Array.isArray(headerLang)
      ? (headerLang[0] ?? 'ru')
      : (headerLang ?? 'ru');
    const lang: 'ru' | 'ce' = acceptLang.startsWith('ce') ? 'ce' : 'ru';

    const business = await businessService.getById(id, lang);
    res.json(business);
  } catch (err) {
    next(err);
  }
}
