import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DB, type Db } from '../src/db/db.module.js';
import { sessions } from '../src/db/schema.js';
import { agentFor, resetDb, setupTestApp } from './helpers.js';

const SIGNUP = { name: 'APE Jules Ferry', email: '  APE@Ecole.fr ', password: 'kermesse2027' };

describe('compte de l’asso : inscription et connexion', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    app = await setupTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDb(app);
  });

  it('inscrit l’asso, ouvre la session et normalise l’email', async () => {
    const agent = agentFor(app);
    const res = await agent.post('/api/auth/signup').send(SIGNUP).expect(201);
    expect(res.body).toMatchObject({ email: 'ape@ecole.fr', name: 'APE Jules Ferry' });
    expect(res.headers['set-cookie']?.[0]).toMatch(/^cresus_session=.*HttpOnly/);
    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body).toEqual({ id: res.body.id, email: 'ape@ecole.fr', name: 'APE Jules Ferry', isAdmin: false });
  });

  it('refuse un email déjà pris, quelle que soit la casse', async () => {
    await agentFor(app).post('/api/auth/signup').send(SIGNUP).expect(201);
    const res = await agentFor(app).post('/api/auth/signup').send({ ...SIGNUP, email: 'ape@ECOLE.fr' }).expect(409);
    expect(res.body).toMatchObject({ code: 'EMAIL_TAKEN', message: 'Un compte existe déjà avec cet email.' });
  });

  it('refuse un mot de passe trop court', async () => {
    const res = await agentFor(app).post('/api/auth/signup').send({ ...SIGNUP, password: '1234567' }).expect(400);
    expect(res.body.message).toMatch(/au moins 8 caractères/);
  });

  it('refuse un nom d’asso vide', async () => {
    await agentFor(app).post('/api/auth/signup').send({ ...SIGNUP, name: '   ' }).expect(400);
  });

  it('connecte avec le bon mot de passe, refuse le mauvais', async () => {
    await agentFor(app).post('/api/auth/signup').send(SIGNUP).expect(201);
    const bad = await agentFor(app).post('/api/auth/login').send({ email: 'ape@ecole.fr', password: 'mauvais-mdp' }).expect(401);
    expect(bad.body).toMatchObject({ code: 'INVALID_CREDENTIALS', message: 'Email ou mot de passe incorrect.' });
    const agent = agentFor(app);
    await agent.post('/api/auth/login').send({ email: 'APE@ecole.fr', password: 'kermesse2027' }).expect(200);
    await agent.get('/api/auth/me').expect(200);
  });

  it('déconnecte', async () => {
    const agent = agentFor(app);
    await agent.post('/api/auth/signup').send(SIGNUP).expect(201);
    await agent.post('/api/auth/logout').send({}).expect(204);
    const res = await agent.get('/api/auth/me').expect(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });
});

describe('durée de la session : 24 h, prolongée à l’usage toutes les 5 minutes', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    app = await setupTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDb(app);
  });

  const db = () => app.get<Db>(DB);
  const expiresAt = async () => (await db().select({ expiresAt: sessions.expiresAt }).from(sessions))[0]!.expiresAt.getTime();
  const shiftExpiry = (ms: number) => db().update(sessions).set({ expiresAt: new Date(Date.now() + ms) });
  const HOUR = 3600 * 1000;

  it('ouvre une session de 24 h', async () => {
    const res = await agentFor(app).post('/api/auth/signup').send(SIGNUP).expect(201);
    expect(res.headers['set-cookie']?.[0]).toMatch(/Max-Age=86400/);
    expect(Math.abs((await expiresAt()) - (Date.now() + 24 * HOUR))).toBeLessThan(10_000);
  });

  it('ne prolonge pas avant 5 minutes d’usage', async () => {
    const agent = agentFor(app);
    await agent.post('/api/auth/signup').send(SIGNUP).expect(201);
    const res = await agent.get('/api/auth/me').expect(200);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('prolonge de 24 h une session utilisée plus de 5 minutes après sa dernière prolongation', async () => {
    const agent = agentFor(app);
    await agent.post('/api/auth/signup').send(SIGNUP).expect(201);
    await shiftExpiry(24 * HOUR - 6 * 60 * 1000);
    const res = await agent.get('/api/auth/me').expect(200);
    expect(res.headers['set-cookie']?.[0]).toMatch(/^cresus_session=.*Max-Age=86400/);
    expect(Math.abs((await expiresAt()) - (Date.now() + 24 * HOUR))).toBeLessThan(10_000);
  });

  it('refuse une session expirée', async () => {
    const agent = agentFor(app);
    await agent.post('/api/auth/signup').send(SIGNUP).expect(201);
    await shiftExpiry(-60 * 1000);
    await agent.get('/api/auth/me').expect(401);
  });
});

describe('limite de débit sur /api/auth', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    // configuration par défaut (AUTH_RATE_LIMIT non surchargé) : c'est elle qui doit tenir le rush de la kermesse
    app = await setupTestApp({ AUTH_RATE_LIMIT: '' });
  });
  afterAll(async () => {
    await app.close();
  });

  it('laisse passer 20 bénévoles qui se connectent depuis le même wifi, puis bloque au-delà de 30 par minute', async () => {
    await resetDb(app);
    const http = () => request(app.getHttpServer());
    await http().post('/api/auth/signup').send(SIGNUP).expect(201);
    for (let i = 0; i < 25; i++) {
      await http().post('/api/auth/login').send({ email: 'ape@ecole.fr', password: 'kermesse2027' }).expect(200);
    }
    for (let i = 0; i < 4; i++) await http().post('/api/auth/login').send({ email: 'ape@ecole.fr', password: 'kermesse2027' });
    const blocked = await http().post('/api/auth/login').send({ email: 'ape@ecole.fr', password: 'kermesse2027' }).expect(429);
    expect(blocked.body).toMatchObject({ code: 'TOO_MANY_REQUESTS', message: 'Trop de tentatives. Réessayez dans une minute.' });
  });
});
