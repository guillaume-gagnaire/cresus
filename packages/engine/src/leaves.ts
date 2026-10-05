import { worksOn } from './billing';
import { addDays, eachDay, type ISODate, type MonthKey, monthKey } from './dates';
import { isWorkingDay } from './holidays';
import { countedClients } from './income';
import { paymentPath } from './payment';
import { rateAt } from './rates';
import type { Cents, Client, EngineInput, Leave, LeaveScope } from './types';

export const workingDaysBetween = (from: ISODate, to: ISODate): ISODate[] => eachDay(from, to).filter(isWorkingDay);

export interface LeaveDayImpact {
  clientId: string;
  date: ISODate;
  cost: Cents;
  cashMonth: MonthKey;
}

/** SPEC §4.6 : coût d'un jour de congé et mois d'impact, pour des clients déjà filtrés (pistes, archivés). */
export function leaveImpact(leave: Leave, clients: readonly Client[]): LeaveDayImpact[] {
  return clients
    .filter((c) => worksOn(c, leave.date) && (leave.scope === 'ALL' || c.id === leave.clientId))
    .map((c) => ({ clientId: c.id, date: leave.date, cost: rateAt(c, leave.date), cashMonth: paymentPath(c, monthKey(leave.date)).cashMonth }));
}

export function leavesCost(leaves: readonly Leave[], clients: readonly Client[], includeProspects: boolean): Cents {
  const counted = countedClients(clients, includeProspects);
  return leaves.reduce((sum, l) => sum + leaveImpact(l, counted).reduce((s, i) => s + i.cost, 0), 0);
}

export interface LeavePeriod {
  key: string;
  from: ISODate;
  to: ISODate;
  dates: ISODate[];
  leaveIds: string[];
  scope: LeaveScope;
  clientId: string | null;
  dayCount: number;
  cost: Cents;
  impacts: Array<{ cashMonth: MonthKey; amount: Cents }>;
}

function hasWorkingDayBetween(a: ISODate, b: ISODate): boolean {
  for (let d = addDays(a, 1); d < b; d = addDays(d, 1)) if (isWorkingDay(d)) return true;
  return false;
}

export function groupLeaves(input: Pick<EngineInput, 'clients' | 'leaves' | 'profile'>, opts: { includeProspects?: boolean } = {}): LeavePeriod[] {
  const counted = countedClients(input.clients, opts.includeProspects ?? input.profile.includeProspects);
  const allDates = new Set(input.leaves.filter((l) => l.scope === 'ALL').map((l) => l.date));
  const byKey = new Map<string, Leave[]>();
  for (const leave of input.leaves) {
    const key = leave.scope === 'ALL' ? 'ALL' : `CLIENT:${leave.clientId}`;
    const list = byKey.get(key);
    if (list) list.push(leave);
    else byKey.set(key, [leave]);
  }

  const build = (key: string, list: Leave[]): LeavePeriod => {
    const first = list[0]!;
    const impacts = new Map<MonthKey, Cents>();
    let cost = 0;
    for (const leave of list) {
      if (leave.scope === 'CLIENT' && allDates.has(leave.date)) continue;
      for (const imp of leaveImpact(leave, counted)) {
        cost += imp.cost;
        impacts.set(imp.cashMonth, (impacts.get(imp.cashMonth) ?? 0) + imp.cost);
      }
    }
    return {
      key: `${key}:${first.date}`,
      from: first.date,
      to: list[list.length - 1]!.date,
      dates: list.map((l) => l.date),
      leaveIds: list.flatMap((l) => (l.id ? [l.id] : [])),
      scope: first.scope,
      clientId: first.clientId,
      dayCount: list.length,
      cost,
      impacts: [...impacts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([cashMonth, amount]) => ({ cashMonth, amount })),
    };
  };

  const periods: LeavePeriod[] = [];
  for (const [key, list] of byKey) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    let current: Leave[] = [];
    for (const leave of sorted) {
      const prev = current[current.length - 1];
      if (prev && prev.date === leave.date) continue;
      if (prev && hasWorkingDayBetween(prev.date, leave.date)) {
        periods.push(build(key, current));
        current = [];
      }
      current.push(leave);
    }
    if (current.length) periods.push(build(key, current));
  }
  return periods.sort((a, b) => a.from.localeCompare(b.from) || a.key.localeCompare(b.key));
}
