import { describe, expect, it } from 'vitest';
import { chargesForMonth, chargesSummary, monthlyEquivalent } from '../src/charges';
import type { Charge } from '../src/types';
import { makeProfile } from './helpers';

const charges: Charge[] = [
  { id: 'k1', name: 'Logiciels', amount: 9_500, frequency: 'MONTHLY', month: null, category: 'Outils' },
  { id: 'k2', name: 'Assurance RC Pro', amount: 66_000, frequency: 'YEARLY', month: 0, category: 'Assurance' },
  { id: 'k3', name: 'CFE', amount: 60_000, frequency: 'YEARLY', month: 11, category: 'Impôts' },
];

describe('chargesForMonth', () => {
  it('counts monthly charges every month and yearly ones in their month only', () => {
    expect(chargesForMonth(charges, makeProfile(), '2026-11').map((c) => c.id)).toEqual(['k1']);
    expect(chargesForMonth(charges, makeProfile(), '2027-01').map((c) => c.id)).toEqual(['k2', 'k1']);
  });

  it('adds the two computed remuneration lines in company mode, sorted by amount', () => {
    const items = chargesForMonth(charges, makeProfile({ legalStatus: 'SASU', netPayMonthly: 400_000 }), '2026-11');
    expect(items.map((c) => [c.name, c.amount, c.computed])).toEqual([
      ['Salaire (net)', 400_000, true],
      ['Cotisations sociales', 320_000, true],
      ['Logiciels', 9_500, false],
    ]);
  });

  it('follows the legal status: EURL à l’IS lowers the total from 7 200 € to 5 800 €', () => {
    const total = (status: 'SASU' | 'EURL_IS') =>
      chargesForMonth([], makeProfile({ legalStatus: status, netPayMonthly: 400_000 }), '2026-11').reduce((s, c) => s + c.amount, 0);
    expect(total('SASU')).toBe(720_000);
    expect(total('EURL_IS')).toBe(580_000);
  });

  it('adds no computed lines in micro mode or with a zero net', () => {
    expect(chargesForMonth([], makeProfile({ legalStatus: 'MICRO', netPayMonthly: 400_000 }), '2026-11')).toEqual([]);
    expect(chargesForMonth([], makeProfile({ legalStatus: 'SASU', netPayMonthly: 0 }), '2026-11')).toEqual([]);
  });
});

describe('summary', () => {
  it('spreads yearly charges', () => {
    expect(monthlyEquivalent(charges[0]!)).toBe(9_500);
    expect(monthlyEquivalent(charges[1]!)).toBe(5_500);
    const s = chargesSummary(charges, makeProfile({ netPayMonthly: 400_000 }), 2027);
    expect(s.annualTotal).toBe(12 * 9_500 + 66_000 + 60_000 + 12 * 720_000);
    expect(s.monthlyAverage).toBe(Math.round(s.annualTotal / 12));
  });
});
