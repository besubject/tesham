import { Request, Response, NextFunction } from 'express';
import { businessService } from '../services/business.service';

export async function listBusinesses(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // req.query has been coerced by validate() middleware using Zod
    const q = req.query as unknown as {
      query?: string;
      category_id?: string;
      lat?: number;
      lng?: number;
      page: number;
      limit: number;
    };

    const result = await businessService.list({
      query: q.query,
      category_id: q.category_id,
      lat: q.lat,
      lng: q.lng,
      page: q.page,
      limit: q.limit,
    });

    res.json(result);
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
