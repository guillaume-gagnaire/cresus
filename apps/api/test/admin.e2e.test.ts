import { demoExportFile } from '@matreso/engine';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DB, type Db } from '../src/db/db.module.js';
import { SeedService } from '../src/seed/seed.service.js';
import { agentFor, resetDb, setupTestApp } from './helpers.js';

const register = (app: NestExpressApplication, email: string) =>
  agentFor(app).post('/api/auth/register').send({ email, password: 'motdepasse1', firstName: 'X' });

describe('first registered user is admin', () => {
  let app: NestExpressApplication;
  beforeAll(async () => { app = await setupTestApp(); });
  beforeEach(async () => { await resetDb(app); });
  afterEach(() => { vi.restoreAllMocks(); });
  afterAll(async () => { await app.close(); });

  it('makes the first account ADMIN and the next ones USER', async () => {
    const first = await register(app, 'first@example.com').expect(201);
    expect(first.body.user.role).toBe('ADMIN');
    const second = await register(app, 'second@example.com').expect(201);
    expect(second.body.user.role).toBe('USER');
  });

  it('does not count the demo account', async () => {
    await app.get(SeedService).ensureDemoUser();
    const first = await register(app, 'first@example.com').expect(201);
    expect(first.body.user.role).toBe('ADMIN');
    const demo = await agentFor(app).post('/api/auth/login').send({ email: 'demo@matreso.fr', password: 'demo1234' }).expect(200);
    expect(demo.body.user.role).toBe('USER');
  });

  it('keeps a single admin under concurrent first registrations', async () => {
    const [a, b] = await Promise.all([register(app, 'a@example.com'), register(app, 'b@example.com')]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect([a.body.user.role, b.body.user.role].sort()).toEqual(['ADMIN', 'USER']);
  });

  it('never lets a user change their role (profile patch, import) and never exports it', async () => {
    await register(app, 'first@example.com').expect(201);
    const user = agentFor(app);
    await user.post('/api/auth/register').send({ email: 'user@example.com', password: 'motdepasse1', firstName: 'Y' }).expect(201);
    await user.patch('/api/profile').send({ role: 'ADMIN' }).expect(400);
    const file = { ...demoExportFile(), profile: { ...demoExportFile().profile, role: 'ADMIN' } };
    const imported = await user.post('/api/import').send(file).expect(201);
    expect(imported.body.profile.role).toBe('USER');
    const exported = await user.get('/api/export').expect(200);
    expect(exported.body.profile).not.toHaveProperty('role');
  });

  // Ajout (couverture) : sous PGlite les deux requêtes concurrentes sont sérialisées et le rejeu n'a pas lieu de lui-même.
  // On simule ici une recherche d'ADMIN périmée (l'ADMIN existe mais la recherche ne le voit pas) pour exercer le rejeu en USER.
  it('replays the insert as USER when the single-admin index rejects a stale first registration', async () => {
    await register(app, 'first@example.com').expect(201);
    const db = app.get<Db>(DB);
    const select = db.select.bind(db);
    const staleAdminLookup = { from: () => ({ where: () => ({ limit: async () => [] }) }) };
    // register() lit d'abord l'e-mail (vrai appel), puis cherche un ADMIN (résultat périmé : aucun)
    vi.spyOn(db, 'select')
      .mockImplementationOnce(((...args: unknown[]) => (select as (...a: unknown[]) => unknown)(...args)) as typeof db.select)
      .mockImplementationOnce((() => staleAdminLookup) as unknown as typeof db.select);
    const second = await register(app, 'second@example.com').expect(201);
    expect(second.body.user.role).toBe('USER');
  });
});
