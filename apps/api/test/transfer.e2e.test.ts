import { demoExportFile } from '@matreso/engine';
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
    const leaves = Array.from({ length: 20_000 }, (_, i) => ({ date: new Date(Date.UTC(2000, 0, 1 + i)).toISOString().slice(0, 10), scope: 'ALL', clientRef: null }));
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
