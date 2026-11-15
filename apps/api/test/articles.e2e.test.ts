import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DB, type Db } from '../src/db/db.module.js';
import { sales } from '../src/db/schema.js';
import { eventWithArticles, resetDb, setupTestApp, signedUpAgent } from './helpers.js';

describe('articles d’un évènement', () => {
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

  it('ajoute les articles à la suite, avec picto automatique par défaut', async () => {
    const agent = await signedUpAgent(app);
    const { eventId } = await eventWithArticles(agent);
    const crepe = await agent.post(`/api/events/${eventId}/articles`).send({ name: ' Crêpe nutella ', priceCents: 250 }).expect(201);
    expect(crepe.body).toMatchObject({ eventId, name: 'Crêpe nutella', priceCents: 250, picto: null, position: 0, onSale: true, archived: false });
    const soda = await agent.post(`/api/events/${eventId}/articles`).send({ name: 'Coca', priceCents: 150, picto: 'cup-with-straw' }).expect(201);
    expect(soda.body).toMatchObject({ position: 1, picto: 'cup-with-straw' });
  });

  it('valide nom, prix et picto', async () => {
    const agent = await signedUpAgent(app);
    const { eventId } = await eventWithArticles(agent);
    const url = `/api/events/${eventId}/articles`;
    await agent.post(url).send({ name: '', priceCents: 100 }).expect(400);
    await agent.post(url).send({ name: 'x'.repeat(41), priceCents: 100 }).expect(400);
    await agent.post(url).send({ name: 'Crêpe', priceCents: -1 }).expect(400);
    await agent.post(url).send({ name: 'Crêpe', priceCents: 100_000 }).expect(400);
    await agent.post(url).send({ name: 'Crêpe', priceCents: 2.5 }).expect(400);
    await agent.post(url).send({ name: 'Crêpe', priceCents: 100, picto: 'Pizza!' }).expect(400);
    await agent.post(url).send({ name: 'Gratuit', priceCents: 0 }).expect(201);
  });

  it('modifie un article (nom, prix, picto, en vente)', async () => {
    const agent = await signedUpAgent(app);
    const { eventId, articleIds } = await eventWithArticles(agent, [['Crêpe', 250]]);
    const res = await agent
      .patch(`/api/events/${eventId}/articles/${articleIds[0]}`)
      .send({ name: 'Crêpe sucre', priceCents: 200, picto: 'waffle', onSale: false })
      .expect(200);
    expect(res.body).toMatchObject({ name: 'Crêpe sucre', priceCents: 200, picto: 'waffle', onSale: false });
    const auto = await agent.patch(`/api/events/${eventId}/articles/${articleIds[0]}`).send({ picto: null }).expect(200);
    expect(auto.body.picto).toBeNull();
  });

  it('réordonne les articles, et refuse un ordre qui ne contient pas exactement les articles', async () => {
    const agent = await signedUpAgent(app);
    const { eventId, articleIds } = await eventWithArticles(agent, [['Crêpe', 250], ['Soda', 150], ['Gaufre', 300]]);
    const [crepe, soda, gaufre] = articleIds as [string, string, string];
    const res = await agent.put(`/api/events/${eventId}/articles/order`).send({ ids: [gaufre, crepe, soda] }).expect(200);
    expect(res.body.map((a: { name: string }) => a.name)).toEqual(['Gaufre', 'Crêpe', 'Soda']);
    const detail = await agent.get(`/api/events/${eventId}`).expect(200);
    expect(detail.body.articles.map((a: { name: string; position: number }) => [a.name, a.position])).toEqual([
      ['Gaufre', 0],
      ['Crêpe', 1],
      ['Soda', 2],
    ]);
    const bad = await agent.put(`/api/events/${eventId}/articles/order`).send({ ids: [gaufre, crepe] }).expect(400);
    expect(bad.body.code).toBe('ORDER_MISMATCH');
    await agent.put(`/api/events/${eventId}/articles/order`).send({ ids: [gaufre, crepe, crepe] }).expect(400);
  });

  it('supprime un article sans vente, archive un article qui a des ventes', async () => {
    const agent = await signedUpAgent(app);
    const { eventId, articleIds } = await eventWithArticles(agent, [['Crêpe', 250], ['Soda', 150]]);
    const [crepe, soda] = articleIds as [string, string];
    await app.get<Db>(DB).insert(sales).values({ id: randomUUID(), eventId, articleId: crepe, priceCents: 250, soldAt: new Date() });

    await agent.delete(`/api/events/${eventId}/articles/${soda}`).expect(204);
    await agent.delete(`/api/events/${eventId}/articles/${crepe}`).expect(204);

    const detail = await agent.get(`/api/events/${eventId}`).expect(200);
    expect(detail.body.articles).toHaveLength(1);
    expect(detail.body.articles[0]).toMatchObject({ id: crepe, archived: true });
    expect(detail.body.summary).toMatchObject({ salesCount: 1, revenueCents: 250 });
    // un article archivé ne compte plus dans l'ordre de caisse
    await agent.put(`/api/events/${eventId}/articles/order`).send({ ids: [] }).expect(200);
    await agent.patch(`/api/events/${eventId}/articles/${crepe}`).send({ name: 'Retour' }).expect(404);
  });

  it('donne le résumé dans le détail et la liste (ventes annulées exclues)', async () => {
    const agent = await signedUpAgent(app);
    const { eventId, articleIds } = await eventWithArticles(agent, [['Crêpe', 250], ['Soda', 150]]);
    const db = app.get<Db>(DB);
    await db.insert(sales).values([
      { id: randomUUID(), eventId, articleId: articleIds[0]!, priceCents: 250, soldAt: new Date('2027-06-20T12:10:00Z') },
      { id: randomUUID(), eventId, articleId: articleIds[0]!, priceCents: 250, soldAt: new Date('2027-06-20T12:50:00Z') },
      { id: randomUUID(), eventId, articleId: articleIds[1]!, priceCents: 150, soldAt: new Date('2027-06-20T13:05:00Z') },
      { id: randomUUID(), eventId, articleId: articleIds[1]!, priceCents: 150, soldAt: new Date('2027-06-20T13:06:00Z'), voidedAt: new Date() },
    ]);
    const detail = await agent.get(`/api/events/${eventId}`).expect(200);
    expect(detail.body.summary).toEqual({
      eventId,
      salesCount: 3,
      revenueCents: 650,
      articles: expect.arrayContaining([
        { articleId: articleIds[0], count: 2, revenueCents: 500 },
        { articleId: articleIds[1], count: 1, revenueCents: 150 },
      ]),
      byHour: [
        { hour: '2027-06-20T14:00', count: 2, revenueCents: 500 },
        { hour: '2027-06-20T15:00', count: 1, revenueCents: 150 },
      ],
    });
    const list = await agent.get('/api/events').expect(200);
    expect(list.body[0]).toMatchObject({ salesCount: 3, revenueCents: 650 });
  });
});
