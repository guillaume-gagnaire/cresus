import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { openDb } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';

/** Lignes d'un résultat brut (PGlite et node-postgres les rangent dans `rows`). */
const rowsOf = <T>(result: unknown): T[] => ((result as { rows?: T[] }).rows ?? (result as T[]));

describe('base de données', () => {
  it('installe Cresus dans son schéma et efface les restes de Ma Tréso (tables, types, journal)', async () => {
    const handle = await openDb('pglite:memory');
    try {
      // ce que Ma Tréso laissait dans la base de production
      await handle.db.execute(sql`create type public.user_role as enum ('ADMIN', 'USER')`);
      await handle.db.execute(sql`create table public.users (id serial primary key, email text, role public.user_role)`);
      await handle.db.execute(sql`create table public.sessions (id text primary key, user_id integer references public.users(id))`);
      await handle.db.execute(sql`create table public.oauth_tokens (id text primary key)`);
      await handle.db.execute(sql`insert into public.users (email) values ('ancien@matreso.fr')`);
      await handle.db.execute(sql`create schema drizzle`);
      await handle.db.execute(sql`create table drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)`);
      await handle.db.execute(sql`insert into drizzle.__drizzle_migrations (hash, created_at) values ('ancien', 9999999999999)`);

      await runMigrations(handle);
      await runMigrations(handle); // rejouer au redémarrage ne fait rien

      const tables = rowsOf<{ table_schema: string; table_name: string }>(
        await handle.db.execute(sql`select table_schema, table_name from information_schema.tables where table_schema in ('public', 'cresus', 'drizzle') order by 1, 2`),
      );
      expect(tables.filter((t) => t.table_schema === 'cresus').map((t) => t.table_name)).toEqual(
        expect.arrayContaining(['accounts', 'articles', 'events', 'sales', 'sessions']),
      );
      expect(tables.filter((t) => t.table_schema !== 'cresus')).toEqual([]);
      const types = rowsOf<{ typname: string }>(
        await handle.db.execute(sql`select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typtype = 'e'`),
      );
      expect(types).toEqual([]);
    } finally {
      await handle.close();
    }
  });

  it('se migre sans erreur sur une base neuve', async () => {
    const handle = await openDb('pglite:memory');
    try {
      await runMigrations(handle);
      const n = rowsOf<{ n: number }>(await handle.db.execute(sql`select count(*)::int as n from cresus.accounts`));
      expect(n[0]!.n).toBe(0);
    } finally {
      await handle.close();
    }
  });
});
