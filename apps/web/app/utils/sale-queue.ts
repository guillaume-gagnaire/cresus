import type { ArticleTotals, SummaryDto, SyncOp } from '@cresus/shared';

/**
 * File des ventes du téléphone (localStorage, par compte). Chaque opération garde son évènement, son article et son
 * prix : une annulation (`void`) aussi, pour retirer la vente des compteurs affichés avant même d'être envoyée.
 */
export type QueuedOp = SyncOp & { eventId: string; articleId: string; priceCents: number };

export interface SaleRef {
  eventId: string;
  id: string;
  articleId: string;
  priceCents: number;
}

export const queueKey = (accountId: string): string => `cresus:queue:${accountId}`;
export const cacheKey = (accountId: string, eventId: string): string => `cresus:event:${accountId}:${eventId}`;

export function saleOp(eventId: string, article: { id: string; priceCents: number }, id: string, soldAt: string): QueuedOp {
  return { op: 'sale', id, eventId, articleId: article.id, priceCents: article.priceCents, soldAt };
}

export function voidOp(sale: SaleRef): QueuedOp {
  return { op: 'void', id: sale.id, eventId: sale.eventId, articleId: sale.articleId, priceCents: sale.priceCents };
}

/** Ce que voit le bénévole : les compteurs du serveur, plus les ventes en attente, moins les annulations en attente. */
export function applyPending(summary: SummaryDto, ops: readonly QueuedOp[]): SummaryDto {
  const mine = ops.filter((op) => op.eventId === summary.eventId);
  if (mine.length === 0) return summary;
  const byArticle = new Map<string, ArticleTotals>(summary.articles.map((a) => [a.articleId, { ...a }]));
  let salesCount = summary.salesCount;
  let revenueCents = summary.revenueCents;
  for (const op of mine) {
    const sign = op.op === 'sale' ? 1 : -1;
    const line = byArticle.get(op.articleId) ?? { articleId: op.articleId, count: 0, revenueCents: 0 };
    line.count = Math.max(0, line.count + sign);
    line.revenueCents = Math.max(0, line.revenueCents + sign * op.priceCents);
    byArticle.set(op.articleId, line);
    salesCount = Math.max(0, salesCount + sign);
    revenueCents = Math.max(0, revenueCents + sign * op.priceCents);
  }
  return { ...summary, salesCount, revenueCents, articles: [...byArticle.values()] };
}

/**
 * Annule une vente de ce téléphone : encore dans la file et pas en cours d'envoi, elle en est simplement retirée ;
 * sinon (en cours d'envoi, ou déjà reçue par le serveur) une annulation est ajoutée à la file.
 */
export function undoSale(ops: readonly QueuedOp[], sale: SaleRef, inFlight: ReadonlySet<string>): QueuedOp[] {
  const queued = ops.some((op) => op.op === 'sale' && op.id === sale.id);
  if (queued && !inFlight.has(sale.id)) return ops.filter((op) => !(op.op === 'sale' && op.id === sale.id));
  return [...ops, voidOp(sale)];
}

/** Opérations telles que l'API les attend (sans les champs d'affichage d'une annulation). */
export function toSyncOps(ops: readonly QueuedOp[]): SyncOp[] {
  return ops.map((op) =>
    op.op === 'sale' ? { op: 'sale', id: op.id, articleId: op.articleId, priceCents: op.priceCents, soldAt: op.soldAt } : { op: 'void', id: op.id },
  );
}
