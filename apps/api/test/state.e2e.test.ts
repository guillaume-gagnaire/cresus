import { addDays, localToday } from '@matreso/engine';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { agentFor, resetDb, setupTestApp } from './helpers.js';

describe('state, profile, balance', () => {
  let app: NestExpressApplication;
  beforeAll(async () => { app = await setupTestApp(); });
  beforeEach(async () => { await resetDb(app); });
  afterAll(async () => { await app.close(); });

  const login = async (email = 'a@example.com') => {
    const agent = agentFor(app);
    await agent.post('/api/auth/register').send({ email, password: 'motdepasse1', firstName: 'A' }).expect(201);
    return agent;
  };

  it('returns an empty state for a new account', async () => {
    const res = await (await login()).get('/api/state').expect(200);
    expect(res.body).toMatchObject({ balance: { latest: null, history: [] }, clients: [], leaves: [], charges: [], hasPasskey: false });
    expect(res.body.profile.email).toBe('a@example.com');
  });

  it('patches the profile and validates ranges', async () => {
    const agent = await login();
    const res = await agent.patch('/api/profile').send({ legalStatus: 'EURL_IS', netPayMonthly: 400_000, includeProspects: true }).expect(200);
    expect(res.body).toMatchObject({ legalStatus: 'EURL_IS', netPayMonthly: 400_000, includeProspects: true });
    await agent.patch('/api/profile').send({ microIncomeTaxProvisionPct: 31 }).expect(400);
    await agent.patch('/api/profile').send({ legalStatus: 'SCI' }).expect(400);
  });

  it('records balance snapshots, latest first', async () => {
    const agent = await login();
    await agent.post('/api/balance').send({ amount: 4_832_000, date: '2026-09-22' }).expect(201);
    const second = await agent.post('/api/balance').send({ amount: -12_000, date: '2026-10-04' }).expect(201);
    expect(second.body).toMatchObject({ date: '2026-10-04', amount: -12_000 });
    const state = await agent.get('/api/state').expect(200);
    expect(state.body.balance.latest).toMatchObject({ amount: -12_000 });
    expect(state.body.balance.history).toHaveLength(2);
  });

  it('refuses a balance dated in the future (422), accepts today and the past, and stores nothing on refusal', async () => {
    const agent = await login();
    const tomorrow = addDays(localToday(), 1);
    const refused = await agent.post('/api/balance').send({ amount: 100, date: tomorrow }).expect(422);
    expect(refused.body).toMatchObject({ statusCode: 422, code: 'BALANCE_IN_FUTURE', message: 'La date du solde ne peut pas être dans le futur.' });
    await agent.post('/api/balance').send({ amount: 100, date: '2999-12-31' }).expect(422);
    expect((await agent.get('/api/state').expect(200)).body.balance.history).toHaveLength(0);
    await agent.post('/api/balance').send({ amount: 100, date: localToday() }).expect(201);
    await agent.post('/api/balance').send({ amount: 100, date: '2020-01-31' }).expect(201);
    await agent.post('/api/balance').send({ amount: 100 }).expect(201);
    expect((await agent.get('/api/state').expect(200)).body.balance.history).toHaveLength(3);
  });

  it('isolates users', async () => {
    const a = await login('a@example.com');
    await a.post('/api/balance').send({ amount: 100 }).expect(201);
    const b = await login('b@example.com');
    const state = await b.get('/api/state').expect(200);
    expect(state.body.balance.latest).toBeNull();
  });
});
