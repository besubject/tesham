import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { config } from '../config';
import type { Database } from './types';

const pool = new Pool({
  connectionString: config.db.url,
  min: config.db.poolMin,
  max: config.db.poolMax,
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});
