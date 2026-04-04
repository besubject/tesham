import * as path from 'path';
import { FileMigrationProvider, Migrator } from 'kysely';
import * as fs from 'fs/promises';
import { db } from './index';

async function main(): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, 'migrations'),
    }),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`✅ Migration "${it.migrationName}" applied successfully`);
    } else if (it.status === 'Error') {
      console.error(`❌ Failed to apply migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }

  if (!results || results.length === 0) {
    console.log('No pending migrations');
  }

  await db.destroy();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
