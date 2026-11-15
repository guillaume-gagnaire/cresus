import { fileURLToPath } from 'node:url';
import type { DbHandle } from './client.js';

/** apps/api/drizzle, que l'on parte de src/db (tests) ou de dist/db (build). */
export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url));

/** Journal propre à Cresus (et non drizzle.__drizzle_migrations, qu'avait rempli Ma Tréso dans la même base). */
const JOURNAL = { migrationsSchema: 'cresus', migrationsTable: '__migrations' } as const;

export async function runMigrations(handle: DbHandle): Promise<void> {
  if (handle.target.kind === 'pglite') {
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    await migrate(handle.db as never, { migrationsFolder: MIGRATIONS_FOLDER, ...JOURNAL });
  } else {
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    await migrate(handle.db as never, { migrationsFolder: MIGRATIONS_FOLDER, ...JOURNAL });
  }
}
