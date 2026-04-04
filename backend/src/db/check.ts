import { sql } from 'kysely';
import { db } from './index';

async function checkDatabase(): Promise<void> {
  console.log('Checking database connection...');

  // Basic connectivity
  const nowResult = await sql<{ now: Date }>`SELECT NOW() AS now`.execute(db);
  const now = nowResult.rows[0]?.now;
  console.log(`✓ Connected to PostgreSQL at ${now?.toISOString()}`);

  // PostGIS availability
  const postgisResult = await sql<{
    postgis_version: string;
  }>`SELECT PostGIS_version() AS postgis_version`.execute(db);
  const postgis_version = postgisResult.rows[0]?.postgis_version;
  console.log(`✓ PostGIS version: ${postgis_version}`);

  await db.destroy();
  console.log('Database check passed.');
}

checkDatabase().catch((err: unknown) => {
  console.error('Database check failed:', err);
  process.exit(1);
});
