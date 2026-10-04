import { describe, expect, it } from 'vitest';
import { currentRate, nextRate, rateAt, rateHistory, sortRates } from '../src/rates';
import { makeClient } from './helpers';

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
