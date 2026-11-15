import type { SummaryDto } from '@cresus/shared';
import { describe, expect, it } from 'vitest';
import { applyPending, type QueuedOp, queueKey, saleOp, undoSale, voidOp } from '~/utils/sale-queue';

const EVENT = 'e1';
const CREPE = 'a-crepe';
const SODA = 'a-soda';

const server: SummaryDto = {
  eventId: EVENT,
  salesCount: 3,
  revenueCents: 650,
  articles: [
    { articleId: CREPE, count: 2, revenueCents: 500 },
    { articleId: SODA, count: 1, revenueCents: 150 },
  ],
  byHour: [{ hour: '2026-06-20T14:00', count: 3, revenueCents: 650 }],
};

const sale = (id: string, articleId: string, priceCents: number): QueuedOp => saleOp(EVENT, { id: articleId, priceCents }, id, '2026-06-20T12:00:00.000Z');

describe('applyPending', () => {
  it('ajoute les ventes en attente et retire les annulations en attente', () => {
    const ops: QueuedOp[] = [sale('s1', CREPE, 250), voidOp({ eventId: EVENT, id: 'old-soda', articleId: SODA, priceCents: 150 })];
    const shown = applyPending(server, ops);
    expect(shown.salesCount).toBe(3);
    expect(shown.revenueCents).toBe(750);
    expect(shown.articles).toEqual(
      expect.arrayContaining([
        { articleId: CREPE, count: 3, revenueCents: 750 },
        { articleId: SODA, count: 0, revenueCents: 0 },
      ]),
    );
    expect(shown.byHour).toEqual(server.byHour);
  });

  it('crée la ligne d’un article encore jamais vendu côté serveur', () => {
    const shown = applyPending(server, [sale('s1', 'a-gaufre', 300)]);
    expect(shown.articles).toContainEqual({ articleId: 'a-gaufre', count: 1, revenueCents: 300 });
  });

  it('ignore les opérations d’un autre évènement', () => {
    const other = saleOp('e2', { id: CREPE, priceCents: 250 }, 's9', '2026-06-20T12:00:00.000Z');
    expect(applyPending(server, [other])).toEqual(server);
  });

  it('ne descend jamais sous zéro', () => {
    const shown = applyPending({ ...server, salesCount: 0, revenueCents: 0, articles: [] }, [voidOp({ eventId: EVENT, id: 'x', articleId: SODA, priceCents: 150 })]);
    expect(shown.salesCount).toBe(0);
    expect(shown.articles).toContainEqual({ articleId: SODA, count: 0, revenueCents: 0 });
  });
});

describe('undoSale', () => {
  const target = { eventId: EVENT, id: 's1', articleId: CREPE, priceCents: 250 };

  it('retire de la file une vente pas encore envoyée', () => {
    const ops = [sale('s1', CREPE, 250), sale('s2', SODA, 150)];
    expect(undoSale(ops, target, new Set())).toEqual([ops[1]]);
  });

  it('ajoute une annulation pour une vente en cours d’envoi', () => {
    const ops = [sale('s1', CREPE, 250)];
    const next = undoSale(ops, target, new Set(['s1']));
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({ op: 'void', id: 's1', eventId: EVENT, articleId: CREPE, priceCents: 250 });
  });

  it('ajoute une annulation pour une vente déjà envoyée', () => {
    const next = undoSale([], target, new Set());
    expect(next).toEqual([{ op: 'void', id: 's1', eventId: EVENT, articleId: CREPE, priceCents: 250 }]);
  });
});

describe('queueKey', () => {
  it('range la file par compte', () => {
    expect(queueKey('acc-1')).toBe('cresus:queue:acc-1');
  });
});
