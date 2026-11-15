import { Inject, Injectable } from '@nestjs/common';
import type { ArticleDto } from '@cresus/shared';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { AppError, notFound } from '../common/app-error.js';
import { DB, type Db } from '../db/db.module.js';
import { type ArticleRow, articles, sales } from '../db/schema.js';
import { LiveBus } from '../live/live.bus.js';
import { EventsService } from './events.service.js';
import { toArticleDto } from './mappers.js';
import { uuidParam } from './schemas.js';

const ARTICLE = 'Article';

type ArticlePatch = { name?: string | undefined; priceCents?: number | undefined; picto?: string | null | undefined; onSale?: boolean | undefined };

@Injectable()
export class ArticlesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly events: EventsService,
    private readonly live: LiveBus,
  ) {}

  /** Article non archivé de l'évènement du compte, sinon 404. */
  private async requireArticle(accountId: string, eventId: string, articleId: string): Promise<ArticleRow> {
    const event = await this.events.requireEvent(accountId, eventId);
    const id = uuidParam(articleId, ARTICLE);
    const [row] = await this.db
      .select()
      .from(articles)
      .where(and(eq(articles.id, id), eq(articles.eventId, event.id), isNull(articles.archivedAt)));
    if (!row) throw notFound(ARTICLE);
    return row;
  }

  async create(accountId: string, eventId: string, input: { name: string; priceCents: number; picto?: string | null | undefined }): Promise<ArticleDto> {
    const event = await this.events.requireEvent(accountId, eventId);
    const [row] = await this.db
      .insert(articles)
      .values({
        eventId: event.id,
        name: input.name,
        priceCents: input.priceCents,
        picto: input.picto ?? null,
        position: sql`(select coalesce(max(${articles.position}) + 1, 0) from ${articles} where ${articles.eventId} = ${event.id})`,
      })
      .returning();
    this.live.changed(event.id);
    return toArticleDto(row!);
  }

  async update(accountId: string, eventId: string, articleId: string, patch: ArticlePatch): Promise<ArticleDto> {
    const article = await this.requireArticle(accountId, eventId, articleId);
    const values = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    if (Object.keys(values).length === 0) return toArticleDto(article);
    const [row] = await this.db.update(articles).set(values).where(eq(articles.id, article.id)).returning();
    this.live.changed(article.eventId);
    return toArticleDto(row!);
  }

  /** `ids` : exactement les articles non archivés, dans l'ordre de caisse voulu. */
  async reorder(accountId: string, eventId: string, ids: string[]): Promise<ArticleDto[]> {
    const event = await this.events.requireEvent(accountId, eventId);
    const current = await this.db
      .select()
      .from(articles)
      .where(and(eq(articles.eventId, event.id), isNull(articles.archivedAt)));
    const wanted = ids.map((id) => id.toLowerCase());
    const known = new Set(current.map((a) => a.id));
    if (wanted.length !== current.length || new Set(wanted).size !== wanted.length || !wanted.every((id) => known.has(id))) {
      throw new AppError(400, 'ORDER_MISMATCH', 'La liste des articles a changé. Rechargez la page.');
    }
    await this.db.transaction(async (tx) => {
      for (const [position, id] of wanted.entries()) await tx.update(articles).set({ position }).where(eq(articles.id, id));
    });
    const rows = await this.db
      .select()
      .from(articles)
      .where(and(eq(articles.eventId, event.id), isNull(articles.archivedAt)))
      .orderBy(asc(articles.position));
    this.live.changed(event.id);
    return rows.map(toArticleDto);
  }

  /** Sans vente (annulées exceptées) : supprimé. Avec des ventes : archivé, pour rester dans le bilan et l'export. */
  async remove(accountId: string, eventId: string, articleId: string): Promise<void> {
    const article = await this.requireArticle(accountId, eventId, articleId);
    const [sold] = await this.db
      .select({ id: sales.id })
      .from(sales)
      .where(and(eq(sales.articleId, article.id), isNull(sales.voidedAt)))
      .limit(1);
    if (sold) await this.db.update(articles).set({ archivedAt: new Date(), onSale: false }).where(eq(articles.id, article.id));
    else await this.db.delete(articles).where(eq(articles.id, article.id));
    this.live.changed(article.eventId);
  }
}
