import { Router } from 'express';
import { sql } from 'kysely';
import { db } from '../db';
import { trackEvent } from '../utils/track-event';

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

// GET /categories/search?q= — поиск по категориям и бизнесам с группировкой (лимит 5+5)
router.get('/search', async (req, res, next) => {
  try {
    const rawQ = req.query['q'];
    const q = typeof rawQ === 'string' ? rawQ.trim() : '';

    const headerLang = req.headers['accept-language'];
    const acceptLang: string = Array.isArray(headerLang)
      ? (headerLang[0] ?? 'ru')
      : (headerLang ?? 'ru');
    const lang: 'ru' | 'ce' = acceptLang.startsWith('ce') ? 'ce' : 'ru';
    const nameCol = lang === 'ce' ? 'name_ce' : 'name_ru';

    if (q.length === 0) {
      res.json({ categories: [], businesses: [] });
      return;
    }

    const likePattern = `%${q}%`;

    const [categories, businesses] = await Promise.all([
      db
        .selectFrom('categories')
        .select([
          'id',
          'name_ru',
          'name_ce',
          'icon',
          sql<number>`(SELECT COUNT(*) FROM businesses WHERE category_id = categories.id AND is_active = true)`.as(
            'business_count',
          ),
        ])
        .where(sql.ref(nameCol), 'ilike', likePattern)
        .orderBy('sort_order', 'asc')
        .limit(5)
        .execute(),

      db
        .selectFrom('businesses as b')
        .innerJoin('categories as c', 'c.id', 'b.category_id')
        .select([
          'b.id',
          'b.name',
          'b.category_id',
          sql<string[]>`b.photos`.as('photos'),
          sql<string>`c.name_ru`.as('category_name_ru'),
          sql<string>`c.name_ce`.as('category_name_ce'),
          sql<number | null>`(SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE business_id = b.id)`.as(
            'avg_rating',
          ),
        ])
        .where('b.is_active', '=', true)
        .where('b.name', 'ilike', likePattern)
        .orderBy(
          sql`(SELECT AVG(rating) FROM reviews WHERE business_id = b.id)`,
          'desc',
        )
        .limit(5)
        .execute(),
    ]);

    // Fire-and-forget event tracking
    trackEvent({
      event_type: 'catalog_search',
      payload: {
        q,
        lang,
        categories_found: categories.length,
        businesses_found: businesses.length,
      },
    });

    res.json({
      categories: categories.map((cat) => ({
        id: cat.id,
        name: lang === 'ce' ? cat.name_ce : cat.name_ru,
        name_ru: cat.name_ru,
        name_ce: cat.name_ce,
        icon: cat.icon,
        business_count: Number(cat.business_count),
      })),
      businesses: businesses.map((b) => ({
        id: b.id,
        name: b.name,
        photo_url: b.photos[0] ?? null,
        category_id: b.category_id,
        category_name: lang === 'ce' ? b.category_name_ce : b.category_name_ru,
        avg_rating: b.avg_rating !== null ? Number(b.avg_rating) : null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
