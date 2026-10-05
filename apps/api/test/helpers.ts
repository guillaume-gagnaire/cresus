import { createHash, randomBytes } from 'node:crypto';
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
    // idem pour les limites du routeur OAuth du SDK (20 /register par heure, 50 /token par 15 min…) ; un test dédié les vérifie
    OAUTH_RATE_LIMIT_MULTIPLIER: '1000',
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

/** Redirection acceptée par l'enregistrement OAuth (boucle locale : le cas de Claude Code). */
export const OAUTH_TEST_REDIRECT = 'http://localhost:33418/callback';

/**
 * Parcours OAuth 2.1 complet (enregistrement dynamique, PKCE S256, consentement approuvé par `agent`, échange du code)
 * et renvoie le jeton d'accès, à présenter en `Authorization: Bearer`. `agent` est la session de l'utilisateur qui consent.
 */
export async function issueAccessToken(app: NestExpressApplication, agent: ReturnType<typeof agentFor>): Promise<string> {
  const http = () => request(app.getHttpServer());
  const registered = await http()
    .post('/register')
    .send({
      client_name: 'Claude Code',
      redirect_uris: [OAUTH_TEST_REDIRECT],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    })
    .expect(201);
  const clientId = registered.body.client_id as string;
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const authorized = await http()
    .get('/authorize')
    .query({ response_type: 'code', client_id: clientId, redirect_uri: OAUTH_TEST_REDIRECT, code_challenge: challenge, code_challenge_method: 'S256', state: 'xyz', scope: 'cresus' })
    .expect(302);
  const requestId = new URL(authorized.headers.location as string).searchParams.get('request');
  const approved = await agent.post(`/api/oauth/requests/${requestId}/approve`).send({}).expect(200);
  const code = new URL(approved.body.redirectUrl as string).searchParams.get('code');
  const tokens = await http()
    .post('/token')
    .type('form')
    .send({ grant_type: 'authorization_code', code, code_verifier: verifier, client_id: clientId, redirect_uri: OAUTH_TEST_REDIRECT })
    .expect(200);
  return tokens.body.access_token as string;
}
