import type { Kysely } from 'kysely';
import { sql } from 'kysely';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('events')
    .addColumn('device_type', 'varchar(50)', (col) => col.defaultTo(null))
    .execute();

  await db.schema
    .alterTable('events')
    .addColumn('app_version', 'varchar(20)', (col) => col.defaultTo(null))
    .execute();

  await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS lat NUMERIC(9,6)`.execute(db);
  await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS lng NUMERIC(9,6)`.execute(db);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('events').dropColumn('lng').execute();
  await db.schema.alterTable('events').dropColumn('lat').execute();
  await db.schema.alterTable('events').dropColumn('app_version').execute();
  await db.schema.alterTable('events').dropColumn('device_type').execute();
}
