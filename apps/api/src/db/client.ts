import { mkdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { Logger } from '@nestjs/common';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import pg from 'pg';
import * as schema from './schema.js';

/** Type commun aux deux pilotes (node-postgres en prod, PGlite en dev/test). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export type DbTarget = { kind: 'pglite'; dataDir: string | null } | { kind: 'postgres'; url: string };

export interface DbHandle {
  db: Db;
  target: DbTarget;
  close(): Promise<void>;
}

/** `pglite:memory` → PGlite en mémoire ; `pglite:<dossier>` → PGlite persistant ; sinon URL PostgreSQL. */
export function parseDbTarget(url: string): DbTarget {
  if (url === 'pglite:memory') return { kind: 'pglite', dataDir: null };
  if (url.startsWith('pglite:')) return { kind: 'pglite', dataDir: url.slice('pglite:'.length) };
  return { kind: 'postgres', url };
}

export async function openDb(url: string): Promise<DbHandle> {
  const target = parseDbTarget(url);
  if (target.kind === 'pglite') {
    if (target.dataDir) mkdirSync(target.dataDir, { recursive: true });
    const client = target.dataDir ? new PGlite(target.dataDir) : new PGlite();
    await client.waitReady;
    return { db: drizzlePglite({ client, schema }) as unknown as Db, target, close: () => client.close() };
  }
  const pool = new pg.Pool({ connectionString: target.url, max: 10 });
  // une erreur sur un client inactif (coupure réseau, redémarrage de PostgreSQL) ne doit pas faire tomber le processus
  const logger = new Logger('Db');
  pool.on('error', (err) => logger.error(`Erreur sur un client PostgreSQL inactif : ${err.message}`, err.stack));
  return { db: drizzlePg({ client: pool, schema }) as unknown as Db, target, close: () => pool.end() };
}
