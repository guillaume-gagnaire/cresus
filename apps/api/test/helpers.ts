import type { NestExpressApplication } from '@nestjs/platform-express';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { createApp } from '../src/bootstrap.js';
import { loadConfig } from '../src/config.js';
import { DB, type Db } from '../src/db/db.module.js';

export async function setupTestApp(overrides: Record<string, string> = {}): Promise<NestExpressApplication> {
  const config = loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    // PGlite en mémoire par défaut ; DATABASE_URL_TEST=postgres://… permet de viser un vrai PostgreSQL
    DATABASE_URL: process.env.DATABASE_URL_TEST ?? 'pglite:memory',
    SESSION_SECRET: 'test-secret-test-secret',
    SEED_DEMO: 'false',
    // limite haute par défaut pour que les tests d'auth restent déterministes ; les tests de limitation créent leur propre app
    AUTH_RATE_LIMIT: '1000',
    ...overrides,
  });
  const app = await createApp(config);
  await app.init();
  return app;
}

export async function resetDb(app: NestExpressApplication): Promise<void> {
  await app.get<Db>(DB).execute(sql`TRUNCATE users, sessions, passkeys, balance_snapshots, clients, rates, leaves, charges, oauth_clients, oauth_requests, oauth_codes, oauth_tokens CASCADE`);
}

/** Agent supertest qui conserve les cookies. */
export const agentFor = (app: NestExpressApplication) => request.agent(app.getHttpServer());
