import { BILLING_MODES, CHARGE_FREQUENCIES, CLIENT_COLORS, LEAVE_SCOPES, LEGAL_STATUSES, PAYMENT_TERM_KEYS } from '@matreso/engine';
import { sql } from 'drizzle-orm';
import { bigint, boolean, customType, date, index, integer, jsonb, pgEnum, pgTable, smallint, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });

export const legalStatusEnum = pgEnum('legal_status', LEGAL_STATUSES);
export const paymentTermEnum = pgEnum('payment_term', PAYMENT_TERM_KEYS);
export const billingModeEnum = pgEnum('billing_mode', BILLING_MODES);
export const clientColorEnum = pgEnum('client_color', CLIENT_COLORS);
export const leaveScopeEnum = pgEnum('leave_scope', LEAVE_SCOPES);
export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'USER']);
export const chargeFrequencyEnum = pgEnum('charge_frequency', CHARGE_FREQUENCIES);

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const userRef = () => uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' });

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('USER'),
  firstName: text('first_name').notNull(),
  companyName: text('company_name'),
  legalStatus: legalStatusEnum('legal_status').notNull().default('SASU'),
  netPayMonthly: integer('net_pay_monthly').notNull().default(0),
  microVersementLiberatoire: boolean('micro_versement_liberatoire').notNull().default(false),
  microIncomeTaxProvisionPct: integer('micro_income_tax_provision_pct').notNull().default(10),
  microProExpensesMonthly: integer('micro_pro_expenses_monthly').notNull().default(18_000),
  includeProspects: boolean('include_prospects').notNull().default(false),
  alertRedMonth: boolean('alert_red_month').notNull().default(true),
  alertLatePayment: boolean('alert_late_payment').notNull().default(true),
  createdAt: createdAt(),
  // un seul ADMIN : le premier inscrit (cf. AuthService.register)
}, (t) => [uniqueIndex('users_single_admin_uq').on(t.role).where(sql`${t.role} = 'ADMIN'`)]);

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // SHA-256 hex du jeton
  userId: userRef(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}, (t) => [index('sessions_user_idx').on(t.userId)]);

export const passkeys = pgTable('passkeys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: userRef(),
  credentialId: text('credential_id').notNull().unique(),
  publicKey: bytea('public_key').notNull(),
  counter: bigint('counter', { mode: 'number' }).notNull().default(0),
  transports: text('transports').array().notNull().default(sql`'{}'::text[]`),
  deviceName: text('device_name'),
  createdAt: createdAt(),
});

export const balanceSnapshots = pgTable('balance_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: userRef(),
  date: date('date', { mode: 'string' }).notNull(),
  amount: integer('amount').notNull(),
  createdAt: createdAt(),
}, (t) => [index('balance_user_date_idx').on(t.userId, t.date)]);

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: userRef(),
  name: text('name').notNull(),
  subtitle: text('subtitle'),
  color: clientColorEnum('color').notNull(),
  billingMode: billingModeEnum('billing_mode').notNull(),
  weekdays: smallint('weekdays').array().notNull().default(sql`'{}'::smallint[]`),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  endDate: date('end_date', { mode: 'string' }),
  paymentTerm: paymentTermEnum('payment_term').notNull(),
  averageDelayDays: integer('average_delay_days').notNull().default(0),
  isProspect: boolean('is_prospect').notNull().default(false),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  position: integer('position').notNull().default(0),
  createdAt: createdAt(),
}, (t) => [index('clients_user_idx').on(t.userId)]);

export const rates = pgTable('rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  validFrom: date('valid_from', { mode: 'string' }).notNull(),
  amount: integer('amount').notNull(),
}, (t) => [unique('rates_client_valid_from_uq').on(t.clientId, t.validFrom)]);

export const leaves = pgTable('leaves', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: userRef(),
  date: date('date', { mode: 'string' }).notNull(),
  scope: leaveScopeEnum('scope').notNull(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
}, (t) => [unique('leaves_user_date_client_uq').on(t.userId, t.date, t.clientId).nullsNotDistinct()]);

export const charges = pgTable('charges', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: userRef(),
  name: text('name').notNull(),
  amount: integer('amount').notNull(),
  frequency: chargeFrequencyEnum('frequency').notNull(),
  month: integer('month'),
  category: text('category'),
  createdAt: createdAt(),
}, (t) => [index('charges_user_idx').on(t.userId)]);

/** Clients OAuth enregistrés dynamiquement (RFC 7591) : toujours publics, sans secret. */
export const oauthClients = pgTable('oauth_clients', {
  clientId: text('client_id').primaryKey(),
  clientName: text('client_name').notNull(),
  redirectUris: text('redirect_uris').array().notNull(),
  /** Métadonnées d'enregistrement complètes, telles que renvoyées au client. */
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull(),
  createdAt: createdAt(),
});

const oauthClientRef = () => text('client_id').notNull().references(() => oauthClients.clientId, { onDelete: 'cascade' });

/** Demande d'autorisation en attente du consentement de l'utilisateur (10 min). */
export const oauthRequests = pgTable('oauth_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: oauthClientRef(),
  redirectUri: text('redirect_uri').notNull(),
  codeChallenge: text('code_challenge').notNull(),
  state: text('state'),
  scope: text('scope').notNull(),
  resource: text('resource'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

/** Code d'autorisation à usage unique (5 min), conservé sous forme de hachage SHA-256 hexadécimal. */
export const oauthCodes = pgTable('oauth_codes', {
  codeHash: text('code_hash').primaryKey(),
  clientId: oauthClientRef(),
  userId: userRef(),
  redirectUri: text('redirect_uri').notNull(),
  codeChallenge: text('code_challenge').notNull(),
  scope: text('scope').notNull(),
  resource: text('resource'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (t) => [index('oauth_codes_user_idx').on(t.userId)]);

/** Paire jeton d'accès (1 h) / jeton de rafraîchissement (30 j), conservée sous forme de hachages SHA-256 hexadécimaux. */
export const oauthTokens = pgTable('oauth_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  accessHash: text('access_hash').notNull().unique(),
  refreshHash: text('refresh_hash').notNull().unique(),
  clientId: oauthClientRef(),
  userId: userRef(),
  scope: text('scope').notNull(),
  accessExpiresAt: timestamp('access_expires_at', { withTimezone: true }).notNull(),
  refreshExpiresAt: timestamp('refresh_expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  /** Hachage du code d'autorisation d'origine (conservé par la rotation) : un code rejoué révoque toute sa descendance. */
  codeHash: text('code_hash'),
}, (t) => [index('oauth_tokens_user_idx').on(t.userId), index('oauth_tokens_code_idx').on(t.codeHash)]);
