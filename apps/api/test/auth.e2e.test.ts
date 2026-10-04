import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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

  it('rate-limits login attempts', async () => {
    const agent = agentFor(app);
    for (let i = 0; i < 10; i++) await agent.post('/api/auth/login').send({ email: 'a@b.fr', password: 'xxxxxxxx' });
    const res = await agent.post('/api/auth/login').send({ email: 'a@b.fr', password: 'xxxxxxxx' }).expect(429);
    expect(res.body.code).toBe('TOO_MANY_REQUESTS');
  });
});
