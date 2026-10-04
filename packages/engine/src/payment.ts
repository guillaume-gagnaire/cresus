import { addDays, diffDays, type ISODate, lastDayOfMonth, type MonthKey, monthKey } from './dates';
import type { Client, PaymentTerm } from './types';

export const PAYMENT_TERMS: Readonly<Record<PaymentTerm, { label: string; days: number; endOfMonth: boolean }>> = {
  RECEPTION: { label: 'À réception', days: 0, endOfMonth: false },
  NET_30: { label: '30 jours', days: 30, endOfMonth: false },
  NET_45: { label: '45 jours', days: 45, endOfMonth: false },
  EOM_30: { label: '30 j fin de mois', days: 30, endOfMonth: true },
  NET_60: { label: '60 jours', days: 60, endOfMonth: false },
};

export interface PaymentPath {
  workMonth: MonthKey;
  invoiceDate: ISODate;
  dueDate: ISODate;
  cashDate: ISODate;
  cashMonth: MonthKey;
  /** Jours entre la facture et l'encaissement */
  waitDays: number;
}

/** SPEC §4.4 : facture le dernier jour du mois, échéance selon le délai, encaissement = échéance + retard moyen. */
export function paymentPath(client: Pick<Client, 'paymentTerm' | 'averageDelayDays'>, workMonth: MonthKey): PaymentPath {
  const term = PAYMENT_TERMS[client.paymentTerm];
  const invoiceDate = lastDayOfMonth(workMonth);
  const raw = addDays(invoiceDate, term.days);
  const dueDate = term.endOfMonth ? lastDayOfMonth(monthKey(raw)) : raw;
  const cashDate = addDays(dueDate, client.averageDelayDays);
  return { workMonth, invoiceDate, dueDate, cashDate, cashMonth: monthKey(cashDate), waitDays: diffDays(invoiceDate, cashDate) };
}
