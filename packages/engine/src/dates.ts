export type ISODate = string;
export type MonthKey = string;

const DAY_MS = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number): string => String(n).padStart(2, '0');

export function isISODate(value: string): boolean {
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function toEpochDay(iso: ISODate): number {
  const m = ISO_RE.exec(iso);
  if (!m) throw new Error(`Invalid ISO date: ${iso}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS;
}

export function fromEpochDay(day: number): ISODate {
  const dt = new Date(day * DAY_MS);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export const addDays = (iso: ISODate, n: number): ISODate => fromEpochDay(toEpochDay(iso) + n);

export const diffDays = (from: ISODate, to: ISODate): number => toEpochDay(to) - toEpochDay(from);

/** 0 = lundi … 6 = dimanche. Le 1970-01-01 était un jeudi. */
export function weekday(iso: ISODate): number {
  return (((toEpochDay(iso) + 3) % 7) + 7) % 7;
}

export const monthKey = (iso: ISODate): MonthKey => iso.slice(0, 7);
export const yearOf = (isoOrMonth: string): number => Number(isoOrMonth.slice(0, 4));
export const monthIndex = (isoOrMonth: string): number => Number(isoOrMonth.slice(5, 7)) - 1;

export function addMonths(month: MonthKey, n: number): MonthKey {
  const total = yearOf(month) * 12 + monthIndex(month) + n;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

export const firstDayOfMonth = (month: MonthKey): ISODate => `${month}-01`;

export function daysInMonth(month: MonthKey): number {
  return new Date(Date.UTC(yearOf(month), monthIndex(month) + 1, 0)).getUTCDate();
}

export const lastDayOfMonth = (month: MonthKey): ISODate => `${month}-${pad(daysInMonth(month))}`;

export function monthRange(first: MonthKey, count: number): MonthKey[] {
  return Array.from({ length: count }, (_, i) => addMonths(first, i));
}

export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = toEpochDay(from), end = toEpochDay(to); d <= end; d++) out.push(fromEpochDay(d));
  return out;
}

export const eachDayOfMonth = (month: MonthKey): ISODate[] => eachDay(firstDayOfMonth(month), lastDayOfMonth(month));

export const minDate = (a: ISODate, b: ISODate): ISODate => (a < b ? a : b);
export const maxDate = (a: ISODate, b: ISODate): ISODate => (a > b ? a : b);

/** Date civile locale. Utilisée par les appelants (front, API) ; le moteur ne l'appelle jamais. */
export function localToday(now: Date = new Date()): ISODate {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
