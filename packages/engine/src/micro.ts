import { addMonths, firstDayOfMonth, type ISODate, type MonthKey, monthKey, monthRange, yearOf } from './dates';
import { type IncomeEntry, projectIncome, sumBy } from './income';
import { paramsFor, type RegulatoryParams } from './params';
import { HORIZON_MONTHS } from './results';
import type { Cents, Client, EngineInput, Profile } from './types';

export interface MicroBreakdown {
  income: Cents;
  contributions: Cents;
  tax: Cents;
  proExpenses: Cents;
  forYou: Cents;
}

/** SPEC §4.9 */
export function microBreakdown(income: Cents, profile: Profile, params: RegulatoryParams): MicroBreakdown {
  const contributions = Math.round(income * params.microContributionRate);
  const taxRate = profile.microVersementLiberatoire ? params.microVersementLiberatoireRate : profile.microIncomeTaxProvisionPct / 100;
  const tax = Math.round(income * taxRate);
  const proExpenses = profile.microProExpensesMonthly;
  return { income, contributions, tax, proExpenses, forYou: income - contributions - tax - proExpenses };
}

export const TEST_MISSION_ID = 'test-mission';

/** Mission hypothétique : lundi, 650 €/j, dès le mois suivant, payée à 30 jours. */
export function testMissionClient(today: ISODate): Client {
  const start = firstDayOfMonth(addMonths(monthKey(today), 1));
  return {
    id: TEST_MISSION_ID, name: 'Mission test', subtitle: null, color: 'indigo', billingMode: 'TJM', weekdays: [0],
    startDate: start, endDate: null, paymentTerm: 'NET_30', averageDelayDays: 0, isProspect: false, archivedAt: null,
    rates: [{ validFrom: start, amount: 65_000 }],
  };
}

export interface MicroMonth {
  month: MonthKey;
  income: Cents;
  entries: IncomeEntry[];
  breakdown: MicroBreakdown;
}

export function microMonths(input: EngineInput, opts: { firstMonth?: MonthKey; months?: number; testMission?: boolean } = {}): MicroMonth[] {
  const firstMonth = opts.firstMonth ?? monthKey(input.today);
  const months = opts.months ?? HORIZON_MONTHS;
  const entries = projectIncome(input.clients, input.leaves, {
    firstMonth,
    months,
    includeProspects: input.profile.includeProspects,
    extraClients: opts.testMission ? [testMissionClient(input.today)] : [],
  });
  return monthRange(firstMonth, months).map((month) => {
    const monthEntries = entries.filter((e) => e.cashMonth === month);
    const income = sumBy(monthEntries, 'amount');
    return { month, income, entries: monthEntries, breakdown: microBreakdown(income, input.profile, paramsFor(yearOf(month))) };
  });
}

export type GaugeLevel = 'OK' | 'WARN' | 'OVER';

export interface CeilingGauge {
  year: number;
  actual: Cents;
  planned: Cents;
  total: Cents;
  ceiling: Cents;
  pct: number;
  level: GaugeLevel;
  overMonth: MonthKey | null;
  vatThreshold: Cents;
  vatMonth: MonthKey | null;
}

/** Jauge du plafond pour l'année civile : réel = mois passés, prévu = mois courant et suivants. */
export function ceilingGauge(input: EngineInput, year: number, opts: { testMission?: boolean } = {}): CeilingGauge {
  const params = paramsFor(year);
  const current = monthKey(input.today);
  const months = microMonths(input, { firstMonth: `${year}-01`, months: 12, testMission: opts.testMission });
  let actual = 0;
  let planned = 0;
  let cumulative = 0;
  let overMonth: MonthKey | null = null;
  let vatMonth: MonthKey | null = null;
  for (const m of months) {
    if (m.month < current) actual += m.income;
    else planned += m.income;
    cumulative += m.income;
    if (!overMonth && cumulative > params.microCeiling) overMonth = m.month;
    if (!vatMonth && cumulative > params.vatThreshold) vatMonth = m.month;
  }
  const total = actual + planned;
  const pct = Math.round((total / params.microCeiling) * 100);
  // WARN dès que le total dépasse strictement 85 % du plafond (comparaison exacte en entiers, pas sur le pourcentage arrondi).
  const level: GaugeLevel = overMonth ? 'OVER' : total * 100 > params.microCeiling * 85 ? 'WARN' : 'OK';
  return { year, actual, planned, total, ceiling: params.microCeiling, pct, level, overMonth, vatThreshold: params.vatThreshold, vatMonth };
}

/** Revenu lissé : moyenne de « pour toi » sur les 12 premiers mois ; mois sous 60 % signalés (aucun quand la moyenne n'est pas positive : 60 % d'un négatif n'a pas de sens). */
export function smoothedIncome(months: readonly MicroMonth[]): { average: Cents; lowMonths: MonthKey[] } {
  const first12 = months.slice(0, 12);
  const average = first12.length ? Math.round(first12.reduce((s, m) => s + m.breakdown.forYou, 0) / first12.length) : 0;
  return { average, lowMonths: average > 0 ? months.filter((m) => m.breakdown.forYou < average * 0.6).map((m) => m.month) : [] };
}
