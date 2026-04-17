import { sql } from 'kysely';
import { db } from './index';
import { transliterate } from '../utils/transliterate';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

// Generate 30-min slots from startHour to endHour (exclusive)
function generateSlotTimes(startHour: number, endHour: number): string[] {
  const times: string[] = [];
  for (let h = startHour; h < endHour; h++) {
    times.push(`${String(h).padStart(2, '0')}:00`);
    times.push(`${String(h).padStart(2, '0')}:30`);
  }
  return times;
}

const SLOT_TIMES = generateSlotTimes(9, 18); // 09:00 – 17:30

const WORKING_HOURS = {
  mon: '09:00-18:00',
  tue: '09:00-18:00',
  wed: '09:00-18:00',
  thu: '09:00-18:00',
  fri: '09:00-18:00',
  sat: '10:00-17:00',
  sun: null,
};

// ─── Categories ───────────────────────────────────────────────────────────────

interface CategorySeed {
  name_ru: string;
  name_ce: string;
  icon: string;
  sort_order: number;
}

const CATEGORIES: CategorySeed[] = [
  { name_ru: 'Барберы', name_ce: 'Барберш', icon: 'scissors', sort_order: 1 },
  {
    name_ru: 'Салоны красоты',
    name_ce: 'Хаза хилар',
    icon: 'sparkles',
    sort_order: 2,
  },
  {
    name_ru: 'Автосервисы',
    name_ce: 'Машанийн жӀаьла',
    icon: 'car',
    sort_order: 3,
  },
  {
    name_ru: 'Медицина',
    name_ce: 'Лоьраш',
    icon: 'heart-pulse',
    sort_order: 4,
  },
  {
    name_ru: 'Стоматология',
    name_ce: 'Цергийн лор',
    icon: 'tooth',
    sort_order: 5,
  },
];

async function seedCategories(): Promise<Map<string, string>> {
  const existing = await db.selectFrom('categories').selectAll().execute();
  const categoryMap = new Map<string, string>();

  if (existing.length >= CATEGORIES.length) {
    console.log(
      `  ↳ Категории уже существуют (${existing.length}), пропускаю`,
    );
    for (const cat of existing) {
      categoryMap.set(cat.name_ru, cat.id);
    }
    return categoryMap;
  }

  const existingNames = new Set(existing.map((c) => c.name_ru));

  for (const cat of CATEGORIES) {
    if (existingNames.has(cat.name_ru)) {
      const found = existing.find((c) => c.name_ru === cat.name_ru);
      if (found) categoryMap.set(cat.name_ru, found.id);
      continue;
    }
    const inserted = await db
      .insertInto('categories')
      .values(cat)
      .returning('id')
      .executeTakeFirstOrThrow();
    categoryMap.set(cat.name_ru, inserted.id);
    console.log(`  ✅ Категория: ${cat.name_ru}`);
  }

  return categoryMap;
}

// ─── Business seed data ───────────────────────────────────────────────────────

interface StaffSeed {
  phone: string;
  name: string;
  role: 'admin' | 'employee';
}

interface ServiceSeed {
  name: string;
  price: number;
  duration_minutes: number;
}

interface BusinessSeed {
  name: string;
  categoryKey: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  instagram_url?: string;
  staff: StaffSeed[];
  services: ServiceSeed[];
}

