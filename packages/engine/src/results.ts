import { chargesForMonth, type ChargeItem } from './charges';
import { type MonthKey, monthKey, monthRange } from './dates';
import { type IncomeEntry, projectIncome, sumBy } from './income';
import type { Cents, Client, EngineInput } from './types';

export const HORIZON_MONTHS = 15;

export type MonthState = 'POSITIVE' | 'RED' | 'RED_DUE_TO_LEAVES' | 'OVERDRAFT';

export interface MonthResult {
  month: MonthKey;
  income: Cents;
  incomeWithoutLeaves: Cents;
  leaveCost: Cents;
  charges: Cents;
  chargeItems: ChargeItem[];
  entries: IncomeEntry[];
  result: Cents;
  resultWithoutLeaves: Cents;
  balance: Cents;
  balanceWithoutLeaves: Cents;
  state: MonthState;
}

export interface ResultsOptions {
  includeProspects?: boolean;
  months?: number;
  extraClients?: readonly Client[];
}

/** SPEC §4.7 */
export function monthState(r: Pick<MonthResult, 'result' | 'resultWithoutLeaves' | 'balance'>): MonthState {
  if (r.balance < 0) return 'OVERDRAFT';
  if (r.result < 0) return r.resultWithoutLeaves >= 0 ? 'RED_DUE_TO_LEAVES' : 'RED';
  return 'POSITIVE';
}

/** Projection sur 15 mois à partir du mois de `today`. Le solde initial s'applique au début du mois courant. */
export function monthResults(input: EngineInput, opts: ResultsOptions = {}): MonthResult[] {
  const months = opts.months ?? HORIZON_MONTHS;
  const firstMonth = monthKey(input.today);
  const entries = projectIncome(input.clients, input.leaves, {
    firstMonth,
    months,
    includeProspects: opts.includeProspects ?? input.profile.includeProspects,
    extraClients: opts.extraClients,
  });
  let balance = input.balance?.amount ?? 0;
  let balanceWithoutLeaves = balance;
  return monthRange(firstMonth, months).map((month) => {
    const monthEntries = entries.filter((e) => e.cashMonth === month);
    const income = sumBy(monthEntries, 'amount');
    const incomeWithoutLeaves = sumBy(monthEntries, 'amountWithoutLeaves');
    const chargeItems = chargesForMonth(input.charges, input.profile, month);
    const charges = sumBy(chargeItems, 'amount');
    const result = income - charges;
    const resultWithoutLeaves = incomeWithoutLeaves - charges;
    balance += result;
    balanceWithoutLeaves += resultWithoutLeaves;
    const partial = { result, resultWithoutLeaves, balance };
    return {
      month, income, incomeWithoutLeaves, leaveCost: incomeWithoutLeaves - income,
      charges, chargeItems, entries: monthEntries, result, resultWithoutLeaves,
      balance, balanceWithoutLeaves, state: monthState(partial),
    };
  });
}

export interface ResultsSummary {
  redCount: number;
  overdraftCount: number;
  redDueToLeavesCount: number;
  lowestBalance: Cents;
  lowestBalanceMonth: MonthKey | null;
  text: string;
}

export function resultsSummary(results: readonly MonthResult[]): ResultsSummary {
  const redCount = results.filter((r) => r.result < 0).length;
  const overdraftCount = results.filter((r) => r.balance < 0).length;
  const redDueToLeavesCount = results.filter((r) => r.state === 'RED_DUE_TO_LEAVES').length;
  let lowest: MonthResult | null = null;
  for (const r of results) if (!lowest || r.balance < lowest.balance) lowest = r;
  const text =
    overdraftCount > 0
      ? `${overdraftCount} mois à découvert`
      : redCount === 0
        ? 'Aucun mois dans le rouge'
        : `${redCount} mois dans le rouge, jamais à découvert`;
  return { redCount, overdraftCount, redDueToLeavesCount, lowestBalance: lowest?.balance ?? 0, lowestBalanceMonth: lowest?.month ?? null, text };
}
