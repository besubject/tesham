import type { Kysely } from 'kysely';
import { sql } from 'kysely';

// BookingSource is stored as varchar(20) in the DB, not as a PostgreSQL enum.
// So adding 'link' as a valid value only requires TypeScript types update (done in types.ts).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  // ─── businesses.slug ─────────────────────────────────────────────────────
  await db.schema
    .alterTable('businesses')
    .addColumn('slug', 'varchar(255)')
    .execute();

  await db.schema
    .createIndex('businesses_slug_idx')
    .on('businesses')
    .column('slug')
    .unique()
    .execute();

  // ─── chat_messages ───────────────────────────────────────────────────────
  await db.schema
    .createTable('chat_messages')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('booking_id', 'uuid', (col) =>
      col.notNull().references('bookings.id').onDelete('cascade'),
    )
    .addColumn('sender_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('sender_role', 'varchar(20)', (col) => col.notNull()) // 'client' | 'staff'
    .addColumn('message_type', 'varchar(10)', (col) => col.notNull()) // 'text' | 'image'
    .addColumn('content', 'text', (col) => col.notNull())
    .addColumn('is_read', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('chat_messages_booking_created_idx')
    .on('chat_messages')
    .columns(['booking_id', 'created_at'])
    .execute();

  await db.schema
    .createIndex('chat_messages_sender_idx')
    .on('chat_messages')
    .column('sender_id')
    .execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('chat_messages_sender_idx').execute();
  await db.schema.dropIndex('chat_messages_booking_created_idx').execute();
  await db.schema.dropTable('chat_messages').execute();

  await db.schema.dropIndex('businesses_slug_idx').execute();
  await db.schema.alterTable('businesses').dropColumn('slug').execute();

  // Note: PostgreSQL does not support removing enum values, so 'link' stays in the enum type
}
