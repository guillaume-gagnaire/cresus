import { daysInMonth, eachDayOfMonth, type ISODate, type MonthKey, weekday } from './dates';
import { isHoliday } from './holidays';
import { rateAt } from './rates';
import type { Cents, Client, Leave } from './types';

export type LeaveIndex = ReadonlyMap<ISODate, readonly Leave[]>;

export function indexLeaves(leaves: readonly Leave[]): LeaveIndex {
  const map = new Map<ISODate, Leave[]>();
  for (const leave of leaves) {
    const list = map.get(leave.date);
    if (list) list.push(leave);
    else map.set(leave.date, [leave]);
  }
  return map;
}

export function isActiveOn(client: Pick<Client, 'startDate' | 'endDate'>, date: ISODate): boolean {
  return client.startDate <= date && (client.endDate === null || date <= client.endDate);
}

export function isOnLeave(index: LeaveIndex | null, date: ISODate, clientId: string): boolean {
  if (!index) return false;
  return (index.get(date) ?? []).some((l) => l.scope === 'ALL' || l.clientId === clientId);
}

/** Le client TJM aurait été facturé ce jour-là, hors congés (conditions 1 à 3 de SPEC §4.1). */
export function worksOn(client: Client, date: ISODate): boolean {
  return (
    client.billingMode === 'TJM' &&
    isActiveOn(client, date) &&
    client.weekdays.includes(weekday(date)) &&
    !isHoliday(date)
  );
}

export function billableDays(client: Client, month: MonthKey, leaves: LeaveIndex | null): ISODate[] {
  if (client.billingMode !== 'TJM') return [];
  return eachDayOfMonth(month).filter((d) => worksOn(client, d) && !isOnLeave(leaves, d, client.id));
}

/** Montant facturé pour le mois (SPEC §4.1 et §4.3), arrondi au centime. `leaves = null` → sans congés. */
export function monthlyAmount(client: Client, month: MonthKey, leaves: LeaveIndex | null): Cents {
  if (client.billingMode === 'FORFAIT') {
    const n = daysInMonth(month);
    let total = 0;
    for (const d of eachDayOfMonth(month)) if (isActiveOn(client, d)) total += rateAt(client, d) / n;
    return Math.round(total);
  }
  return billableDays(client, month, leaves).reduce((sum, d) => sum + rateAt(client, d), 0);
}
