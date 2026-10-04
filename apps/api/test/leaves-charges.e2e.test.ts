import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { agentFor, resetDb, setupTestApp } from './helpers.js';

describe('leaves and charges', () => {
  let app: NestExpressApplication;
  beforeAll(async () => { app = await setupTestApp(); });
  beforeEach(async () => { await resetDb(app); });
  afterAll(async () => { await app.close(); });

  const login = async () => {
    const agent = agentFor(app);
    await agent.post('/api/auth/register').send({ email: 'a@example.com', password: 'motdepasse1', firstName: 'A' }).expect(201);
    return agent;
  };

  it('creates one leave per working day of a range, skipping weekends and holidays', async () => {
    const res = await (await login()).post('/api/leaves').send({ from: '2026-12-24', to: '2026-12-31', scope: 'ALL' }).expect(201);
    expect(res.body.created).toBe(5);
    expect(res.body.leaves.map((l: { date: string }) => l.date)).toEqual(['2026-12-24', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31']);
  });

  it('refuses a single leave on a holiday or a weekend (acceptance criterion)', async () => {
    const agent = await login();
    const holiday = await agent.post('/api/leaves').send({ from: '2026-12-25', scope: 'ALL' }).expect(422);
    expect(holiday.body).toMatchObject({ code: 'NOT_A_WORKING_DAY', message: 'Ce jour n’est pas ouvré : impossible d’y poser un congé.' });
    await agent.post('/api/leaves').send({ from: '2026-12-26', scope: 'ALL' }).expect(422);
    const range = await agent.post('/api/leaves').send({ from: '2026-12-26', to: '2026-12-27', scope: 'ALL' }).expect(422);
    expect(range.body.message).toBe('Aucun jour ouvré sur cette période.');
  });

  it('ignores duplicates and validates scope, client and range', async () => {
    const agent = await login();
    await agent.post('/api/leaves').send({ from: '2026-12-24', scope: 'ALL' }).expect(201);
    const again = await agent.post('/api/leaves').send({ from: '2026-12-24', scope: 'ALL' }).expect(201);
    expect(again.body.created).toBe(0);
    expect(again.body.leaves).toHaveLength(1);
    await agent.post('/api/leaves').send({ from: '2026-12-24', scope: 'CLIENT' }).expect(400);
    await agent.post('/api/leaves').send({ from: '2026-12-24', scope: 'CLIENT', clientId: '6d0f7f5c-0000-4000-8000-000000000000' }).expect(404);
    await agent.post('/api/leaves').send({ from: '2026-12-31', to: '2026-12-24', scope: 'ALL' }).expect(400);
    await agent.post('/api/leaves').send({ from: '2026-01-01', to: '2027-06-01', scope: 'ALL' }).expect(400);
  });

  it('rejects unparsable dates in a range with a 400, never a 500', async () => {
    const agent = await login();
    const badFrom = await agent.post('/api/leaves').send({ from: 'garbage', to: '2026-12-31', scope: 'ALL' }).expect(400);
    expect(badFrom.body).toMatchObject({ code: 'VALIDATION', message: 'Date invalide.' });
    const badTo = await agent.post('/api/leaves').send({ from: '2026-12-01', to: 'garbage', scope: 'ALL' }).expect(400);
    expect(badTo.body).toMatchObject({ code: 'VALIDATION', message: 'Date invalide.' });
  });

  it('creates leaves scoped to one of the user’s clients', async () => {
    const agent = await login();
    const { body: client } = await agent
      .post('/api/clients')
      .send({
        name: 'Client A', subtitle: null, color: 'indigo', billingMode: 'TJM', weekdays: [0, 4],
        startDate: '2026-10-01', endDate: null, paymentTerm: 'NET_30', averageDelayDays: 0, isProspect: false,
        rate: { validFrom: '2026-10-01', amount: 65_000 },
      })
      .expect(201);
    const res = await agent.post('/api/leaves').send({ from: '2026-12-28', scope: 'CLIENT', clientId: client.id }).expect(201);
    expect(res.body.created).toBe(1);
    expect(res.body.leaves).toEqual([expect.objectContaining({ date: '2026-12-28', scope: 'CLIENT', clientId: client.id })]);
  });

  it('isolates leaves and charges between users', async () => {
    const a = await login();
    const b = agentFor(app);
    await b.post('/api/auth/register').send({ email: 'b@example.com', password: 'motdepasse1', firstName: 'B' }).expect(201);
    const { body: leaves } = await a.post('/api/leaves').send({ from: '2026-12-28', scope: 'ALL' }).expect(201);
    const { body: charge } = await a.post('/api/charges').send({ name: 'CFE', amount: 60_000, frequency: 'MONTHLY', month: null, category: null }).expect(201);

    const stolen = await b.post('/api/leaves/delete').send({ ids: leaves.leaves.map((l: { id: string }) => l.id) }).expect(200);
    expect(stolen.body.deleted).toBe(0);
    await b.patch(`/api/charges/${charge.id}`).send({ amount: 1 }).expect(404);
    await b.delete(`/api/charges/${charge.id}`).send({}).expect(404);

    const state = await a.get('/api/state').expect(200);
    expect(state.body.leaves).toHaveLength(1);
    expect(state.body.charges).toEqual([expect.objectContaining({ id: charge.id, amount: 60_000 })]);
  });

  it('deletes leaves by id', async () => {
    const agent = await login();
    const { body } = await agent.post('/api/leaves').send({ from: '2026-12-28', to: '2026-12-29', scope: 'ALL' }).expect(201);
    const res = await agent.post('/api/leaves/delete').send({ ids: body.leaves.map((l: { id: string }) => l.id) }).expect(200);
    expect(res.body.deleted).toBe(2);
  });

  it('manages charges with month required for yearly ones', async () => {
    const agent = await login();
    const missing = await agent.post('/api/charges').send({ name: 'CFE', amount: 60_000, frequency: 'YEARLY', month: null, category: 'Impôts' }).expect(400);
    expect(missing.body.message).toBe('Choisis le mois du prélèvement.');
    const { body: c } = await agent.post('/api/charges').send({ name: 'CFE', amount: 60_000, frequency: 'YEARLY', month: 11, category: 'Impôts' }).expect(201);
    const patched = await agent.patch(`/api/charges/${c.id}`).send({ amount: 65_000 }).expect(200);
    expect(patched.body.amount).toBe(65_000);
    const monthly = await agent.patch(`/api/charges/${c.id}`).send({ frequency: 'MONTHLY' }).expect(200);
    expect(monthly.body.month).toBeNull();
    await agent.delete(`/api/charges/${c.id}`).send({}).expect(204);
    await agent.delete(`/api/charges/${c.id}`).send({}).expect(404);
  });
});
