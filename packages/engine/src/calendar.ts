import { indexLeaves, worksOn } from './billing';
import { addDays, eachDay, firstDayOfMonth, type ISODate, lastDayOfMonth, type MonthKey, monthKey, weekday } from './dates';
import { holidayName, isWorkingDay } from './holidays';
import { countedClients } from './income';
import type { MonthResult } from './results';
import type { Cents, EngineInput, Leave } from './types';

export type LeaveTarget = { scope: 'ALL' } | { scope: 'CLIENT'; clientId: string };

export const matchesTarget = (leave: Leave, target: LeaveTarget): boolean =>
  target.scope === 'ALL' ? leave.scope === 'ALL' : leave.scope === 'CLIENT' && leave.clientId === target.clientId;

export interface CalendarDay {
  date: ISODate;
  inMonth: boolean;
  weekend: boolean;
  holidayName: string | null;
  /** Clients TJM comptés qui travailleraient ce jour-là */
  clientIds: string[];
  /** Tous les congés posés ce jour-là */
  leaves: Leave[];
  /** Congé correspondant au sélecteur « Poser chez » (à retirer au clic), sinon null */
  targetLeave: Leave | null;
  clickable: boolean;
}

export function calendarMonth(input: EngineInput, month: MonthKey, target: LeaveTarget, opts: { includeProspects?: boolean } = {}): CalendarDay[] {
  const counted = countedClients(input.clients, opts.includeProspects ?? input.profile.includeProspects);
  const index = indexLeaves(input.leaves);
  const first = firstDayOfMonth(month);
  const last = lastDayOfMonth(month);
  const gridStart = addDays(first, -weekday(first));
  const gridEnd = addDays(last, 6 - weekday(last));
  return eachDay(gridStart, gridEnd).map((date) => {
    const leaves = [...(index.get(date) ?? [])];
    const inMonth = monthKey(date) === month;
    return {
      date,
      inMonth,
      weekend: weekday(date) >= 5,
      holidayName: holidayName(date),
      clientIds: counted.filter((c) => worksOn(c, date)).map((c) => c.id),
      leaves,
      targetLeave: leaves.find((l) => matchesTarget(l, target)) ?? null,
      clickable: inMonth && isWorkingDay(date),
    };
  });
}

export interface LeaveKpis {
  dayCount: number;
  lostIncome: Cents;
  lowestBalance: Cents;
  lowestBalanceMonth: MonthKey | null;
  riskCount: number;
  overdraftCount: number;
  dueToLeavesCount: number;
}

export function leaveKpis(input: EngineInput, results: readonly MonthResult[]): LeaveKpis {
  if (results.length === 0) {
    return { dayCount: 0, lostIncome: 0, lowestBalance: 0, lowestBalanceMonth: null, riskCount: 0, overdraftCount: 0, dueToLeavesCount: 0 };
  }
  const from = firstDayOfMonth(results[0]!.month);
  const to = lastDayOfMonth(results[results.length - 1]!.month);
  let lowest = results[0]!;
  for (const r of results) if (r.balance < lowest.balance) lowest = r;
  return {
    dayCount: new Set(input.leaves.filter((l) => l.date >= from && l.date <= to).map((l) => l.date)).size,
    lostIncome: results.reduce((s, r) => s + r.leaveCost, 0),
    lowestBalance: lowest.balance,
    lowestBalanceMonth: lowest.month,
    riskCount: results.filter((r) => r.result < 0 || r.balance < 0).length,
    overdraftCount: results.filter((r) => r.balance < 0).length,
    dueToLeavesCount: results.filter((r) => r.state === 'RED_DUE_TO_LEAVES').length,
  };
}
