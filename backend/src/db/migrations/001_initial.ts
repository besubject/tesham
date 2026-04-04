import type { Kysely } from 'kysely';
import { sql } from 'kysely';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  // Enable PostGIS
  await sql`CREATE EXTENSION IF NOT EXISTS postgis`.execute(db);

  // Enable pgcrypto for gen_random_uuid()
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`.execute(db);

  // ─── users ────────────────────────────────────────────────────────────────
  await db.schema
    .createTable('users')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('phone', 'varchar(20)', (col) => col.notNull().unique())
    .addColumn('name', 'varchar(255)', (col) => col.notNull().defaultTo(''))
    .addColumn('language', 'varchar(2)', (col) => col.notNull().defaultTo('ru'))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('users_phone_idx')
    .on('users')
    .column('phone')
    .execute();

  // ─── categories ──────────────────────────────────────────────────────────
  await db.schema
    .createTable('categories')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('name_ru', 'varchar(255)', (col) => col.notNull())
    .addColumn('name_ce', 'varchar(255)', (col) => col.notNull())
    .addColumn('icon', 'varchar(255)', (col) => col.notNull())
    .addColumn('sort_order', 'integer', (col) => col.notNull().defaultTo(0))
    .execute();

  // ─── businesses ──────────────────────────────────────────────────────────
  await db.schema
    .createTable('businesses')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('category_id', 'uuid', (col) =>
      col.notNull().references('categories.id').onDelete('restrict'),
    )
    .addColumn('address', 'text', (col) => col.notNull())
    .addColumn(
      'location',
      sql`geography(Point, 4326)`,
      (col) => col.notNull(),
    )
    .addColumn('phone', 'varchar(20)', (col) => col.notNull())
    .addColumn('instagram_url', 'varchar(500)', (col) => col.defaultTo(null))
    .addColumn('website_url', 'varchar(500)', (col) => col.defaultTo(null))
    .addColumn('working_hours', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'{}'::jsonb`),
    )
    .addColumn('photos', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'[]'::jsonb`),
    )
    .addColumn('portfolio_photos', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'[]'::jsonb`),
    )
    .addColumn('cancellation_threshold_minutes', 'integer', (col) =>
      col.notNull().defaultTo(60),
    )
    .addColumn('reminder_settings', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'{}'::jsonb`),
    )
    .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // GiST index on location for geo queries
  await sql`CREATE INDEX businesses_location_gist_idx ON businesses USING GIST (location)`.execute(
    db,
  );

  await db.schema
    .createIndex('businesses_category_id_idx')
    .on('businesses')
    .column('category_id')
    .execute();

  await db.schema
    .createIndex('businesses_phone_idx')
    .on('businesses')
    .column('phone')
    .execute();

  // ─── staff ───────────────────────────────────────────────────────────────
  await db.schema
    .createTable('staff')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('business_id', 'uuid', (col) =>
      col.notNull().references('businesses.id').onDelete('cascade'),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('role', 'varchar(20)', (col) => col.notNull().defaultTo('employee'))
    .addColumn('avatar_url', 'varchar(500)', (col) => col.defaultTo(null))
    .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(true))
    .execute();

  await db.schema
    .createIndex('staff_business_id_idx')
    .on('staff')
    .column('business_id')
    .execute();

  // ─── services ────────────────────────────────────────────────────────────
  await db.schema
    .createTable('services')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('business_id', 'uuid', (col) =>
      col.notNull().references('businesses.id').onDelete('cascade'),
    )
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('price', 'integer', (col) => col.notNull())
    .addColumn('duration_minutes', 'integer', (col) => col.notNull())
    .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(true))
    .execute();

  await db.schema
    .createIndex('services_business_id_idx')
    .on('services')
    .column('business_id')
    .execute();

  // ─── slots ────────────────────────────────────────────────────────────────
  await db.schema
    .createTable('slots')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('staff_id', 'uuid', (col) =>
      col.notNull().references('staff.id').onDelete('cascade'),
    )
    .addColumn('date', 'date', (col) => col.notNull())
    .addColumn('start_time', 'varchar(5)', (col) => col.notNull())
    .addColumn('is_booked', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('slots_staff_id_idx')
    .on('slots')
    .column('staff_id')
    .execute();

  await db.schema
    .createIndex('slots_staff_date_idx')
    .on('slots')
    .columns(['staff_id', 'date'])
    .execute();

  // ─── bookings ────────────────────────────────────────────────────────────
  await db.schema
    .createTable('bookings')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('slot_id', 'uuid', (col) =>
      col.notNull().references('slots.id').onDelete('restrict'),
    )
    .addColumn('service_id', 'uuid', (col) =>
      col.notNull().references('services.id').onDelete('restrict'),
    )
    .addColumn('business_id', 'uuid', (col) =>
      col.notNull().references('businesses.id').onDelete('restrict'),
    )
    .addColumn('staff_id', 'uuid', (col) =>
      col.notNull().references('staff.id').onDelete('restrict'),
    )
    .addColumn('status', 'varchar(20)', (col) =>
      col.notNull().defaultTo('confirmed'),
    )
    .addColumn('cancelled_at', 'timestamptz', (col) => col.defaultTo(null))
    .addColumn('source', 'varchar(20)', (col) => col.notNull().defaultTo('app'))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('bookings_user_id_idx')
    .on('bookings')
    .column('user_id')
    .execute();

  await db.schema
    .createIndex('bookings_slot_id_idx')
    .on('bookings')
    .column('slot_id')
    .execute();

  await db.schema
    .createIndex('bookings_business_id_idx')
    .on('bookings')
    .column('business_id')
    .execute();

  await db.schema
    .createIndex('bookings_staff_id_idx')
    .on('bookings')
    .column('staff_id')
    .execute();

  // ─── reviews ─────────────────────────────────────────────────────────────
  await db.schema
    .createTable('reviews')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('booking_id', 'uuid', (col) =>
      col.notNull().unique().references('bookings.id').onDelete('cascade'),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('business_id', 'uuid', (col) =>
      col.notNull().references('businesses.id').onDelete('cascade'),
    )
    .addColumn('rating', 'smallint', (col) => col.notNull())
    .addColumn('text', 'text', (col) => col.notNull().defaultTo(''))
    .addColumn('reply_text', 'text', (col) => col.defaultTo(null))
    .addColumn('reply_at', 'timestamptz', (col) => col.defaultTo(null))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('reviews_business_id_idx')
    .on('reviews')
    .column('business_id')
    .execute();

  // ─── favorites ────────────────────────────────────────────────────────────
  await db.schema
    .createTable('favorites')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('business_id', 'uuid', (col) =>
      col.references('businesses.id').onDelete('cascade'),
    )
    .addColumn('staff_id', 'uuid', (col) =>
      col.references('staff.id').onDelete('cascade'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('favorites_user_id_idx')
    .on('favorites')
    .column('user_id')
    .execute();

  // ─── events ──────────────────────────────────────────────────────────────
  await db.schema
    .createTable('events')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('event_type', 'varchar(100)', (col) => col.notNull())
    .addColumn('session_id', 'varchar(100)', (col) => col.defaultTo(null))
    .addColumn('anonymous_user_hash', 'varchar(64)', (col) =>
      col.defaultTo(null),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('payload', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'{}'::jsonb`),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // Composite index on event_type + created_at for analytics queries
  await db.schema
    .createIndex('events_type_created_idx')
    .on('events')
    .columns(['event_type', 'created_at'])
    .execute();

  await db.schema
    .createIndex('events_session_id_idx')
    .on('events')
    .column('session_id')
    .execute();

  await db.schema
    .createIndex('events_anonymous_user_hash_idx')
    .on('events')
    .column('anonymous_user_hash')
    .execute();

  // GIN index on payload for JSON queries (e.g. payload->>'business_id')
  await sql`CREATE INDEX events_payload_gin_idx ON events USING GIN (payload)`.execute(
    db,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('events').ifExists().execute();
  await db.schema.dropTable('favorites').ifExists().execute();
  await db.schema.dropTable('reviews').ifExists().execute();
  await db.schema.dropTable('bookings').ifExists().execute();
  await db.schema.dropTable('slots').ifExists().execute();
  await db.schema.dropTable('services').ifExists().execute();
  await db.schema.dropTable('staff').ifExists().execute();
  await db.schema.dropTable('businesses').ifExists().execute();
  await db.schema.dropTable('categories').ifExists().execute();
  await db.schema.dropTable('users').ifExists().execute();
}
