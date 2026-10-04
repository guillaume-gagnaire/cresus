import { type MonthKey, monthIndex, monthRange, yearOf } from './dates';
import { paramsFor, type RegulatoryParams } from './params';
import { remunerationCost } from './remuneration';
import type { Cents, Charge, ChargeFrequency, Profile } from './types';

export interface ChargeItem {
  id: string;
  name: string;
  amount: Cents;
  frequency: ChargeFrequency;
  month: number | null;
  category: string | null;
  /** true pour les deux lignes de rémunération calculées (lecture seule) */
  computed: boolean;
}

export const COMPUTED_NET_ID = 'computed:net';
export const COMPUTED_CONTRIBUTIONS_ID = 'computed:contributions';

export function remunerationLines(profile: Profile, params: RegulatoryParams): ChargeItem[] {
  if (profile.legalStatus === 'MICRO' || profile.netPayMonthly <= 0) return [];
  const cost = remunerationCost(profile.netPayMonthly, profile.legalStatus, params);
  return [
    { id: COMPUTED_NET_ID, name: 'Salaire (net)', amount: cost.net, frequency: 'MONTHLY', month: null, category: 'Toi', computed: true },
    { id: COMPUTED_CONTRIBUTIONS_ID, name: 'Cotisations sociales', amount: cost.contributions, frequency: 'MONTHLY', month: null, category: 'Social', computed: true },
  ];
}

/** SPEC §4.5 : charges du mois, triées par montant décroissant. */
export function chargesForMonth(charges: readonly Charge[], profile: Profile, month: MonthKey): ChargeItem[] {
  const m = monthIndex(month);
  const stored: ChargeItem[] = charges
    .filter((c) => c.frequency === 'MONTHLY' || c.month === m)
    .map((c) => ({ ...c, computed: false }));
  return [...remunerationLines(profile, paramsFor(yearOf(month))), ...stored].sort((a, b) => b.amount - a.amount);
}

export const monthlyEquivalent = (charge: Pick<Charge, 'amount' | 'frequency'>): Cents =>
  charge.frequency === 'MONTHLY' ? charge.amount : Math.round(charge.amount / 12);

export function chargesSummary(charges: readonly Charge[], profile: Profile, year: number): { monthlyAverage: Cents; annualTotal: Cents } {
  const annualTotal = monthRange(`${year}-01`, 12).reduce(
    (sum, month) => sum + chargesForMonth(charges, profile, month).reduce((s, c) => s + c.amount, 0),
    0,
  );
  return { annualTotal, monthlyAverage: Math.round(annualTotal / 12) };
}
