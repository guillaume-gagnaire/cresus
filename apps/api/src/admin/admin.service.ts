import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { AdminAccountDetailDto, AdminAccountDto, AdminStatsDto, EventDetailDto } from '@cresus/shared';
import { and, countDistinct, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { AppError, notFound } from '../common/app-error.js';
import { resetPassword } from '../cli/reset-password-core.js';
import { type AppConfig, CONFIG } from '../config.js';
import { DB, type Db } from '../db/db.module.js';
import { accounts, events, sales } from '../db/schema.js';
import { EventsService } from '../events/events.service.js';
import { type EventExport, ExportService } from '../events/export.service.js';
import { uuidParam } from '../events/schemas.js';

const ACCOUNT = 'Compte';
const EVENT = 'Évènement';
const int = (value: unknown): number => Number(value ?? 0);

@Injectable()
export class AdminService implements OnApplicationBootstrap {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(DB) private readonly db: Db,
    private readonly events: EventsService,
    private readonly exports: ExportService,
  ) {}

  /**
   * Emails de ADMIN_EMAILS sans compte : tant qu'ils le restent, le premier qui s'inscrit avec l'un d'eux devient admin.
   * Signalés au démarrage ; créez le compte avant de déclarer son email.
   */
  async missingAdmins(): Promise<string[]> {
    if (this.config.adminEmails.length === 0) return [];
    const found = await this.db.select({ email: accounts.email }).from(accounts).where(inArray(accounts.email, this.config.adminEmails));
    const existing = new Set(found.map((row) => row.email));
    return this.config.adminEmails.filter((email) => !existing.has(email));
  }

  async onApplicationBootstrap(): Promise<void> {
    const missing = await this.missingAdmins();
    if (missing.length > 0) {
      new Logger('Admin').warn(`ADMIN_EMAILS sans compte : ${missing.join(', ')}. Créez ces comptes au plus vite : le premier qui s'inscrirait avec l'un de ces emails deviendrait admin.`);
    }
  }

  async stats(): Promise<AdminStatsDto> {
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const count = sql<number>`count(*)::int`;
    const [accountRow] = await this.db.select({ count }).from(accounts);
    const [eventRow] = await this.db.select({ count }).from(events);
    const [saleRow] = await this.db
      .select({
        count,
        revenue: sql<number>`coalesce(sum(${sales.priceCents}), 0)::int`,
        recent: sql<number>`(count(*) filter (where ${sales.soldAt} >= ${weekAgo}))::int`,
      })
      .from(sales)
      .where(isNull(sales.voidedAt));
    return {
      accounts: int(accountRow?.count),
      events: int(eventRow?.count),
      salesCount: int(saleRow?.count),
      revenueCents: int(saleRow?.revenue),
      salesLast7Days: int(saleRow?.recent),
    };
  }

  /** Comptes, du plus récent au plus ancien, avec leurs chiffres ; `q` cherche dans l'email et le nom. */
  async accounts(q?: string, id?: string): Promise<AdminAccountDto[]> {
    const search = q?.trim() ? `%${q.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;
    const rows = await this.db
      .select({
        id: accounts.id,
        email: accounts.email,
        name: accounts.name,
        createdAt: accounts.createdAt,
        eventsCount: countDistinct(events.id),
        salesCount: sql<number>`count(${sales.id})::int`,
        revenueCents: sql<number>`coalesce(sum(${sales.priceCents}), 0)::int`,
        lastSaleAt: sql<Date | string | null>`max(${sales.soldAt})`,
      })
      .from(accounts)
      .leftJoin(events, eq(events.accountId, accounts.id))
      .leftJoin(sales, and(eq(sales.eventId, events.id), isNull(sales.voidedAt)))
      .where(and(id ? eq(accounts.id, id) : undefined, search ? or(ilike(accounts.email, search), ilike(accounts.name, search)) : undefined))
      .groupBy(accounts.id)
      .orderBy(desc(accounts.createdAt))
      .limit(500);
    return rows.map((row) => ({
      ...row,
      eventsCount: int(row.eventsCount),
      createdAt: row.createdAt.toISOString(),
      lastSaleAt: row.lastSaleAt ? new Date(row.lastSaleAt).toISOString() : null,
    }));
  }

  async account(accountId: string): Promise<AdminAccountDetailDto> {
    const [account] = await this.accounts(undefined, uuidParam(accountId, ACCOUNT));
    if (!account) throw notFound(ACCOUNT);
    return { account, events: await this.events.list(account.id) };
  }

  private async ownerOf(eventId: string): Promise<string> {
    const [row] = await this.db.select({ accountId: events.accountId }).from(events).where(eq(events.id, uuidParam(eventId, EVENT)));
    if (!row) throw notFound(EVENT);
    return row.accountId;
  }

  async event(eventId: string): Promise<EventDetailDto> {
    return this.events.detail(await this.ownerOf(eventId), eventId);
  }

  async exportEvent(eventId: string): Promise<EventExport> {
    return this.exports.build(await this.ownerOf(eventId), eventId);
  }

  /** Nouveau mot de passe (affiché une seule fois à l'admin) ; toutes les sessions du compte sont fermées. */
  async resetPassword(accountId: string): Promise<{ password: string }> {
    const [account] = await this.db.select({ email: accounts.email }).from(accounts).where(eq(accounts.id, uuidParam(accountId, ACCOUNT)));
    if (!account) throw notFound(ACCOUNT);
    return { password: await resetPassword(this.db, account.email) };
  }

  async deleteAccount(adminId: string, accountId: string): Promise<void> {
    const id = uuidParam(accountId, ACCOUNT);
    if (id === adminId) throw new AppError(400, 'CANNOT_DELETE_SELF', 'Vous ne pouvez pas supprimer votre propre compte d’ici.');
    const deleted = await this.db.delete(accounts).where(eq(accounts.id, id)).returning({ id: accounts.id });
    if (deleted.length === 0) throw notFound(ACCOUNT);
  }
}
