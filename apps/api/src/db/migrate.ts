import { fileURLToPath } from 'node:url';
import type { DbHandle } from './client.js';

/** apps/api/drizzle, que l'on parte de src/db (tests) ou de dist/db (build). */
export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url));

export async function runMigrations(handle: DbHandle): Promise<void> {
  if (handle.target.kind === 'pglite') {
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    await migrate(handle.db as never, { migrationsFolder: MIGRATIONS_FOLDER });
  } else {
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    await migrate(handle.db as never, { migrationsFolder: MIGRATIONS_FOLDER });
  }
}
