import { Inject, Injectable } from '@nestjs/common';
import type { SummaryDto } from '@cresus/shared';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { sales } from '../db/schema.js';

/** Début de la tranche horaire de la vente, heure de Paris : YYYY-MM-DDTHH:00. */
const hourOfSale = sql<string>`to_char(date_trunc('hour', ${sales.soldAt} at time zone 'Europe/Paris'), 'YYYY-MM-DD"T"HH24:00')`;
const count = sql<number>`count(*)::int`;
const revenue = sql<number>`coalesce(sum(${sales.priceCents}), 0)::int`;

/** Compteurs d'un évènement, ventes annulées exclues : par article et par heure. */
@Injectable()
export class SummaryService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async summary(eventId: string, db: Db = this.db): Promise<SummaryDto> {
    const live = and(eq(sales.eventId, eventId), isNull(sales.voidedAt));
    const byArticle = await db
      .select({ articleId: sales.articleId, count, revenueCents: revenue })
      .from(sales)
      .where(live)
      .groupBy(sales.articleId);
    const byHour = await db
      .select({ hour: hourOfSale, count, revenueCents: revenue })
      .from(sales)
      .where(live)
      .groupBy(hourOfSale)
      .orderBy(hourOfSale);
    return {
      eventId,
      salesCount: byArticle.reduce((total, row) => total + row.count, 0),
      revenueCents: byArticle.reduce((total, row) => total + row.revenueCents, 0),
      articles: byArticle,
      byHour,
    };
  }
}
