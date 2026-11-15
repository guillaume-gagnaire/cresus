import type { ArticleDto, EventDto } from '@cresus/shared';
import type { ArticleRow, EventRow } from '../db/schema.js';

export const toEventDto = (row: EventRow, totals: { salesCount: number; revenueCents: number }): EventDto => ({
  id: row.id,
  name: row.name,
  date: row.date,
  salesCount: totals.salesCount,
  revenueCents: totals.revenueCents,
  createdAt: row.createdAt.toISOString(),
});

export const toArticleDto = (row: ArticleRow): ArticleDto => ({
  id: row.id,
  eventId: row.eventId,
  name: row.name,
  priceCents: row.priceCents,
  picto: row.picto,
  position: row.position,
  onSale: row.onSale,
  archived: row.archivedAt !== null,
});