const BUSINESSES: BusinessSeed[] = [
  // ── Барберы ──
  {
    name: 'Барбершоп Чечня',
    categoryKey: 'Барберы',
    address: 'пр. Путина, 12, Грозный',
    lat: 43.3232,
    lng: 45.6874,
    phone: '+78712001001',
    instagram_url: 'https://instagram.com/barbershop_chechnya',
    staff: [
      { phone: '+70001000001', name: 'Ахмад Хасанов', role: 'admin' },
      { phone: '+70001000002', name: 'Муса Исмаилов', role: 'employee' },
    ],
    services: [
      { name: 'Стрижка мужская', price: 700, duration_minutes: 30 },
      { name: 'Стрижка + борода', price: 1100, duration_minutes: 60 },
      { name: 'Оформление бороды', price: 500, duration_minutes: 30 },
      { name: 'Детская стрижка', price: 500, duration_minutes: 30 },
    ],
  },
  {
    name: 'MenStyle Barbershop',
    categoryKey: 'Барберы',
    address: 'ул. Маяковского, 5, Грозный',
    lat: 43.3198,
    lng: 45.6952,
    phone: '+78712001002',
    staff: [
      { phone: '+70001000003', name: 'Рустам Даудов', role: 'admin' },
      { phone: '+70001000004', name: 'Ислам Магомедов', role: 'employee' },
    ],
    services: [
      { name: 'Стрижка классическая', price: 600, duration_minutes: 30 },
      { name: 'Fade стрижка', price: 800, duration_minutes: 45 },
      { name: 'Royal shave', price: 900, duration_minutes: 45 },
    ],
  },

  // ── Салоны красоты ──
  {
    name: 'Beauty Studio Seda',
    categoryKey: 'Салоны красоты',
    address: 'пр. Кадырова, 18, Грозный',
    lat: 43.3176,
    lng: 45.6978,
    phone: '+78712002001',
    instagram_url: 'https://instagram.com/beautystudio_seda',
    staff: [
      { phone: '+70001000005', name: 'Седа Усманова', role: 'admin' },
      { phone: '+70001000006', name: 'Хеда Гадаева', role: 'employee' },
      { phone: '+70001000007', name: 'Малика Алиева', role: 'employee' },
    ],
    services: [
      { name: 'Женская стрижка', price: 1000, duration_minutes: 60 },
      { name: 'Окрашивание волос', price: 3000, duration_minutes: 120 },
      { name: 'Маникюр классический', price: 800, duration_minutes: 60 },
      { name: 'Педикюр', price: 1200, duration_minutes: 75 },
      { name: 'Наращивание ресниц', price: 2500, duration_minutes: 120 },
    ],
  },
  {
    name: 'Лаборатория красоты Amina',
    categoryKey: 'Салоны красоты',
    address: 'ул. Первомайская, 32, Грозный',
    lat: 43.3145,
    lng: 45.6965,
    phone: '+78712002002',
    staff: [
      { phone: '+70001000008', name: 'Амина Берсанова', role: 'admin' },
      { phone: '+70001000009', name: 'Залина Эдилова', role: 'employee' },
    ],
    services: [
      { name: 'Укладка волос', price: 700, duration_minutes: 45 },
      { name: 'Гель-лак маникюр', price: 1200, duration_minutes: 75 },
      { name: 'Наращивание ногтей', price: 2000, duration_minutes: 90 },
    ],
  },

  // ── Автосервисы ──
  {
    name: 'АвтоМастер Грозный',
    categoryKey: 'Автосервисы',
    address: 'ул. Индустриальная, 7, Грозный',
    lat: 43.3103,
    lng: 45.6823,
    phone: '+78712003001',
    staff: [
      { phone: '+70001000010', name: 'Идрис Хусаинов', role: 'admin' },
      { phone: '+70001000011', name: 'Заур Ахмадов', role: 'employee' },
    ],
    services: [
      { name: 'Замена масла', price: 1500, duration_minutes: 30 },
      { name: 'Компьютерная диагностика', price: 1000, duration_minutes: 60 },
      { name: 'Развал-схождение', price: 2000, duration_minutes: 60 },
      { name: 'Шиномонтаж (4 колеса)', price: 1600, duration_minutes: 45 },
    ],
  },

  // ── Медицина ──
  {
    name: 'Клиника Здоровье',
    categoryKey: 'Медицина',
    address: 'пр. Победы, 14, Грозный',
    lat: 43.3221,
    lng: 45.7015,
    phone: '+78712004001',
    staff: [
      { phone: '+70001000012', name: 'Доктор Мусаев Р.И.', role: 'admin' },
      { phone: '+70001000013', name: 'Доктор Хаджиева З.М.', role: 'employee' },
    ],
    services: [
      { name: 'Приём терапевта', price: 1500, duration_minutes: 30 },
      { name: 'УЗИ органов брюшной полости', price: 2500, duration_minutes: 30 },
      { name: 'ЭКГ', price: 800, duration_minutes: 20 },
      { name: 'Анализ крови (общий)', price: 500, duration_minutes: 15 },
    ],
  },

  // ── Стоматология ──
  {
    name: 'Стоматология Жемчуг',
    categoryKey: 'Стоматология',
    address: 'ул. Шейха Мансура, 45, Грозный',
    lat: 43.3159,
    lng: 45.6901,
    phone: '+78712005001',
    instagram_url: 'https://instagram.com/zhemchug_stom',
    staff: [
      { phone: '+70001000014', name: 'Доктор Дудаев А.С.', role: 'admin' },
      { phone: '+70001000015', name: 'Доктор Басаева М.Р.', role: 'employee' },
    ],
    services: [
      { name: 'Консультация врача', price: 500, duration_minutes: 20 },
      { name: 'Лечение кариеса', price: 3500, duration_minutes: 60 },
      { name: 'Профессиональная чистка', price: 4000, duration_minutes: 60 },
      { name: 'Удаление зуба', price: 2500, duration_minutes: 45 },
      { name: 'Рентген зуба', price: 500, duration_minutes: 15 },
    ],
  },
];

