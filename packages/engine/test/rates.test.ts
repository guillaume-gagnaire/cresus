import { describe, expect, it } from 'vitest';
import { monthResults } from '../src/results';
import { currentRate, nextRate, rateAt, rateHistory, sortRates } from '../src/rates';
import { makeClient, makeInput } from './helpers';

const client = makeClient({
  rates: [
    { validFrom: '2027-01-01', amount: 70_000 },
    { validFrom: '2026-01-01', amount: 60_000 },
  ],
});

describe('rates', () => {
  it('sorts by validFrom', () => {
    expect(sortRates(client.rates).map((r) => r.amount)).toEqual([60_000, 70_000]);
  });

  it('returns the rate in force on a day, 0 before the first rate', () => {
    expect(rateAt(client, '2025-12-31')).toBe(0);
    expect(rateAt(client, '2026-10-04')).toBe(60_000);
    expect(rateAt(client, '2026-12-31')).toBe(60_000);
    expect(rateAt(client, '2027-01-01')).toBe(70_000);
  });

  it('finds current and next rate', () => {
    expect(currentRate(client, '2026-10-04')?.amount).toBe(60_000);
    expect(nextRate(client, '2026-10-04')?.amount).toBe(70_000);
    expect(nextRate(client, '2027-02-01')).toBeNull();
  });

  it('falls back to the earliest rate when all rates are in the future', () => {
    const prospect = makeClient({ rates: [{ validFrom: '2027-07-01', amount: 70_000 }, { validFrom: '2027-10-01', amount: 75_000 }] });
    expect(currentRate(prospect, '2026-10-04')?.amount).toBe(70_000);
    expect(nextRate(prospect, '2026-10-04')?.amount).toBe(75_000);
    expect(currentRate(makeClient({ rates: [] }), '2026-10-04')).toBeNull();
  });

  it('labels history rows Ancien / Actuel / À venir with end dates', () => {
    const rows = rateHistory(
      [
        { validFrom: '2026-03-02', amount: 55_000 },
        { validFrom: '2026-09-01', amount: 60_000 },
        { validFrom: '2027-01-01', amount: 65_000 },
      ],
      '2026-10-04',
    );
    expect(rows.map((r) => r.status)).toEqual(['PAST', 'CURRENT', 'FUTURE']);
    expect(rows.map((r) => r.validTo)).toEqual(['2026-08-31', '2026-12-31', null]);
  });

  it('marks no row current when every rate is future', () => {
    const rows = rateHistory([{ validFrom: '2027-07-01', amount: 70_000 }], '2026-10-04');
    expect(rows[0]?.status).toBe('FUTURE');
  });
});

describe('rateAt performance and memoisation', () => {
  const manyRates = (n: number) => Array.from({ length: n }, (_, i) => ({ validFrom: `${2000 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-01`, amount: 50_000 + i }));

  it('resolves rates by binary search on a lazily sorted copy (same results as a linear scan, unsorted input)', () => {
    const rates = manyRates(200).reverse();
    const c = makeClient({ rates });
    expect(rateAt(c, '1999-12-31')).toBe(0);
    expect(rateAt(c, '2000-01-01')).toBe(50_000);
    expect(rateAt(c, '2000-01-31')).toBe(50_000);
    expect(rateAt(c, '2000-02-01')).toBe(50_001);
    expect(rateAt(c, '2100-01-01')).toBe(50_199);
    // le tableau d'entrée n'est jamais réordonné
    expect(rates[0]!.amount).toBe(50_199);
  });

  it('keeps the last-declared amount when two rates share the same validFrom', () => {
    const c = makeClient({ rates: [{ validFrom: '2026-01-01', amount: 1 }, { validFrom: '2026-01-01', amount: 2 }] });
    expect(rateAt(c, '2026-06-01')).toBe(2);
  });

  it('sees a rate array that grew in place', () => {
    const rates = [{ validFrom: '2026-01-01', amount: 60_000 }];
    const c = makeClient({ rates });
    expect(rateAt(c, '2026-10-01')).toBe(60_000);
    rates.push({ validFrom: '2026-09-01', amount: 70_000 });
    expect(rateAt(c, '2026-10-01')).toBe(70_000);
  });

  it('does not re-sort on every call: 100 clients x 500 rates x 15 months stays well under a second', () => {
    const clients = Array.from({ length: 100 }, (_, i) => makeClient({ id: `c${i}`, rates: manyRates(500).reverse() }));
    const input = makeInput({ clients });
    const t0 = Date.now();
    const results = monthResults(input);
    const elapsed = Date.now() - t0;
    expect(results).toHaveLength(15);
    expect(elapsed).toBeLessThan(1_000);
  });
});
