import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DB, type Db } from '../src/db/db.module.js';
import { sessions } from '../src/db/schema.js';
import { agentFor, resetDb, setupTestApp } from './helpers.js';

const creds = { email: 'Guillaume@Example.com', password: 'motdepasse1', firstName: 'Guillaume' };

describe('auth', () => {
  let app: NestExpressApplication;
  beforeAll(async () => { app = await setupTestApp(); });
  beforeEach(async () => { await resetDb(app); });
  afterAll(async () => { await app.close(); });

  it('registers, sets an httpOnly session cookie and returns the profile', async () => {
    const agent = agentFor(app);
    const res = await agent.post('/api/auth/register').send(creds).expect(201);
    expect(res.headers['set-cookie']?.[0]).toMatch(/mt_session=.+; .*HttpOnly/i);
    expect(res.body.user).toMatchObject({ email: 'guillaume@example.com', firstName: 'Guillaume', legalStatus: 'SASU', netPayMonthly: 0 });
    expect(res.body.hasPasskey).toBe(false);
    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.user.email).toBe('guillaume@example.com');
  });

  it('refuses a duplicate e-mail and weak inputs with French messages', async () => {
    await agentFor(app).post('/api/auth/register').send(creds).expect(201);
    const dup = await agentFor(app).post('/api/auth/register').send(creds).expect(409);
    expect(dup.body).toMatchObject({ code: 'EMAIL_TAKEN', message: 'Un compte existe déjà avec cet e-mail.' });
    const weak = await agentFor(app).post('/api/auth/register').send({ ...creds, email: 'x@y.fr', password: 'court' }).expect(400);
    expect(weak.body.message).toBe('Ton mot de passe doit faire au moins 8 caractères.');
  });

  it('logs in, logs out, and rejects bad credentials', async () => {
    await agentFor(app).post('/api/auth/register').send(creds).expect(201);
    const bad = await agentFor(app).post('/api/auth/login').send({ email: creds.email, password: 'mauvais-mdp' }).expect(401);
    expect(bad.body.message).toBe('E-mail ou mot de passe incorrect.');
    const agent = agentFor(app);
    await agent.post('/api/auth/login').send({ email: 'guillaume@example.com', password: creds.password }).expect(200);
    await agent.get('/api/auth/me').expect(200);
    await agent.post('/api/auth/logout').send({}).expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  it('protects routes without a session', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    expect(res.body).toMatchObject({ code: 'UNAUTHENTICATED', message: 'Connecte-toi pour continuer.' });
  });

  it('changes the password with the current one', async () => {
    const agent = agentFor(app);
    await agent.post('/api/auth/register').send(creds).expect(201);
    await agent.patch('/api/auth/password').send({ currentPassword: 'faux-faux', newPassword: 'nouveau-mdp' }).expect(401);
    await agent.patch('/api/auth/password').send({ currentPassword: creds.password, newPassword: 'nouveau-mdp' }).expect(204);
    await agentFor(app).post('/api/auth/login').send({ email: creds.email, password: 'nouveau-mdp' }).expect(200);
  });

  it('revokes the other sessions when the password changes, and keeps the current one', async () => {
    const current = agentFor(app);
    await current.post('/api/auth/register').send(creds).expect(201);
    const other = agentFor(app);
    await other.post('/api/auth/login').send({ email: creds.email, password: creds.password }).expect(200);
    await other.get('/api/auth/me').expect(200);
    await current.patch('/api/auth/password').send({ currentPassword: creds.password, newPassword: 'nouveau-mdp' }).expect(204);
    await other.get('/api/auth/me').expect(401);
    await current.get('/api/auth/me').expect(200);
  });

  it('maps a concurrent duplicate registration to EMAIL_TAKEN (no 500)', async () => {
    const results = await Promise.all([
      agentFor(app).post('/api/auth/register').send(creds),
      agentFor(app).post('/api/auth/register').send(creds),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)?.body.code).toBe('EMAIL_TAKEN');
  });

  describe('sliding session', () => {
    it('does not re-issue the cookie for a fresh session', async () => {
      const agent = agentFor(app);
      await agent.post('/api/auth/register').send(creds).expect(201);
      const me = await agent.get('/api/auth/me').expect(200);
      expect(me.headers['set-cookie']).toBeUndefined();
    });

    it('re-issues the session cookie when the expiration is extended', async () => {
      const agent = agentFor(app);
      const reg = await agent.post('/api/auth/register').send(creds).expect(201);
      const token = /mt_session=([^;]+)/.exec(reg.headers['set-cookie']?.[0] ?? '')?.[1];
      const db = app.get<Db>(DB);
      const in20Days = new Date(Date.now() + 20 * 24 * 3600 * 1000);
      await db.update(sessions).set({ expiresAt: in20Days });
      const me = await agent.get('/api/auth/me').expect(200);
      const cookie = me.headers['set-cookie']?.[0];
      expect(cookie).toMatch(/^mt_session=.+; .*HttpOnly/i);
      expect(cookie).toContain(`mt_session=${token}`);
      const [row] = await db.select().from(sessions);
      expect(row!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 3600 * 1000);
    });
  });
});

describe('auth rate limiting', () => {
  let app: NestExpressApplication;
  // une app neuve par test : le compteur est en mémoire et partagé par toutes les routes /auth d'une même IP
  beforeEach(async () => { app = await setupTestApp({ AUTH_RATE_LIMIT: '10' }); });
  afterEach(async () => { await app.close(); });

  const attempt = (agent: ReturnType<typeof agentFor>, path: string) => agent.post(path).send({ email: 'a@b.fr', password: 'xxxxxxxx' });

  it('rate-limits login attempts', async () => {
    const agent = agentFor(app);
    for (let i = 0; i < 10; i++) await agent.post('/api/auth/login').send({ email: 'a@b.fr', password: 'xxxxxxxx' });
    const res = await agent.post('/api/auth/login').send({ email: 'a@b.fr', password: 'xxxxxxxx' }).expect(429);
    expect(res.body.code).toBe('TOO_MANY_REQUESTS');
  });

  it('counts one bucket per IP across spellings and /auth routes', async () => {
    const paths = ['/api/auth/login', '/api/AUTH/Login', '/api/auth/login/', '/api/auth/register'];
    const agent = agentFor(app);
    for (let i = 0; i < 10; i++) expect((await attempt(agent, paths[i % paths.length]!)).status).not.toBe(429);
    for (const path of paths) expect((await attempt(agent, path)).status).toBe(429);
  });

  it('also limits password changes, in the same per-IP bucket', async () => {
    const agent = agentFor(app);
    await agent.post('/api/auth/register').send(creds).expect(201);
    for (let i = 0; i < 9; i++) await attempt(agent, '/api/auth/login');
    const res = await agent.patch('/api/auth/password').send({ currentPassword: creds.password, newPassword: 'nouveau-mdp' }).expect(429);
    expect(res.body.code).toBe('TOO_MANY_REQUESTS');
  });
});
