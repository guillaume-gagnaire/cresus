import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { SyncOp } from '@cresus/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Agent, eventWithArticles, resetDb, setupTestApp, signedUpAgent } from './helpers.js';

const sale = (articleId: string, priceCents: number, soldAt = new Date().toISOString()): Extract<SyncOp, { op: 'sale' }> => ({
  op: 'sale',
  id: randomUUID(),
  articleId,
  priceCents,
  soldAt,
});

describe('ventes : envoi idempotent, résumé, historique', () => {
  let app: NestExpressApplication;
  let agent: Agent;
  let eventId: string;
  let crepe: string;
  let soda: string;

  beforeAll(async () => {
    app = await setupTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDb(app);
    agent = await signedUpAgent(app);
    const created = await eventWithArticles(agent, [['Crêpe', 250], ['Soda', 150]]);
    eventId = created.eventId;
    [crepe, soda] = created.articleIds as [string, string];
  });

  const sync = (ops: SyncOp[]) => agent.post(`/api/events/${eventId}/sync`).send({ ops });

  it('compte les ventes et renvoie le résumé à jour', async () => {
    const res = await sync([sale(crepe, 250), sale(crepe, 250), sale(soda, 150)]).expect(200);
    expect(res.body).toMatchObject({ applied: 3, rejected: [], summary: { eventId, salesCount: 3, revenueCents: 650 } });
    expect(res.body.summary.articles).toEqual(
      expect.arrayContaining([
        { articleId: crepe, count: 2, revenueCents: 500 },
        { articleId: soda, count: 1, revenueCents: 150 },
      ]),
    );
    const summary = await agent.get(`/api/events/${eventId}/summary`).expect(200);
    expect(summary.body).toEqual(res.body.summary);
  });

  it('ne compte qu’une fois un lot renvoyé (réponse perdue, nouvel essai)', async () => {
    const ops = [sale(crepe, 250), sale(crepe, 250), sale(soda, 150)];
    await sync(ops).expect(200);
    const again = await sync(ops).expect(200);
    expect(again.body.summary).toMatchObject({ salesCount: 3, revenueCents: 650 });
  });

  it('annule une vente, une seule fois même si l’annulation est rejouée', async () => {
    const first = sale(crepe, 250);
    await sync([first, sale(crepe, 250), sale(soda, 150)]).expect(200);
    const voided = await sync([{ op: 'void', id: first.id }]).expect(200);
    expect(voided.body.summary).toMatchObject({ salesCount: 2, revenueCents: 400 });
    const replay = await sync([{ op: 'void', id: first.id }, { op: 'void', id: randomUUID() }]).expect(200);
    expect(replay.body.summary).toMatchObject({ salesCount: 2, revenueCents: 400 });
  });

  it('applique dans l’ordre une vente puis son annulation dans le même lot', async () => {
    const s = sale(crepe, 250);
    const res = await sync([s, { op: 'void', id: s.id }]).expect(200);
    expect(res.body.summary).toMatchObject({ salesCount: 0, revenueCents: 0 });
  });

  it('garde une vente datée par un téléphone à l’heure fausse, avec l’heure de réception', async () => {
    const future = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
    const res = await sync([sale(crepe, 250, future), sale(soda, 150, 'pas une date'), sale(soda, 150, '2001-01-01T00:00:00Z')]).expect(200);
    expect(res.body.summary.salesCount).toBe(3);
    const history = await agent.get(`/api/events/${eventId}/sales`).expect(200);
    for (const s of history.body.sales) expect(Math.abs(Date.parse(s.soldAt) - Date.now())).toBeLessThan(5000);
  });

  it('garde l’heure donnée par le téléphone quand elle est plausible (vente hors ligne de la veille)', async () => {
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    await sync([sale(crepe, 250, yesterday)]).expect(200);
    const history = await agent.get(`/api/events/${eventId}/sales`).expect(200);
    expect(history.body.sales[0].soldAt).toBe(yesterday);
  });

  it('rejette une vente d’un article inconnu sans bloquer le reste du lot', async () => {
    const ghost = sale(randomUUID(), 250);
    const ok = sale(crepe, 250);
    const res = await sync([ghost, ok]).expect(200);
    expect(res.body).toMatchObject({ applied: 1, rejected: [ghost.id], summary: { salesCount: 1, revenueCents: 250 } });
  });

  it('accepte une vente d’un article archivé entre-temps (vendu hors ligne avant la suppression)', async () => {
    await sync([sale(crepe, 250)]).expect(200);
    await agent.delete(`/api/events/${eventId}/articles/${crepe}`).expect(204);
    const res = await sync([sale(crepe, 250)]).expect(200);
    expect(res.body).toMatchObject({ applied: 1, rejected: [], summary: { salesCount: 2 } });
  });

  it('rejette une vente d’un article d’un autre évènement', async () => {
    const other = await eventWithArticles(agent, [['Gaufre', 300]], 'Autre');
    const res = await sync([sale(other.articleIds[0]!, 300)]).expect(200);
    expect(res.body.rejected).toHaveLength(1);
    expect(res.body.summary.salesCount).toBe(0);
  });

  it('garde le prix du moment quand le prix de l’article change ensuite', async () => {
    await sync([sale(crepe, 250)]).expect(200);
    await agent.patch(`/api/events/${eventId}/articles/${crepe}`).send({ priceCents: 300 }).expect(200);
    const res = await sync([sale(crepe, 300)]).expect(200);
    expect(res.body.summary.revenueCents).toBe(550);
  });

  it('valide les lots : vide, trop gros, opération mal formée', async () => {
    await sync([]).expect(400);
    await sync(Array.from({ length: 501 }, () => sale(crepe, 250))).expect(400);
    await sync([{ ...sale(crepe, 250), id: 'pas-un-uuid' }]).expect(400);
    await sync([sale(crepe, -5)]).expect(400);
  });

  it('cloisonne : un autre compte ne peut ni vendre ni lire', async () => {
    const other = await signedUpAgent(app, 'autre@ecole.fr');
    await other.post(`/api/events/${eventId}/sync`).send({ ops: [sale(crepe, 250)] }).expect(404);
    await other.get(`/api/events/${eventId}/summary`).expect(404);
    await other.get(`/api/events/${eventId}/sales`).expect(404);
  });

  it('pagine l’historique, plus récent d’abord, sans les ventes annulées', async () => {
    const a = sale(crepe, 250, '2026-06-20T12:00:00.000Z');
    const b = sale(soda, 150, '2026-06-20T12:01:00.000Z');
    const c = sale(crepe, 250, '2026-06-20T12:02:00.000Z');
    const voided = sale(soda, 150, '2026-06-20T12:03:00.000Z');
    await sync([a, b, c, voided, { op: 'void', id: voided.id }]).expect(200);

    const page1 = await agent.get(`/api/events/${eventId}/sales?limit=2`).expect(200);
    expect(page1.body.sales.map((s: { id: string }) => s.id)).toEqual([c.id, b.id]);
    expect(page1.body.sales[0]).toEqual({ id: c.id, articleId: crepe, articleName: 'Crêpe', priceCents: 250, soldAt: c.soldAt });
    expect(page1.body.next).toEqual(expect.any(String));
    const page2 = await agent.get(`/api/events/${eventId}/sales?limit=2&cursor=${encodeURIComponent(page1.body.next)}`).expect(200);
    expect(page2.body).toEqual({ sales: [expect.objectContaining({ id: a.id })], next: null });
    await agent.get(`/api/events/${eventId}/sales?limit=0`).expect(400);
    await agent.get(`/api/events/${eventId}/sales?cursor=n-importe-quoi`).expect(400);
  });
});
