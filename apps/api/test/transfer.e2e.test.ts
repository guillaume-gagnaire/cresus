import { addDays, demoExportFile, localToday, workingDaysBetween } from '@matreso/engine';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SeedService } from '../src/seed/seed.service.js';
import { agentFor, resetDb, setupTestApp } from './helpers.js';

describe('export, import, account, seed', () => {
  let app: NestExpressApplication;
  beforeAll(async () => { app = await setupTestApp(); });
  beforeEach(async () => { await resetDb(app); });
  afterAll(async () => { await app.close(); });

  const login = async () => {
    const agent = agentFor(app);
    await agent.post('/api/auth/register').send({ email: 'a@example.com', password: 'motdepasse1', firstName: 'A' }).expect(201);
    return agent;
  };

  it('imports the demo file and exports it back identically (except exportedAt)', async () => {
    const agent = await login();
    const imported = await agent.post('/api/import').send(demoExportFile()).expect(201);
    expect(imported.body.clients).toHaveLength(4);
    expect(imported.body.leaves).toHaveLength(21);
    expect(imported.body.leaves.find((l: { date: string }) => l.date === '2027-05-07').clientId).toBe(imported.body.clients[0].id);
    const exported = await agent.get('/api/export').expect(200);
    const { exportedAt: _a, ...got } = exported.body;
    const { exportedAt: _b, ...want } = demoExportFile();
    expect(got.clients.map((c: { name: string }) => c.name)).toEqual(want.clients.map((c) => c.name));
    expect(got.leaves).toHaveLength(want.leaves.length);
    // insérées en lot : même created_at, ordre non garanti
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    expect([...got.charges].sort(byName)).toEqual([...want.charges].sort(byName));
    expect(got.profile).toEqual(want.profile);
  });

  it('replaces existing data on import', async () => {
    const agent = await login();
    await agent.post('/api/import').send(demoExportFile()).expect(201);
    const second = await agent.post('/api/import').send(demoExportFile()).expect(201);
    expect(second.body.clients).toHaveLength(4);
    expect(second.body.charges).toHaveLength(8);
  });

  it('imports the maximum number of leaves (body above 100 kB, insert in batches)', async () => {
    const agent = await login();
    const leaves = workingDaysBetween('2000-01-01', '2100-12-31').slice(0, 20_000).map((date) => ({ date, scope: 'ALL', clientRef: null }));
    expect(leaves).toHaveLength(20_000);
    const imported = await agent.post('/api/import').send({ ...demoExportFile(), leaves }).expect(201);
    expect(imported.body.leaves).toHaveLength(20_000);
  }, 30_000);

  it('rejects a malformed file with a readable message and changes nothing', async () => {
    const agent = await login();
    await agent.post('/api/import').send(demoExportFile()).expect(201);
    const bad = await agent.post('/api/import').send({ format: 'autre', version: 1 }).expect(400);
    expect(bad.body.message).toBe('Ce fichier n’est pas une sauvegarde Ma Tréso valide.');
    const broken = { ...demoExportFile(), leaves: [{ date: '2027-05-07', scope: 'CLIENT', clientRef: 'inconnu' }] };
    await agent.post('/api/import').send(broken).expect(400);
    const state = await agent.get('/api/state').expect(200);
    expect(state.body.clients).toHaveLength(4);
  });

  it('refuses a file holding a balance dated in the future, with a readable message, and changes nothing', async () => {
    const agent = await login();
    await agent.post('/api/import').send(demoExportFile()).expect(201);
    const file = demoExportFile();
    const future = { ...file, balanceSnapshots: [...file.balanceSnapshots, { date: addDays(localToday(), 1), amount: 1_000 }] };
    const res = await agent.post('/api/import').send(future).expect(422);
    expect(res.body).toMatchObject({ code: 'BALANCE_IN_FUTURE', message: 'Ce fichier contient un solde daté dans le futur : corrige-le avant de l’importer.' });
    const state = await agent.get('/api/state').expect(200);
    expect(state.body.clients).toHaveLength(4);
    expect(state.body.balance.history).toHaveLength(1);
    // l'historique passé et celui d'aujourd'hui restent importables
    const past = { ...file, balanceSnapshots: [{ date: '2019-05-01', amount: 5 }, { date: localToday(), amount: 6 }] };
    const imported = await agent.post('/api/import').send(past).expect(201);
    expect(imported.body.balance.history).toHaveLength(2);
  });

  it('normalises clients like the entry forms do (weekdays deduplicated and sorted, subtitle trimmed)', async () => {
    const agent = await login();
    const file = demoExportFile();
    const [first, ...others] = file.clients;
    const messy = { ...first!, weekdays: [4, 0, 0], subtitle: '  Via ESN  ' };
    const imported = await agent.post('/api/import').send({ ...file, clients: [messy, ...others] }).expect(201);
    expect(imported.body.clients[0]).toMatchObject({ name: 'Client A', subtitle: 'Via ESN', weekdays: [0, 4] });
  });

  it('rejects what the entry forms reject: a rate of 0 €, too many rates per client, an over-long company name', async () => {
    const agent = await login();
    await agent.post('/api/import').send(demoExportFile()).expect(201);
    const file = demoExportFile();
    const [first, ...others] = file.clients;
    const zero = { ...file, clients: [{ ...first!, rates: [{ validFrom: '2026-10-01', amount: 0 }] }, ...others] };
    await agent.post('/api/import').send(zero).expect(400);
    const dates = workingDaysBetween('2024-01-01', '2030-12-31').slice(0, 501);
    const many = { ...file, clients: [{ ...first!, rates: dates.map((validFrom) => ({ validFrom, amount: 50_000 })) }, ...others] };
    await agent.post('/api/import').send(many).expect(400);
    const tooRich = { ...file, profile: { ...file.profile, netPayMonthly: 10_000_001 } };
    await agent.post('/api/import').send(tooRich).expect(400);
    const state = await agent.get('/api/state').expect(200);
    expect(state.body.clients).toHaveLength(4);
  });

  it('silently drops leaves on weekends and public holidays instead of rejecting the file', async () => {
    const agent = await login();
    const leaves = [
      { date: '2026-10-05', scope: 'ALL', clientRef: null }, // lundi ouvré
      { date: '2026-10-10', scope: 'ALL', clientRef: null }, // samedi
      { date: '2026-10-11', scope: 'CLIENT', clientRef: 'client-a' }, // dimanche
      { date: '2026-12-25', scope: 'ALL', clientRef: null }, // Noël
    ];
    const imported = await agent.post('/api/import').send({ ...demoExportFile(), leaves }).expect(201);
    expect(imported.body.leaves.map((l: { date: string }) => l.date)).toEqual(['2026-10-05']);
  });

  it('keeps one copy of the data when two imports run at the same time', async () => {
    const agent = await login();
    const results = await Promise.all([agent.post('/api/import').send(demoExportFile()), agent.post('/api/import').send(demoExportFile())]);
    expect(results.map((r) => r.status)).toEqual([201, 201]);
    const state = await agent.get('/api/state').expect(200);
    expect(state.body.clients).toHaveLength(4);
    expect(state.body.charges).toHaveLength(8);
    expect(state.body.leaves).toHaveLength(21);
  });

  it('deletes the account with its password', async () => {
    const agent = await login();
    await agent.delete('/api/account').send({ password: 'mauvais' }).expect(401);
    await agent.delete('/api/account').send({ password: 'motdepasse1' }).expect(204);
    await agent.get('/api/auth/me').expect(401);
    await agentFor(app).post('/api/auth/login').send({ email: 'a@example.com', password: 'motdepasse1' }).expect(401);
  });

  it('seeds the demo account once', async () => {
    const seed = app.get(SeedService);
    await seed.ensureDemoUser();
    await seed.ensureDemoUser();
    const agent = agentFor(app);
    await agent.post('/api/auth/login').send({ email: 'demo@matreso.fr', password: 'demo1234' }).expect(200);
    const state = await agent.get('/api/state').expect(200);
    expect(state.body.clients).toHaveLength(4);
  });
});

describe('account deletion rate limit', () => {
  it('shares the per-IP /auth bucket, so the password cannot be brute-forced through DELETE /account', async () => {
    const app = await setupTestApp({ AUTH_RATE_LIMIT: '10' });
    try {
      const agent = agentFor(app);
      await agent.post('/api/auth/register').send({ email: 'a@example.com', password: 'motdepasse1', firstName: 'A' }).expect(201);
      for (let i = 0; i < 8; i++) await agent.delete('/api/account').send({ password: 'mauvais' }).expect(401);
      // 9 requêtes comptées : une de plus sur /auth et le compteur est plein, quelle que soit la route
      await agent.post('/api/auth/login').send({ email: 'a@example.com', password: 'mauvais-mdp' }).expect(401);
      await agent.delete('/api/account').send({ password: 'motdepasse1' }).expect(429);
      await agent.get('/api/auth/me').expect(200);
    } finally {
      await app.close();
    }
  });
});
