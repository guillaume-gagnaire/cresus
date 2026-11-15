import { Inject, Injectable } from '@nestjs/common';
import { normalizeText } from '@cresus/shared';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { DB, type Db } from '../db/db.module.js';
import { accounts, articles, sales } from '../db/schema.js';
import { EventsService } from './events.service.js';
import { SummaryService } from './summary.service.js';

const EUROS = '#,##0.00 "€"';
const TZ = 'Europe/Paris';
const dayFormat = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit' });
const stampFormat = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' });

const euros = (cents: number): number => cents / 100;
/** '2026-06-20' → '20/06/2026' */
const frenchDate = (isoDay: string): string => isoDay.split('-').reverse().join('/');

export interface EventExport {
  filename: string;
  workbook: ExcelJS.Workbook;
}

@Injectable()
export class ExportService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly events: EventsService,
    private readonly summaries: SummaryService,
  ) {}

  async build(accountId: string, eventId: string): Promise<EventExport> {
    const event = await this.events.requireEvent(accountId, eventId);
    const [account] = await this.db.select({ name: accounts.name }).from(accounts).where(eq(accounts.id, accountId));
    const live = and(eq(sales.eventId, event.id), isNull(sales.voidedAt));

    // une ligne par couple article × prix pratiqué, dans l'ordre de caisse (archivés compris)
    const lines = await this.db
      .select({
        name: articles.name,
        priceCents: sales.priceCents,
        count: sql<number>`count(*)::int`,
        totalCents: sql<number>`sum(${sales.priceCents})::int`,
      })
      .from(sales)
      .innerJoin(articles, eq(articles.id, sales.articleId))
      .where(live)
      .groupBy(articles.id, articles.name, articles.position, sales.priceCents)
      .orderBy(asc(articles.position), sql`min(${sales.soldAt})`);
    const detail = await this.db
      .select({ name: articles.name, priceCents: sales.priceCents, soldAt: sales.soldAt })
      .from(sales)
      .innerJoin(articles, eq(articles.id, sales.articleId))
      .where(live)
      .orderBy(asc(sales.soldAt), asc(sales.id));
    const { byHour } = await this.summaries.summary(event.id);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Cresus';

    const recap = workbook.addWorksheet('Récapitulatif');
    recap.columns = [{ width: 32 }, { width: 16 }, { width: 12 }, { width: 14 }];
    recap.addRow(['Asso', account?.name ?? '']);
    recap.addRow(['Évènement', event.name]);
    recap.addRow(['Date', frenchDate(event.date)]);
    recap.addRow(['Exporté le', stampFormat.format(new Date())]);
    recap.addRow([]);
    recap.addRow(['Article', 'Prix unitaire', 'Quantité', 'Total']).font = { bold: true };
    for (const line of lines) recap.addRow([line.name, euros(line.priceCents), line.count, euros(line.totalCents)]);
    const total = recap.addRow([
      'Total',
      null,
      lines.reduce((sum, line) => sum + line.count, 0),
      euros(lines.reduce((sum, line) => sum + line.totalCents, 0)),
    ]);
    total.font = { bold: true };
    recap.getColumn(2).numFmt = EUROS;
    recap.getColumn(4).numFmt = EUROS;
    for (const row of [1, 2, 3, 4]) recap.getRow(row).getCell(1).font = { bold: true };

    const ventes = workbook.addWorksheet('Ventes');
    ventes.columns = [{ width: 12 }, { width: 10 }, { width: 32 }, { width: 12 }];
    ventes.addRow(['Date', 'Heure', 'Article', 'Prix']).font = { bold: true };
    for (const sale of detail) ventes.addRow([dayFormat.format(sale.soldAt), timeFormat.format(sale.soldAt), sale.name, euros(sale.priceCents)]);
    ventes.getColumn(4).numFmt = EUROS;

    const hours = workbook.addWorksheet('Par heure');
    hours.columns = [{ width: 22 }, { width: 18 }, { width: 14 }];
    hours.addRow(['Tranche horaire', 'Nombre de ventes', 'Montant']).font = { bold: true };
    const severalDays = new Set(byHour.map((bucket) => bucket.hour.slice(0, 10))).size > 1;
    for (const bucket of byHour) {
      const start = Number(bucket.hour.slice(11, 13));
      const range = `${String(start).padStart(2, '0')}:00 – ${String((start + 1) % 24).padStart(2, '0')}:00`;
      const day = severalDays ? `${frenchDate(bucket.hour.slice(0, 10)).slice(0, 5)} ` : '';
      hours.addRow([`${day}${range}`, bucket.count, euros(bucket.revenueCents)]);
    }
    hours.getColumn(3).numFmt = EUROS;

    const slug = normalizeText(event.name).replaceAll(' ', '-') || 'evenement';
    return { filename: `cresus-${slug}-${event.date}.xlsx`, workbook };
  }
}
