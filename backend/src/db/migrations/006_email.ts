import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('users')
    .addColumn('email', 'varchar(255)', (col) => col.unique())
    .execute();

  await db.schema
    .alterTable('users')
    .addColumn('email_verified', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .execute();

  await db.schema
    .alterTable('users')
    .addColumn('last_login_at', 'timestamptz')
    .execute();

  await db.schema
    .createIndex('users_email_idx')
    .on('users')
    .column('email')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('users_email_idx').execute();
  await db.schema.alterTable('users').dropColumn('last_login_at').execute();
  await db.schema.alterTable('users').dropColumn('email_verified').execute();
  await db.schema.alterTable('users').dropColumn('email').execute();
}
