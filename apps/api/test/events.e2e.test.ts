import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DB, type Db } from '../src/db/db.module.js';
import { sales } from '../src/db/schema.js';
import { eventWithArticles, resetDb, setupTestApp, signedUpAgent } from './helpers.js';

describe('évènements', () => {
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

  it('crée et liste les évènements, du plus récent au plus ancien', async () => {
    const agent = await signedUpAgent(app);
    const created = await agent.post('/api/events').send({ name: '  Kermesse 2027 ', date: '2027-06-20' }).expect(201);
    expect(created.body).toMatchObject({ name: 'Kermesse 2027', date: '2027-06-20', salesCount: 0, revenueCents: 0 });
    await agent.post('/api/events').send({ name: 'Marché de Noël', date: '2026-12-12' }).expect(201);
    await agent.post('/api/events').send({ name: 'Boum', date: '2027-02-01' }).expect(201);
    const list = await agent.get('/api/events').expect(200);
    expect(list.body.map((e: { name: string }) => e.name)).toEqual(['Kermesse 2027', 'Boum', 'Marché de Noël']);
  });

  it('valide le nom et la date', async () => {
    const agent = await signedUpAgent(app);
    await agent.post('/api/events').send({ name: '', date: '2027-06-20' }).expect(400);
    await agent.post('/api/events').send({ name: 'x'.repeat(61), date: '2027-06-20' }).expect(400);
    await agent.post('/api/events').send({ name: 'Kermesse', date: '2026-13-01' }).expect(400);
    await agent.post('/api/events').send({ name: 'Kermesse', date: '2027-02-30' }).expect(400);
  });

  it('renomme, change la date et supprime un évènement', async () => {
    const agent = await signedUpAgent(app);
    const { eventId } = await eventWithArticles(agent, [['Crêpe', 250]]);
    const patched = await agent.patch(`/api/events/${eventId}`).send({ name: 'Fête de l’école', date: '2027-06-27' }).expect(200);
    expect(patched.body).toMatchObject({ name: 'Fête de l’école', date: '2027-06-27' });
    await agent.delete(`/api/events/${eventId}`).expect(204);
    await agent.get(`/api/events/${eventId}`).expect(404);
  });

  it('reprend les articles d’un évènement précédent : non archivés, tous en vente, même ordre', async () => {
    const agent = await signedUpAgent(app);
    const { eventId, articleIds } = await eventWithArticles(agent, [['Crêpe', 250], ['Soda', 150], ['Gaufre', 300]]);
    await agent.patch(`/api/events/${eventId}/articles/${articleIds[1]}`).send({ onSale: false, picto: 'beverage-box' }).expect(200);
    await app.get<Db>(DB).insert(sales).values({ id: randomUUID(), eventId, articleId: articleIds[2]!, priceCents: 300, soldAt: new Date() });
    await agent.delete(`/api/events/${eventId}/articles/${articleIds[2]}`).expect(204);

    const copy = await agent.post('/api/events').send({ name: 'Kermesse 2028', date: '2028-06-18', copyFromEventId: eventId }).expect(201);
    const detail = await agent.get(`/api/events/${copy.body.id}`).expect(200);
    expect(detail.body.articles.map((a: { name: string; onSale: boolean; picto: string | null; priceCents: number }) => [a.name, a.priceCents, a.onSale, a.picto])).toEqual([
      ['Crêpe', 250, true, null],
      ['Soda', 150, true, 'beverage-box'],
    ]);
  });

  it('cloisonne les assos : un autre compte ne voit ni ne touche rien', async () => {
    const ape = await signedUpAgent(app, 'ape@ecole.fr');
    const { eventId, articleIds } = await eventWithArticles(ape, [['Crêpe', 250]]);
    const other = await signedUpAgent(app, 'autre@ecole.fr');
    expect((await other.get('/api/events').expect(200)).body).toEqual([]);
    await other.get(`/api/events/${eventId}`).expect(404);
    await other.patch(`/api/events/${eventId}`).send({ name: 'Piraté' }).expect(404);
    await other.delete(`/api/events/${eventId}`).expect(404);
    await other.post(`/api/events/${eventId}/articles`).send({ name: 'Intrus', priceCents: 100 }).expect(404);
    await other.patch(`/api/events/${eventId}/articles/${articleIds[0]}`).send({ name: 'Piraté' }).expect(404);
    await other.delete(`/api/events/${eventId}/articles/${articleIds[0]}`).expect(404);
    await other.post('/api/events').send({ name: 'Copie', date: '2027-06-20', copyFromEventId: eventId }).expect(404);
    await other.get('/api/events/pas-un-uuid').expect(404);
    expect((await ape.get(`/api/events/${eventId}`).expect(200)).body.articles[0].name).toBe('Crêpe');
  });

  it('exige d’être connecté', async () => {
    const { default: request } = await import('supertest');
    await request(app.getHttpServer()).get('/api/events').expect(401);
  });
});
