import { Inject, Injectable } from '@nestjs/common';
import type { SalesPageDto, SummaryDto, SyncOp, SyncResponse } from '@cresus/shared';
import { and, desc, eq, isNull, lt, or } from 'drizzle-orm';
import { AppError } from '../common/app-error.js';
import { DB, type Db } from '../db/db.module.js';
import { articles, sales } from '../db/schema.js';
import { EventsService } from './events.service.js';
import { SummaryService } from './summary.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EARLIEST_SALE = Date.UTC(2020, 0, 1);
const MAX_CLOCK_AHEAD_MS = 24 * 3600 * 1000;

/**
 * Heure de vente donnée par le téléphone, si elle est plausible. Un téléphone à l'heure fausse (plus d'un jour d'avance,
 * date d'avant 2020, texte illisible) : la vente est gardée avec l'heure de réception plutôt que perdue.
 */
export function plausibleSoldAt(soldAt: string, now: Date): Date {
  const time = Date.parse(soldAt);
  if (Number.isNaN(time) || time < EARLIEST_SALE || time > now.getTime() + MAX_CLOCK_AHEAD_MS) return now;
  return new Date(time);
}

const BAD_CURSOR = () => new AppError(400, 'VALIDATION', 'Curseur invalide.');

function encodeCursor(soldAt: Date, id: string): string {
  return Buffer.from(JSON.stringify([soldAt.toISOString(), id])).toString('base64url');
}

function decodeCursor(cursor: string): { soldAt: Date; id: string } {
  try {
    const [soldAt, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as [unknown, unknown];
    if (typeof soldAt !== 'string' || typeof id !== 'string' || !UUID.test(id) || Number.isNaN(Date.parse(soldAt))) throw BAD_CURSOR();
    return { soldAt: new Date(soldAt), id };
  } catch {
    throw BAD_CURSOR();
  }
}

@Injectable()
export class SalesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly events: EventsService,
    private readonly summaries: SummaryService,
  ) {}

  /**
   * Applique un lot d'opérations dans l'ordre, en une transaction. Idempotent : une vente déjà reçue (même id) est
   * ignorée, une annulation déjà faite aussi. Une vente d'un article inconnu de l'évènement est rejetée (son id est
   * renvoyé pour que le téléphone l'abandonne) sans faire échouer le lot. Un article archivé reste accepté : la vente
   * a pu être faite hors ligne avant la suppression.
   */
  async sync(accountId: string, eventId: string, ops: SyncOp[]): Promise<SyncResponse> {
    const event = await this.events.requireEvent(accountId, eventId);
    const now = new Date();
    let applied = 0;
    const rejected: string[] = [];
    const summary = await this.db.transaction(async (tx) => {
      const known = new Set((await tx.select({ id: articles.id }).from(articles).where(eq(articles.eventId, event.id))).map((row) => row.id));
      for (const op of ops) {
        const id = op.id.toLowerCase();
        if (op.op === 'sale') {
          const articleId = op.articleId.toLowerCase();
          if (!UUID.test(articleId) || !known.has(articleId)) {
            rejected.push(op.id);
            continue;
          }
          await tx
            .insert(sales)
            .values({ id, eventId: event.id, articleId, priceCents: op.priceCents, soldAt: plausibleSoldAt(op.soldAt, now), receivedAt: now })
            .onConflictDoNothing({ target: sales.id });
        } else {
          await tx
            .update(sales)
            .set({ voidedAt: now })
            .where(and(eq(sales.id, id), eq(sales.eventId, event.id), isNull(sales.voidedAt)));
        }
        applied++;
      }
      return this.summaries.summary(event.id, tx as unknown as Db);
    });
    return { applied, rejected, summary };
  }

  async summary(accountId: string, eventId: string): Promise<SummaryDto> {
    const event = await this.events.requireEvent(accountId, eventId);
    return this.summaries.summary(event.id);
  }

  /** Ventes non annulées, plus récentes d'abord (heure de vente puis id), par pages. */
  async history(accountId: string, eventId: string, limit: number, cursor?: string): Promise<SalesPageDto> {
    const event = await this.events.requireEvent(accountId, eventId);
    const after = cursor ? decodeCursor(cursor) : null;
    const rows = await this.db
      .select({ id: sales.id, articleId: sales.articleId, articleName: articles.name, priceCents: sales.priceCents, soldAt: sales.soldAt })
      .from(sales)
      .innerJoin(articles, eq(articles.id, sales.articleId))
      .where(
        and(
          eq(sales.eventId, event.id),
          isNull(sales.voidedAt),
          after ? or(lt(sales.soldAt, after.soldAt), and(eq(sales.soldAt, after.soldAt), lt(sales.id, after.id))) : undefined,
        ),
      )
      .orderBy(desc(sales.soldAt), desc(sales.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      sales: page.map((row) => ({ ...row, soldAt: row.soldAt.toISOString() })),
      next: rows.length > limit && last ? encodeCursor(last.soldAt, last.id) : null,
    };
  }
}
