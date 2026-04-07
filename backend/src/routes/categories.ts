import { Router } from 'express';
import { db } from '../db';

const router = Router();

// GET /categories — список всех категорий, отсортированных по sort_order
router.get('/', async (_req, res, next) => {
  try {
    const categories = await db
      .selectFrom('categories')
      .select(['id', 'name_ru', 'name_ce', 'icon'])
      .orderBy('sort_order', 'asc')
      .execute();
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

export default router;
