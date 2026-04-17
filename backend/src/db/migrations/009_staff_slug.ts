import type { Kysely } from 'kysely';
import { transliterate } from '../../utils/transliterate';

function buildStaffSlug(name: string): string {
  return transliterate(name).slice(0, 50) || 'staff';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('staff')
    .addColumn('slug', 'varchar(255)')
    .execute();

  const staffRows = await db
    .selectFrom('staff')
    .select(['id', 'business_id', 'name'])
    .execute();

  const usedByBusiness = new Map<string, Set<string>>();

  for (const row of staffRows) {
    const businessUsed = usedByBusiness.get(row.business_id) ?? new Set<string>();
    usedByBusiness.set(row.business_id, businessUsed);

    const base = buildStaffSlug(row.name);
    let candidate = base;
    let counter = 2;

    while (businessUsed.has(candidate)) {
      candidate = `${base.slice(0, Math.max(1, 50 - `-${counter}`.length))}-${counter}`;
      counter++;
    }

    businessUsed.add(candidate);

    await db
      .updateTable('staff')
      .set({ slug: candidate })
      .where('id', '=', row.id)
      .execute();
  }

  await db.schema
    .alterTable('staff')
    .alterColumn('slug', (col) => col.setNotNull())
    .execute();

  await db.schema
    .createIndex('staff_business_slug_idx')
    .on('staff')
    .columns(['business_id', 'slug'])
    .unique()
    .execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('staff_business_slug_idx').execute();
  await db.schema.alterTable('staff').dropColumn('slug').execute();
}