// ─── Slug helpers ─────────────────────────────────────────────────────────────

async function generateUniqueSlug(name: string, excludeId?: string): Promise<string> {
  const base = transliterate(name);
  let candidate = base;
  let counter = 2;

  while (true) {
    let qb = db.selectFrom('businesses').select('id').where('slug', '=', candidate);
    if (excludeId) qb = qb.where('id', '!=', excludeId);
    const existing = await qb.executeTakeFirst();
    if (!existing) return candidate;
    candidate = `${base}-${counter}`;
    counter++;
  }
}

async function generateUniqueStaffSlug(
  businessId: string,
  name: string,
  excludeId?: string,
): Promise<string> {
  const base = (transliterate(name).slice(0, 50) || 'staff');
  let candidate = base;
  let counter = 2;

  while (true) {
    let qb = db
      .selectFrom('staff')
      .select('id')
      .where('business_id', '=', businessId)
      .where('slug', '=', candidate);

    if (excludeId) qb = qb.where('id', '!=', excludeId);

    const existing = await qb.executeTakeFirst();
    if (!existing) return candidate;

    candidate = `${base.slice(0, Math.max(1, 50 - `-${counter}`.length))}-${counter}`;
    counter++;
  }
}

// ─── Seed businesses ──────────────────────────────────────────────────────────

