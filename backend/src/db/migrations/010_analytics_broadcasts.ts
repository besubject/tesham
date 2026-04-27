import type { Kysely } from 'kysely';
import { sql } from 'kysely';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  // ─── Add completed_at to bookings ─────────────────────────────────────────
  await db.schema
    .alterTable('bookings')
    .addColumn('completed_at', 'timestamptz')
    .execute();

  // ─── Analytics indexes on bookings ────────────────────────────────────────
  await db.schema
    .createIndex('bookings_business_status_completed_idx')
    .on('bookings')
    .columns(['business_id', 'status', 'completed_at'])
    .execute();

  await db.schema
    .createIndex('bookings_staff_status_completed_idx')
    .on('bookings')
    .columns(['staff_id', 'status', 'completed_at'])
    .execute();

  await db.schema
    .createIndex('bookings_business_user_idx')
    .on('bookings')
    .columns(['business_id', 'user_id'])
    .execute();

  await db.schema
    .createIndex('bookings_business_client_phone_idx')
    .on('bookings')
    .columns(['business_id', 'client_phone'])
    .execute();

  // ─── broadcasts table ──────────────────────────────────────────────────────
  await db.schema
    .createTable('broadcasts')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('business_id', 'uuid', (col) =>
      col.notNull().references('businesses.id').onDelete('cascade'),
    )
    .addColumn('audience', 'varchar(20)', (col) => col.notNull()) // 'all' | 'regulars' | 'sleeping' | 'lost' | 'new'
    .addColumn('title', 'varchar(40)', (col) => col.notNull())
    .addColumn('body', 'varchar(160)', (col) => col.notNull())
    .addColumn('created_by_user_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('restrict'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('sent_at', 'timestamptz')
    .addColumn('total_recipients', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('delivered_count', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('skipped_no_token', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('skipped_rate_limit', 'integer', (col) => col.notNull().defaultTo(0))
    .execute();

  await db.schema
    .createIndex('broadcasts_business_created_idx')
    .on('broadcasts')
    .columns(['business_id', 'created_at'])
    .execute();

  // ─── broadcast_recipients table ───────────────────────────────────────────
  await db.schema
    .createTable('broadcast_recipients')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('broadcast_id', 'uuid', (col) =>
      col.notNull().references('broadcasts.id').onDelete('cascade'),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('status', 'varchar(30)', (col) => col.notNull()) // 'delivered' | 'skipped_no_token' | 'skipped_rate_limit' | 'failed'
    .addColumn('error_message', 'text')
    .addColumn('sent_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // Unique: one record per user per broadcast
  await db.schema
    .createIndex('broadcast_recipients_broadcast_user_idx')
    .on('broadcast_recipients')
    .columns(['broadcast_id', 'user_id'])
    .unique()
    .execute();

  // For rate-limit check: 1 push/week/client/business
  await db.schema
    .createIndex('broadcast_recipients_user_sent_idx')
    .on('broadcast_recipients')
    .columns(['user_id', 'sent_at'])
    .execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('broadcast_recipients_user_sent_idx').execute();
  await db.schema.dropIndex('broadcast_recipients_broadcast_user_idx').execute();
  await db.schema.dropTable('broadcast_recipients').execute();

  await db.schema.dropIndex('broadcasts_business_created_idx').execute();
  await db.schema.dropTable('broadcasts').execute();

  await db.schema.dropIndex('bookings_business_client_phone_idx').execute();
  await db.schema.dropIndex('bookings_business_user_idx').execute();
  await db.schema.dropIndex('bookings_staff_status_completed_idx').execute();
  await db.schema.dropIndex('bookings_business_status_completed_idx').execute();

  await db.schema.alterTable('bookings').dropColumn('completed_at').execute();
}
