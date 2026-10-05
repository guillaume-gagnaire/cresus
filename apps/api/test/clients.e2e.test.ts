import type { NestExpressApplication } from '@nestjs/platform-express';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DB, type Db } from '../src/db/db.module.js';
import { clients, rates, users } from '../src/db/schema.js';
import { MAX_CLIENTS_PER_USER, MAX_RATES_PER_CLIENT } from '../src/data/clients.service.js';
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

  describe('limits (the engine is synchronous: unbounded volumes would block the API)', () => {
    const userIdOf = async (email: string) => {
      const [u] = await app.get<Db>(DB).select({ id: users.id }).from(users).where(eq(users.email, email));
      return u!.id;
    };
    const seedClients = async (userId: string, n: number) => {
      const rows = Array.from({ length: n }, (_, i) => ({
        userId, name: `C${i}`, color: 'indigo' as const, billingMode: 'TJM' as const, startDate: '2026-01-01', paymentTerm: 'RECEPTION' as const, position: i,
      }));
      return app.get<Db>(DB).insert(clients).values(rows).returning({ id: clients.id });
    };

    it('caps the clients per user at the import limit, with a French message', async () => {
      const agent = await login();
      expect(MAX_CLIENTS_PER_USER).toBe(200);
      await seedClients(await userIdOf('a@example.com'), MAX_CLIENTS_PER_USER - 1);
      await agent.post('/api/clients').send(clientA).expect(201);
      const res = await agent.post('/api/clients').send(clientA).expect(422);
      expect(res.body).toMatchObject({ code: 'TOO_MANY_CLIENTS', message: 'Tu as atteint la limite de 200 clients. Supprime-en un avant d’en ajouter.' });
      // la limite est par utilisateur
      await (await login('b@example.com')).post('/api/clients').send(clientA).expect(201);
      // supprimer un client libère une place
      const state = await agent.get('/api/state').expect(200);
      await agent.delete(`/api/clients/${state.body.clients[0].id}`).send({}).expect(204);
      await agent.post('/api/clients').send(clientA).expect(201);
    });

    it('caps the rates per client, but still lets an existing date be replaced', async () => {
      const agent = await login();
      const { body: c } = await agent.post('/api/clients').send(clientA).expect(201);
      expect(MAX_RATES_PER_CLIENT).toBe(500);
      // 1 tarif initial + 499 insérés = 500 : le plafond est atteint
      const start = Date.UTC(2020, 0, 1);
      const rows = Array.from({ length: MAX_RATES_PER_CLIENT - 1 }, (_, i) => ({
        clientId: c.id as string, validFrom: new Date(start + i * 86_400_000).toISOString().slice(0, 10), amount: 50_000 + i,
      }));
      await app.get<Db>(DB).insert(rates).values(rows);
      const refused = await agent.post(`/api/clients/${c.id}/rates`).send({ validFrom: '2030-01-01', amount: 80_000 }).expect(422);
      expect(refused.body).toMatchObject({
        code: 'TOO_MANY_RATES',
        message: 'Ce client a déjà 500 tarifs, c’est la limite. Supprime d’anciens tarifs avant d’en ajouter.',
      });
      // remplacer le montant d'une date existante ne crée pas de tarif : permis
      const replaced = await agent.post(`/api/clients/${c.id}/rates`).send({ validFrom: '2026-10-01', amount: 66_000 }).expect(201);
      expect(replaced.body.rates).toHaveLength(MAX_RATES_PER_CLIENT);
      expect(replaced.body.rates.find((r: { validFrom: string }) => r.validFrom === '2026-10-01').amount).toBe(66_000);
      // en supprimer un libère une place
      await agent.delete(`/api/clients/${c.id}/rates/${replaced.body.rates[0].id}`).send({}).expect(200);
      await agent.post(`/api/clients/${c.id}/rates`).send({ validFrom: '2030-01-01', amount: 80_000 }).expect(201);
    });
  });

  it('never lets two simultaneous deletions remove the last two rates (LAST_RATE)', async () => {
    const agent = await login();
    const { body: c } = await agent.post('/api/clients').send(clientA).expect(201);
    const { body: two } = await agent.post(`/api/clients/${c.id}/rates`).send({ validFrom: '2027-01-01', amount: 70_000 }).expect(201);
    const [first, second] = two.rates as Array<{ id: string }>;
    const results = await Promise.all([
      agent.delete(`/api/clients/${c.id}/rates/${first!.id}`).send({}),
      agent.delete(`/api/clients/${c.id}/rates/${second!.id}`).send({}),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(results.find((r) => r.status === 409)?.body.code).toBe('LAST_RATE');
    const state = await agent.get('/api/state').expect(200);
    expect(state.body.clients[0].rates).toHaveLength(1);
  });

  it('answers 404 for an unknown rate id, without touching the others', async () => {
    const agent = await login();
    const { body: c } = await agent.post('/api/clients').send(clientA).expect(201);
    await agent.post(`/api/clients/${c.id}/rates`).send({ validFrom: '2027-01-01', amount: 70_000 }).expect(201);
    await agent.delete(`/api/clients/${c.id}/rates/${'0'.repeat(8)}-0000-4000-8000-${'0'.repeat(12)}`).send({}).expect(404);
    expect((await agent.get('/api/state').expect(200)).body.clients[0].rates).toHaveLength(2);
  });
});
