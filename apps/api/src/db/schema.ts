import { sql } from 'drizzle-orm';
import { boolean, date, index, integer, pgSchema, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * Toutes les tables de Cresus vivent dans le schéma « cresus » : la base de production a d'abord servi à Ma Tréso, dont
 * les tables (et le journal de migrations) restent dans « public » et « drizzle » sans jamais gêner Cresus.
 */
export const cresus = pgSchema('cresus');

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/** Une asso = un compte = un email. Les bénévoles partagent ses identifiants. */
export const accounts = cresus.table(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('accounts_email_uq').on(t.email)],
);

/** `id` est le hash SHA-256 du jeton du cookie : le jeton lui-même n'est jamais stocké. */
export const sessions = cresus.table(
  'sessions',
  {
    id: text('id').primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_account_idx').on(t.accountId)],
);

export const events = cresus.table(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('events_account_date_idx').on(t.accountId, t.date)],
);

export const articles = cresus.table(
  'articles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    priceCents: integer('price_cents').notNull(),
    /** Picto choisi, ou null : choix automatique d'après le nom (côté front). */
    picto: text('picto'),
    position: integer('position').notNull(),
    onSale: boolean('on_sale').notNull().default(true),
    /** Article supprimé alors qu'il avait des ventes : il reste dans le bilan et l'export. */
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('articles_event_idx').on(t.eventId)],
);

/** Une vente = un appui. `id` est généré par le téléphone (envoi idempotent), le prix est celui du moment. */
export const sales = cresus.table(
  'sales',
  {
    id: uuid('id').primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    articleId: uuid('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    priceCents: integer('price_cents').notNull(),
    soldAt: timestamp('sold_at', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
  },
  (t) => [
    index('sales_event_sold_idx').on(t.eventId, t.soldAt),
    index('sales_article_live_idx').on(t.articleId).where(sql`${t.voidedAt} is null`),
  ],
);

export type AccountRow = typeof accounts.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type ArticleRow = typeof articles.$inferSelect;
export type SaleRow = typeof sales.$inferSelect;
