import { addDays, type ISODate } from './dates';
import type { Cents, Client, Rate } from './types';

export function sortRates(rates: readonly Rate[]): Rate[] {
  return [...rates].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
}

/** Montant du tarif dont validFrom est le plus grand ≤ date, sinon 0 (SPEC §4.2). */
export function rateAt(client: Pick<Client, 'rates'>, date: ISODate): Cents {
  let amount = 0;
  for (const r of sortRates(client.rates)) {
    if (r.validFrom > date) break;
    amount = r.amount;
  }
  return amount;
}

/** Tarif en vigueur aujourd'hui ; à défaut (tous futurs), le premier tarif. Sert à l'affichage « TJM actuel ». */
export function currentRate(client: Pick<Client, 'rates'>, today: ISODate): Rate | null {
  const sorted = sortRates(client.rates);
  let current: Rate | null = null;
  for (const r of sorted) if (r.validFrom <= today) current = r;
  return current ?? sorted[0] ?? null;
}

/** Prochain tarif futur, différent du tarif affiché comme actuel. */
export function nextRate(client: Pick<Client, 'rates'>, today: ISODate): Rate | null {
  const current = currentRate(client, today);
  return sortRates(client.rates).find((r) => r.validFrom > today && r !== current) ?? null;
}

export type RateStatus = 'PAST' | 'CURRENT' | 'FUTURE';

export interface RateRow {
  rate: Rate;
  status: RateStatus;
  /** Dernier jour d'application (veille du tarif suivant), null pour le dernier tarif */
  validTo: ISODate | null;
}

export function rateHistory(rates: readonly Rate[], today: ISODate): RateRow[] {
  const sorted = sortRates(rates);
  let currentIdx = -1;
  sorted.forEach((r, i) => {
    if (r.validFrom <= today) currentIdx = i;
  });
  return sorted.map((rate, i) => {
    const next = sorted[i + 1];
    return {
      rate,
      status: i === currentIdx ? 'CURRENT' : rate.validFrom > today ? 'FUTURE' : 'PAST',
      validTo: next ? addDays(next.validFrom, -1) : null,
    };
  });
}
