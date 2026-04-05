import type { Kysely } from 'kysely';
import { sql } from 'kysely';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('notification_log')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('booking_id', 'uuid', (col) =>
      col.references('bookings.id').onDelete('set null'),
    )
    .addColumn('channel', 'varchar(20)', (col) => col.notNull())
    .addColumn('event_type', 'varchar(50)', (col) => col.notNull())
    .addColumn('phone', 'varchar(20)', (col) => col.notNull())
    .addColumn('message', 'text', (col) => col.notNull())
    .addColumn('status', 'varchar(20)', (col) => col.notNull().defaultTo('sent'))
    .addColumn('error_message', 'text')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('notification_log_booking_id_idx')
    .on('notification_log')
    .column('booking_id')
    .execute();

  await db.schema
    .createIndex('notification_log_created_at_idx')
    .on('notification_log')
    .column('created_at')
    .execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('notification_log').execute();
}
