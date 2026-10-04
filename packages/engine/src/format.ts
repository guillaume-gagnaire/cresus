import { diffDays, type ISODate, type MonthKey, monthIndex, yearOf } from './dates';
import type { BillingMode, Cents } from './types';

const MINUS = '−';
const NBSP = '\u00A0';

export const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'] as const;
export const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'] as const;

const group = (n: number): string => n.toLocaleString('fr-FR');

/** Montant arrondi à la dizaine d'euros : « −2 310 € ». */
export function euros(cents: Cents, opts: { sign?: boolean } = {}): string {
  const tens = Math.round(Math.abs(cents) / 1000) * 10;
  const prefix = tens === 0 ? '' : cents < 0 ? MINUS : opts.sign ? '+' : '';
  return `${prefix}${group(tens)}${NBSP}€`;
}

/** Montant à l'euro près (tarifs, saisies) : « 1 200 € ». */
export function eurosExact(cents: Cents): string {
  const value = Math.round(Math.abs(cents) / 100);
  return `${cents < 0 && value !== 0 ? MINUS : ''}${group(value)}${NBSP}€`;
}

/** Libellé de graphique : « +5,3k ». */
export function kEuros(cents: Cents, opts: { sign?: boolean } = {}): string {
  const value = (Math.abs(cents) / 100_000).toFixed(1).replace('.', ',');
  const signed = opts.sign ?? true;
  const prefix = cents < 0 ? MINUS : signed ? '+' : '';
  return `${prefix}${value}k`;
}

export const monthName = (month: MonthKey): string => MONTHS_LONG[monthIndex(month)]!;
export const monthLabel = (month: MonthKey): string => `${monthName(month)} ${yearOf(month)}`;
export const monthShort = (month: MonthKey): string => MONTHS_SHORT[monthIndex(month)]!;
export const monthLetter = (month: MonthKey): string => monthName(month).charAt(0).toUpperCase();

const dayLabel = (iso: ISODate): string => {
  const d = Number(iso.slice(8, 10));
  return d === 1 ? '1er' : String(d);
};

export const shortDate = (iso: ISODate): string => `${dayLabel(iso)} ${MONTHS_SHORT[monthIndex(iso)]}`;
export const longDate = (iso: ISODate): string => `${dayLabel(iso)} ${MONTHS_LONG[monthIndex(iso)]} ${yearOf(iso)}`;

export function relativeDays(from: ISODate, today: ISODate): string {
  const n = diffDays(from, today);
  if (n <= 0) return 'aujourd’hui';
  if (n === 1) return 'hier';
  return `il y a ${n} jours`;
}

/** « Facture d’octobre · vers le 30 nov. » */
export function invoiceLabel(entry: { workMonth: MonthKey; cashDate: ISODate }, billingMode: BillingMode): string {
  const name = monthName(entry.workMonth);
  const of = /^[aeiouy]/.test(name) ? 'd’' : 'de ';
  return `${billingMode === 'FORFAIT' ? 'Forfait' : 'Facture'} ${of}${name} · vers le ${shortDate(entry.cashDate)}`;
}

export const plural = (n: number, singular: string, pluralForm = `${singular}s`): string => `${n} ${n > 1 ? pluralForm : singular}`;
