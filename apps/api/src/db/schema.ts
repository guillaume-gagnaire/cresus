import { BILLING_MODES, CHARGE_FREQUENCIES, CLIENT_COLORS, LEAVE_SCOPES, LEGAL_STATUSES, PAYMENT_TERM_KEYS } from '@matreso/engine';
import { sql } from 'drizzle-orm';
import { bigint, boolean, customType, date, index, integer, pgEnum, pgTable, smallint, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });

export const legalStatusEnum = pgEnum('legal_status', LEGAL_STATUSES);
export const paymentTermEnum = pgEnum('payment_term', PAYMENT_TERM_KEYS);
export const billingModeEnum = pgEnum('billing_mode', BILLING_MODES);
export const clientColorEnum = pgEnum('client_color', CLIENT_COLORS);
export const leaveScopeEnum = pgEnum('leave_scope', LEAVE_SCOPES);
export const chargeFrequencyEnum = pgEnum('charge_frequency', CHARGE_FREQUENCIES);

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const userRef = () => uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' });

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
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
});

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
