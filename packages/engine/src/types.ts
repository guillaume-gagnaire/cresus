import type { ISODate } from './dates';

export type Cents = number;

export const LEGAL_STATUSES = ['SASU', 'SAS', 'SASU_IR', 'SARL', 'EURL_IS', 'EURL_IR', 'EI', 'MICRO'] as const;
export type LegalStatus = (typeof LEGAL_STATUSES)[number];
export type SocialRegime = 'SALARIE' | 'TNS' | 'MICRO';

export const PAYMENT_TERM_KEYS = ['RECEPTION', 'NET_30', 'NET_45', 'EOM_30', 'NET_60'] as const;
export type PaymentTerm = (typeof PAYMENT_TERM_KEYS)[number];

export const BILLING_MODES = ['TJM', 'FORFAIT'] as const;
export type BillingMode = (typeof BILLING_MODES)[number];

export const CLIENT_COLORS = ['indigo', 'orange', 'violet', 'green', 'rose', 'teal'] as const;
export type ClientColor = (typeof CLIENT_COLORS)[number];

export const LEAVE_SCOPES = ['ALL', 'CLIENT'] as const;
export type LeaveScope = (typeof LEAVE_SCOPES)[number];

export const CHARGE_FREQUENCIES = ['MONTHLY', 'YEARLY'] as const;
export type ChargeFrequency = (typeof CHARGE_FREQUENCIES)[number];

export interface Rate {
  id?: string;
  validFrom: ISODate;
  amount: Cents;
}

export interface Client {
  id: string;
  name: string;
  subtitle: string | null;
  color: ClientColor;
  billingMode: BillingMode;
  /** 0 = lundi … 4 = vendredi ; vide si FORFAIT */
  weekdays: number[];
  startDate: ISODate;
  endDate: ISODate | null;
  paymentTerm: PaymentTerm;
  /** 0 à 30 jours */
  averageDelayDays: number;
  isProspect: boolean;
  archivedAt: string | null;
  rates: Rate[];
}

export interface Leave {
  id?: string;
  date: ISODate;
  scope: LeaveScope;
  clientId: string | null;
}

export interface Charge {
  id: string;
  name: string;
  amount: Cents;
  frequency: ChargeFrequency;
  /** 0 = janvier … 11 = décembre ; requis si YEARLY */
  month: number | null;
  category: string | null;
}

export interface Profile {
  firstName: string;
  legalStatus: LegalStatus;
  netPayMonthly: Cents;
  microVersementLiberatoire: boolean;
  /** 0 à 30 */
  microIncomeTaxProvisionPct: number;
  microProExpensesMonthly: Cents;
  includeProspects: boolean;
}

export interface BalanceRef {
  date: ISODate;
  amount: Cents;
}

export interface EngineInput {
  today: ISODate;
  profile: Profile;
  clients: Client[];
  leaves: Leave[];
  charges: Charge[];
  /** Dernier BalanceSnapshot, ou null (solde de départ = 0) */
  balance: BalanceRef | null;
}
