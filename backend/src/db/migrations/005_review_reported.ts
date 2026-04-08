import type { Kysely } from 'kysely';
import { sql } from 'kysely';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('reviews')
    .addColumn('is_reported', 'boolean', (col) => col.notNull().defaultTo(false))
    .execute();

  await db.schema
    .alterTable('reviews')
    .addColumn('reported_at', 'timestamptz')
    .execute();

  await db.schema
    .alterTable('reviews')
    .addColumn('reported_reason', 'varchar(500)')
    .execute();

  await sql`CREATE INDEX reviews_is_reported_idx ON reviews (is_reported) WHERE is_reported = true`.execute(
    db,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('reviews_is_reported_idx').execute();
  await db.schema.alterTable('reviews').dropColumn('reported_reason').execute();
  await db.schema.alterTable('reviews').dropColumn('reported_at').execute();
  await db.schema.alterTable('reviews').dropColumn('is_reported').execute();
}
