import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AdminService } from '../src/admin/admin.service.js';
import { type Agent, agentFor, eventWithArticles, resetDb, setupTestApp, signedUpAgent } from './helpers.js';

const ADMIN = 'admin@cresus.test';

async function sell(agent: Agent, eventId: string, articleId: string, priceCents: number, times: number): Promise<void> {
  const ops = Array.from({ length: times }, () => ({ op: 'sale', id: randomUUID(), articleId, priceCents, soldAt: new Date().toISOString() }));
  await agent.post(`/api/events/${eventId}/sync`).send({ ops }).expect(200);
}

describe('panneau d’admin', () => {
  let app: NestExpressApplication;
  let admin: Agent;
  let ape: Agent;
  let eventId: string;

  beforeAll(async () => {
    app = await setupTestApp({ ADMIN_EMAILS: ` ${ADMIN.toUpperCase()} , autre-admin@cresus.test` });
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDb(app);
    admin = await signedUpAgent(app, ADMIN);
    ape = await signedUpAgent(app, 'ape@ecole.fr');
    const created = await eventWithArticles(ape, [['Crêpe', 250], ['Soda', 150]]);
    eventId = created.eventId;
    await sell(ape, eventId, created.articleIds[0]!, 250, 2);
    await sell(ape, eventId, created.articleIds[1]!, 150, 1);
    const other = await signedUpAgent(app, 'mairie@ecole.fr');
    await eventWithArticles(other, [['Gaufre', 300]], 'Boum');
  });

  it('signale l’admin dans le compte connecté, et lui seul', async () => {
    expect((await admin.get('/api/auth/me').expect(200)).body.isAdmin).toBe(true);
    expect((await ape.get('/api/auth/me').expect(200)).body.isAdmin).toBe(false);
  });

  it('ferme toutes les routes d’admin aux autres comptes et aux visiteurs', async () => {
    const res = await ape.get('/api/admin/stats').expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
    await ape.get('/api/admin/accounts').expect(403);
    await ape.get(`/api/admin/events/${eventId}`).expect(403);
    await agentFor(app).get('/api/admin/stats').expect(401);
  });

  it('donne les chiffres de toute l’instance', async () => {
    const res = await admin.get('/api/admin/stats').expect(200);
    expect(res.body).toEqual({ accounts: 3, events: 2, salesCount: 3, revenueCents: 650, salesLast7Days: 3 });
  });

  it('liste les comptes avec leurs chiffres, et les cherche par email ou par nom', async () => {
    const res = await admin.get('/api/admin/accounts').expect(200);
    expect(res.body.map((a: { email: string }) => a.email)).toEqual(['mairie@ecole.fr', 'ape@ecole.fr', ADMIN]);
    expect(res.body[1]).toMatchObject({ email: 'ape@ecole.fr', name: 'APE ape@ecole.fr', eventsCount: 1, salesCount: 3, revenueCents: 650, lastSaleAt: expect.any(String) });
    expect(res.body[0]).toMatchObject({ eventsCount: 1, salesCount: 0, revenueCents: 0, lastSaleAt: null });
    const found = await admin.get('/api/admin/accounts?q=MAIRIE').expect(200);
    expect(found.body.map((a: { email: string }) => a.email)).toEqual(['mairie@ecole.fr']);
  });

  it('montre le détail d’un compte et de ses évènements, et exporte un évènement', async () => {
    const list = await admin.get('/api/admin/accounts?q=ape@').expect(200);
    const accountId = list.body[0].id as string;
    const detail = await admin.get(`/api/admin/accounts/${accountId}`).expect(200);
    expect(detail.body.account).toMatchObject({ email: 'ape@ecole.fr' });
    expect(detail.body.events).toEqual([expect.objectContaining({ id: eventId, name: 'Kermesse 2027', salesCount: 3, revenueCents: 650 })]);
    const event = await admin.get(`/api/admin/events/${eventId}`).expect(200);
    expect(event.body.summary).toMatchObject({ salesCount: 3, revenueCents: 650 });
    const xlsx = await admin.get(`/api/admin/events/${eventId}/export`).expect(200);
    expect(xlsx.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await admin.get(`/api/admin/accounts/${randomUUID()}`).expect(404);
  });

  it('réinitialise le mot de passe d’un compte : nouveau mot de passe affiché une fois, sessions coupées', async () => {
    const accountId = (await admin.get('/api/admin/accounts?q=ape@').expect(200)).body[0].id as string;
    const res = await admin.post(`/api/admin/accounts/${accountId}/reset-password`).send({}).expect(200);
    expect(res.body.password).toMatch(/^[a-z0-9]{12}$/);
    await ape.get('/api/auth/me').expect(401);
    await agentFor(app).post('/api/auth/login').send({ email: 'ape@ecole.fr', password: res.body.password }).expect(200);
  });

  it('ne laisse pas l’admin supprimer son propre compte depuis les réglages (l’email resterait libre pour un autre)', async () => {
    const res = await admin.delete('/api/account').send({ password: 'kermesse2027' }).expect(403);
    expect(res.body.code).toBe('ADMIN_SELF_DELETE');
    await admin.get('/api/auth/me').expect(200);
  });

  it('signale les emails d’admin sans compte (à créer avant de les déclarer)', async () => {
    expect(await app.get(AdminService).missingAdmins()).toEqual(['autre-admin@cresus.test']);
  });

  it('supprime un compte, mais pas le sien', async () => {
    const accounts = (await admin.get('/api/admin/accounts').expect(200)).body as Array<{ id: string; email: string }>;
    const mine = accounts.find((a) => a.email === ADMIN)!;
    const theirs = accounts.find((a) => a.email === 'ape@ecole.fr')!;
    const self = await admin.delete(`/api/admin/accounts/${mine.id}`).expect(400);
    expect(self.body.code).toBe('CANNOT_DELETE_SELF');
    await admin.delete(`/api/admin/accounts/${theirs.id}`).expect(204);
    await ape.get('/api/auth/me').expect(401);
    expect((await admin.get('/api/admin/stats').expect(200)).body).toMatchObject({ accounts: 2, events: 1, salesCount: 0 });
  });
});
