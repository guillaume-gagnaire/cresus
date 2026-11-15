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
    // limite haute par défaut pour que les tests restent déterministes ; les tests de limitation créent leur propre app
    AUTH_RATE_LIMIT: '1000',
    ...overrides,
  });
  const app = await createApp(config);
  await app.init();
  return app;
}

export async function resetDb(app: NestExpressApplication): Promise<void> {
  await app.get<Db>(DB).execute(sql`TRUNCATE accounts, sessions, events, articles, sales CASCADE`);
}

/** Agent supertest qui conserve les cookies. */
export const agentFor = (app: NestExpressApplication) => request.agent(app.getHttpServer());

/** Agent connecté à une asso fraîchement inscrite. */
export async function signedUpAgent(app: NestExpressApplication, email = 'ape@ecole.fr') {
  const agent = agentFor(app);
  await agent.post('/api/auth/signup').send({ name: `APE ${email}`, email, password: 'kermesse2027' }).expect(201);
  return agent;
}

export type Agent = Awaited<ReturnType<typeof signedUpAgent>>;

/** Évènement « Kermesse 2027 » avec ses articles (nom, prix en centimes). */
export async function eventWithArticles(agent: Agent, articles: Array<[string, number]> = [], name = 'Kermesse 2027') {
  const event = (await agent.post('/api/events').send({ name, date: '2027-06-20' }).expect(201)).body as { id: string };
  const ids: string[] = [];
  for (const [articleName, priceCents] of articles) {
    ids.push((await agent.post(`/api/events/${event.id}/articles`).send({ name: articleName, priceCents }).expect(201)).body.id as string);
  }
  return { eventId: event.id, articleIds: ids };
}
