import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { agentFor, resetDb, setupTestApp } from './helpers.js';

const clientA = {
  name: 'Client A', subtitle: 'Via ESN', color: 'indigo', billingMode: 'TJM', weekdays: [4, 0],
  startDate: '2026-10-01', endDate: '2027-05-31', paymentTerm: 'EOM_30', averageDelayDays: 0, isProspect: false,
  rate: { validFrom: '2026-10-01', amount: 65_000 },
};

describe('clients and rates', () => {
  let app: NestExpressApplication;
  beforeAll(async () => { app = await setupTestApp(); });
  beforeEach(async () => { await resetDb(app); });
  afterAll(async () => { await app.close(); });

  const login = async (email = 'a@example.com') => {
    const agent = agentFor(app);
    await agent.post('/api/auth/register').send({ email, password: 'motdepasse1', firstName: 'A' }).expect(201);
    return agent;
  };

  it('creates a client with its first rate, weekdays sorted', async () => {
    const res = await (await login()).post('/api/clients').send(clientA).expect(201);
    expect(res.body).toMatchObject({ name: 'Client A', weekdays: [0, 4], rates: [{ validFrom: '2026-10-01', amount: 65_000 }] });
  });

  it('exposes populated clients in the state, with sorted weekdays and rates ordered by date', async () => {
    const agent = await login();
    const { body: c } = await agent.post('/api/clients').send(clientA).expect(201);
    await agent.post(`/api/clients/${c.id}/rates`).send({ validFrom: '2026-01-01', amount: 60_000 }).expect(201);
    const state = await agent.get('/api/state').expect(200);
    expect(state.body.clients).toEqual([
      expect.objectContaining({
        id: c.id, name: 'Client A', weekdays: [0, 4], archivedAt: null,
        rates: [
          expect.objectContaining({ validFrom: '2026-01-01', amount: 60_000 }),
          expect.objectContaining({ validFrom: '2026-10-01', amount: 65_000 }),
        ],
      }),
    ]);
  });

  it('refuses an end date before the start date (422)', async () => {
    const res = await (await login()).post('/api/clients').send({ ...clientA, endDate: '2026-09-01' }).expect(422);
    expect(res.body).toMatchObject({ code: 'END_BEFORE_START', message: 'La date de fin doit être après la date de début.' });
  });

  it('forces empty weekdays for a forfait and validates weekdays', async () => {
    const agent = await login();
    const res = await agent.post('/api/clients').send({ ...clientA, billingMode: 'FORFAIT', weekdays: [1, 2] }).expect(201);
    expect(res.body.weekdays).toEqual([]);
    await agent.post('/api/clients').send({ ...clientA, weekdays: [5] }).expect(400);
  });

  it('patches fields and re-checks dates against stored values', async () => {
    const agent = await login();
    const { body: c } = await agent.post('/api/clients').send(clientA).expect(201);
    const res = await agent.patch(`/api/clients/${c.id}`).send({ averageDelayDays: 10, paymentTerm: 'NET_45' }).expect(200);
    expect(res.body).toMatchObject({ averageDelayDays: 10, paymentTerm: 'NET_45' });
    await agent.patch(`/api/clients/${c.id}`).send({ startDate: '2027-06-01' }).expect(422);
    await agent.patch(`/api/clients/${c.id}`).send({ averageDelayDays: 31 }).expect(400);
    const archived = await agent.patch(`/api/clients/${c.id}`).send({ archived: true }).expect(200);
    expect(archived.body.archivedAt).toEqual(expect.any(String));
  });

  it('upserts rates on the same date and forbids deleting the last one', async () => {
    const agent = await login();
    const { body: c } = await agent.post('/api/clients').send(clientA).expect(201);
    await agent.post(`/api/clients/${c.id}/rates`).send({ validFrom: '2027-01-01', amount: 70_000 }).expect(201);
    const replaced = await agent.post(`/api/clients/${c.id}/rates`).send({ validFrom: '2027-01-01', amount: 72_000 }).expect(201);
    expect(replaced.body.rates).toEqual([
      expect.objectContaining({ validFrom: '2026-10-01', amount: 65_000 }),
      expect.objectContaining({ validFrom: '2027-01-01', amount: 72_000 }),
    ]);
    const afterDelete = await agent.delete(`/api/clients/${c.id}/rates/${replaced.body.rates[1].id}`).send({}).expect(200);
    expect(afterDelete.body.rates).toHaveLength(1);
    const last = await agent.delete(`/api/clients/${c.id}/rates/${afterDelete.body.rates[0].id}`).send({}).expect(409);
    expect(last.body).toMatchObject({ code: 'LAST_RATE', message: 'Un client garde toujours au moins un tarif.' });
  });

  it('deletes a client, and hides other users’ clients (404)', async () => {
    const a = await login('a@example.com');
    const { body: c } = await a.post('/api/clients').send(clientA).expect(201);
    const b = await login('b@example.com');
    await b.patch(`/api/clients/${c.id}`).send({ name: 'Volé' }).expect(404);
    await b.delete(`/api/clients/${c.id}`).send({}).expect(404);
    await a.delete(`/api/clients/${c.id}`).send({}).expect(204);
    const state = await a.get('/api/state').expect(200);
    expect(state.body.clients).toEqual([]);
  });
});
