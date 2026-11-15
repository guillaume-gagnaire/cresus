import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { openDb } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';

/** Lignes d'un résultat brut (PGlite et node-postgres les rangent dans `rows`). */
const rowsOf = <T>(result: unknown): T[] => ((result as { rows?: T[] }).rows ?? (result as T[]));

describe('base de données', () => {
  it('installe Cresus dans son schéma, à côté des tables d’une ancienne appli (Ma Tréso) sans y toucher', async () => {
    const handle = await openDb('pglite:memory');
    try {
      // l'ancienne appli occupait public (dont une table « sessions ») et le journal drizzle par défaut
      await handle.db.execute(sql`create table public.users (id serial primary key, email text)`);
      await handle.db.execute(sql`create table public.sessions (id text primary key, user_id integer)`);
      await handle.db.execute(sql`insert into public.users (email) values ('ancien@matreso.fr')`);
      await handle.db.execute(sql`create schema drizzle`);
      await handle.db.execute(sql`create table drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)`);
      await handle.db.execute(sql`insert into drizzle.__drizzle_migrations (hash, created_at) values ('ancien', 9999999999999)`);

      await runMigrations(handle);
      await runMigrations(handle); // rejouer au redémarrage ne fait rien

      const names = rowsOf<{ table_name: string }>(
        await handle.db.execute(sql`select table_name from information_schema.tables where table_schema = 'cresus' order by table_name`),
      );
      expect(names.map((t) => t.table_name)).toEqual(expect.arrayContaining(['accounts', 'articles', 'events', 'sales', 'sessions']));
      const legacy = rowsOf<{ n: number }>(await handle.db.execute(sql`select count(*)::int as n from public.users`));
      expect(legacy[0]!.n).toBe(1);
    } finally {
      await handle.close();
    }
  });
});
