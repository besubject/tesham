import type { Kysely } from 'kysely';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  // Make user_id nullable to support walk-in bookings without a registered user
  await db.schema
    .alterTable('bookings')
    .alterColumn('user_id', (col) => col.dropNotNull())
    .execute();

  // Add client metadata columns for walk-in bookings
  await db.schema
    .alterTable('bookings')
    .addColumn('client_name', 'varchar(200)')
    .execute();

  await db.schema
    .alterTable('bookings')
    .addColumn('client_phone', 'varchar(20)')
    .execute();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('bookings').dropColumn('client_phone').execute();
  await db.schema.alterTable('bookings').dropColumn('client_name').execute();

  // Restore NOT NULL on user_id (only safe if no walk-in bookings exist)
  await db.schema
    .alterTable('bookings')
    .alterColumn('user_id', (col) => col.setNotNull())
    .execute();
}