async function seedBusiness(
  biz: BusinessSeed,
  categoryMap: Map<string, string>,
): Promise<void> {
  const categoryId = categoryMap.get(biz.categoryKey);
  if (!categoryId) {
    console.error(`  ❌ Категория не найдена: ${biz.categoryKey}`);
    return;
  }

  // Check if business already exists by phone
  const existing = await db
    .selectFrom('businesses')
    .select('id')
    .where('phone', '=', biz.phone)
    .executeTakeFirst();

  let businessId: string;

  if (existing) {
    businessId = existing.id;
    console.log(`  ↳ Бизнес уже существует: ${biz.name}`);

    // Ensure slug is set for existing businesses
    const bizRow = await db
      .selectFrom('businesses')
      .select('slug')
      .where('id', '=', businessId)
      .executeTakeFirst();

    if (!bizRow?.slug) {
      const slug = await generateUniqueSlug(biz.name, businessId);
      await db.updateTable('businesses').set({ slug }).where('id', '=', businessId).execute();
      console.log(`     └─ Slug назначен: ${slug}`);
    }
  } else {
    const slug = await generateUniqueSlug(biz.name);
    const inserted = await db
      .insertInto('businesses')
      .values({
        name: biz.name,
        category_id: categoryId,
        address: biz.address,
        location: sql<string>`ST_SetSRID(ST_MakePoint(${biz.lng}, ${biz.lat}), 4326)::geography`,
        phone: biz.phone,
        instagram_url: biz.instagram_url ?? null,
        website_url: null,
        working_hours: JSON.stringify(WORKING_HOURS),
        photos: JSON.stringify([]),
        portfolio_photos: JSON.stringify([]),
        cancellation_threshold_minutes: 60,
        reminder_settings: JSON.stringify({ sms: true, push: true }),
        is_active: true,
        slug,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    businessId = inserted.id;
    console.log(`  ✅ Бизнес: ${biz.name} (slug: ${slug})`);
  }

  // Seed staff
  const staffIds: string[] = [];
  for (const s of biz.staff) {
    const staffId = await seedStaffMember(s, businessId);
    if (staffId) staffIds.push(staffId);
  }

  // Seed services
  const existingServices = await db
    .selectFrom('services')
    .select('name')
    .where('business_id', '=', businessId)
    .execute();

  if (existingServices.length === 0) {
    for (const svc of biz.services) {
      await db
        .insertInto('services')
        .values({
          business_id: businessId,
          name: svc.name,
          price: svc.price,
          duration_minutes: svc.duration_minutes,
          is_active: true,
        })
        .execute();
    }
    console.log(`     └─ Услуги: ${biz.services.length} шт.`);
  }

  // Seed slots for next 7 days
  for (const staffId of staffIds) {
    await seedSlots(staffId);
  }
}

async function seedStaffMember(
  s: StaffSeed,
  businessId: string,
): Promise<string | null> {
  // Get or create user
  let userId: string;
  const existingUser = await db
    .selectFrom('users')
    .select('id')
    .where('phone', '=', s.phone)
    .executeTakeFirst();

  if (existingUser) {
    userId = existingUser.id;
  } else {
    const newUser = await db
      .insertInto('users')
      .values({ phone: s.phone, name: s.name, language: 'ru' })
      .returning('id')
      .executeTakeFirstOrThrow();
    userId = newUser.id;
  }

  // Check if staff record exists
  const existingStaff = await db
    .selectFrom('staff')
    .select(['id', 'slug'])
    .where('business_id', '=', businessId)
    .where('user_id', '=', userId)
    .executeTakeFirst();

  if (existingStaff) {
    if (!existingStaff.slug) {
      const slug = await generateUniqueStaffSlug(businessId, s.name, existingStaff.id);
      await db.updateTable('staff').set({ slug }).where('id', '=', existingStaff.id).execute();
    }
    return existingStaff.id;
  }

  const slug = await generateUniqueStaffSlug(businessId, s.name);

  const newStaff = await db
    .insertInto('staff')
    .values({
      business_id: businessId,
      user_id: userId,
      name: s.name,
      slug,
      role: s.role,
      avatar_url: null,
      is_active: true,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  return newStaff.id;
}

async function seedSlots(staffId: string): Promise<void> {
  const today = new Date();
  const dates: string[] = [];
  for (let i = 1; i <= 7; i++) {
    dates.push(toDateString(addDays(today, i)));
  }

  for (const date of dates) {
    // Check if slots already exist for this staff+date
    const existing = await db
      .selectFrom('slots')
      .select('id')
      .where('staff_id', '=', staffId)
      .where('date', '=', new Date(date))
      .limit(1)
      .executeTakeFirst();

    if (existing) continue;

    const slotRows = SLOT_TIMES.map((t) => ({
      staff_id: staffId,
      date,
      start_time: t,
      is_booked: false as boolean,
    }));

    await db.insertInto('slots').values(slotRows).execute();
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🌱 Начинаю seed...\n');

  console.log('📂 Категории:');
  const categoryMap = await seedCategories();

  console.log('\n🏢 Бизнесы:');
  for (const biz of BUSINESSES) {
    await seedBusiness(biz, categoryMap);
  }

  // Verification
  const catCount = await db
    .selectFrom('categories')
    .select(db.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow();
  const bizCount = await db
    .selectFrom('businesses')
    .select(db.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow();
  const slotCount = await db
    .selectFrom('slots')
    .select(db.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow();

  console.log(`
✅ Seed завершён:
   Категории: ${catCount.count}
   Бизнесы:   ${bizCount.count}
   Слоты:     ${slotCount.count}
`);

  await db.destroy();
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
