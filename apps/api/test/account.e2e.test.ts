import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetPassword } from '../src/cli/reset-password-core.js';
import { DB, type Db } from '../src/db/db.module.js';
import { agentFor, resetDb, setupTestApp } from './helpers.js';

const SIGNUP = { name: 'APE Jules Ferry', email: 'ape@ecole.fr', password: 'kermesse2027' };

describe('réglages du compte', () => {
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

  async function signedUp() {
    const agent = agentFor(app);
    await agent.post('/api/auth/signup').send(SIGNUP).expect(201);
    return agent;
  }

  it('renomme l’asso', async () => {
    const agent = await signedUp();
    const res = await agent.patch('/api/account').send({ name: 'APE Jean Moulin' }).expect(200);
    expect(res.body.name).toBe('APE Jean Moulin');
    expect((await agent.get('/api/auth/me')).body.name).toBe('APE Jean Moulin');
  });

  it('change le mot de passe : garde ce téléphone connecté, déconnecte les autres', async () => {
    const phoneA = await signedUp();
    const phoneB = agentFor(app);
    await phoneB.post('/api/auth/login').send({ email: SIGNUP.email, password: SIGNUP.password }).expect(200);

    await phoneA.post('/api/account/password').send({ currentPassword: 'mauvais-mdp', newPassword: 'nouveau-mdp-2027' }).expect(401);
    await phoneA.post('/api/account/password').send({ currentPassword: SIGNUP.password, newPassword: 'nouveau-mdp-2027' }).expect(204);

    await phoneA.get('/api/auth/me').expect(200);
    await phoneB.get('/api/auth/me').expect(401);
    await agentFor(app).post('/api/auth/login').send({ email: SIGNUP.email, password: SIGNUP.password }).expect(401);
    await agentFor(app).post('/api/auth/login').send({ email: SIGNUP.email, password: 'nouveau-mdp-2027' }).expect(200);
  });

  it('supprime le compte avec le bon mot de passe seulement', async () => {
    const agent = await signedUp();
    await agent.delete('/api/account').send({ password: 'mauvais-mdp' }).expect(401);
    await agent.delete('/api/account').send({ password: SIGNUP.password }).expect(204);
    await agent.get('/api/auth/me').expect(401);
    await agentFor(app).post('/api/auth/login').send({ email: SIGNUP.email, password: SIGNUP.password }).expect(401);
  });

  it('exige d’être connecté', async () => {
    await agentFor(app).patch('/api/account').send({ name: 'X' }).expect(401);
  });
});

describe('réinitialisation du mot de passe en ligne de commande', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    app = await setupTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('donne un nouveau mot de passe qui marche et coupe les sessions existantes', async () => {
    await resetDb(app);
    const phone = agentFor(app);
    await phone.post('/api/auth/signup').send(SIGNUP).expect(201);
    const fresh = await resetPassword(app.get<Db>(DB), 'APE@ecole.fr');
    expect(fresh).toMatch(/^[a-z0-9]{12}$/);
    await phone.get('/api/auth/me').expect(401);
    await agentFor(app).post('/api/auth/login').send({ email: SIGNUP.email, password: fresh }).expect(200);
  });

  it('échoue pour un email inconnu', async () => {
    await expect(resetPassword(app.get<Db>(DB), 'inconnu@ecole.fr')).rejects.toThrow(/Aucun compte/);
  });
});
