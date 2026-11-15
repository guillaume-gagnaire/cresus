import { Inject, Injectable } from '@nestjs/common';
import type { EventDetailDto, EventDto } from '@cresus/shared';
import { and, asc, desc, eq, getTableColumns, isNull, sql } from 'drizzle-orm';
import { notFound } from '../common/app-error.js';
import { DB, type Db } from '../db/db.module.js';
import { type EventRow, articles, events, sales } from '../db/schema.js';
import { toArticleDto, toEventDto } from './mappers.js';
import { uuidParam } from './schemas.js';
import { SummaryService } from './summary.service.js';

const EVENT = 'Évènement';

@Injectable()
export class EventsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly summaries: SummaryService,
  ) {}

  /** L'évènement s'il appartient au compte, sinon 404 (aussi pour un identifiant qui n'est pas un UUID). */
  async requireEvent(accountId: string, eventId: string): Promise<EventRow> {
    const id = uuidParam(eventId, EVENT);
    const [row] = await this.db.select().from(events).where(and(eq(events.id, id), eq(events.accountId, accountId)));
    if (!row) throw notFound(EVENT);
    return row;
  }

  async list(accountId: string): Promise<EventDto[]> {
    const rows = await this.db
      .select({
        ...getTableColumns(events),
        salesCount: sql<number>`count(${sales.id})::int`,
        revenueCents: sql<number>`coalesce(sum(${sales.priceCents}), 0)::int`,
      })
      .from(events)
      .leftJoin(sales, and(eq(sales.eventId, events.id), isNull(sales.voidedAt)))
      .where(eq(events.accountId, accountId))
      .groupBy(events.id)
      .orderBy(desc(events.date), desc(events.createdAt));
    return rows.map(({ salesCount, revenueCents, ...row }) => toEventDto(row, { salesCount, revenueCents }));
  }

  async create(accountId: string, input: { name: string; date: string; copyFromEventId?: string | undefined }): Promise<EventDto> {
    const source = input.copyFromEventId ? await this.requireEvent(accountId, input.copyFromEventId) : null;
    const created = await this.db.transaction(async (tx) => {
      const [event] = await tx.insert(events).values({ accountId, name: input.name, date: input.date }).returning();
      if (source) {
        const toCopy = await tx
          .select()
          .from(articles)
          .where(and(eq(articles.eventId, source.id), isNull(articles.archivedAt)))
          .orderBy(asc(articles.position), asc(articles.createdAt));
        if (toCopy.length > 0) {
          await tx
            .insert(articles)
            .values(toCopy.map((a, position) => ({ eventId: event!.id, name: a.name, priceCents: a.priceCents, picto: a.picto, position, onSale: true })));
        }
      }
      return event!;
    });
    return toEventDto(created, { salesCount: 0, revenueCents: 0 });
  }

  async detail(accountId: string, eventId: string): Promise<EventDetailDto> {
    const event = await this.requireEvent(accountId, eventId);
    const rows = await this.db.select().from(articles).where(eq(articles.eventId, event.id)).orderBy(asc(articles.position), asc(articles.createdAt));
    const summary = await this.summaries.summary(event.id);
    return { event: toEventDto(event, summary), articles: rows.map(toArticleDto), summary };
  }

  async update(accountId: string, eventId: string, patch: { name?: string | undefined; date?: string | undefined }): Promise<EventDto> {
    const event = await this.requireEvent(accountId, eventId);
    const values = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    const [row] = Object.keys(values).length > 0 ? await this.db.update(events).set(values).where(eq(events.id, event.id)).returning() : [event];
    return toEventDto(row!, await this.summaries.summary(event.id));
  }

  async remove(accountId: string, eventId: string): Promise<void> {
    const event = await this.requireEvent(accountId, eventId);
    await this.db.delete(events).where(eq(events.id, event.id));
  }
}
