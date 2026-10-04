import { describe, expect, it } from 'vitest';
import { billableDays, indexLeaves, isActiveOn, isOnLeave, monthlyAmount, worksOn } from '../src/billing';
import { makeClient } from './helpers';

// Novembre 2026 : 21 jours de semaine, dont le mercredi 11 novembre (férié) → 20 jours ouvrés
const fullWeek = makeClient();

describe('billableDays (TJM)', () => {
  it('skips weekends and public holidays', () => {
    const days = billableDays(fullWeek, '2026-11', null);
    expect(days).toHaveLength(20);
    expect(days).not.toContain('2026-11-11');
    expect(days).not.toContain('2026-11-07');
  });

  it('skips ALL leaves and CLIENT leaves of this client only', () => {
    expect(billableDays(fullWeek, '2026-11', indexLeaves([{ date: '2026-11-12', scope: 'ALL', clientId: null }]))).toHaveLength(19);
    expect(billableDays(fullWeek, '2026-11', indexLeaves([{ date: '2026-11-12', scope: 'CLIENT', clientId: 'other' }]))).toHaveLength(20);
    expect(billableDays(fullWeek, '2026-11', indexLeaves([{ date: '2026-11-12', scope: 'CLIENT', clientId: 'c1' }]))).toHaveLength(19);
  });

  it('respects presence weekdays and a mission starting on a wednesday', () => {
    const monFri = makeClient({ weekdays: [0, 4], startDate: '2026-11-04' });
    expect(billableDays(monFri, '2026-11', null)).toEqual([
      '2026-11-06', '2026-11-09', '2026-11-13', '2026-11-16', '2026-11-20', '2026-11-23', '2026-11-27', '2026-11-30',
    ]);
  });

  it('stops at the end date', () => {
    const ending = makeClient({ endDate: '2026-11-13' });
    expect(billableDays(ending, '2026-11', null)).toHaveLength(9);
  });

  it('returns nothing for a forfait client or a TJM client without weekdays', () => {
    expect(billableDays(makeClient({ billingMode: 'FORFAIT', weekdays: [] }), '2026-11', null)).toEqual([]);
    expect(billableDays(makeClient({ weekdays: [] }), '2026-11', null)).toEqual([]);
    expect(monthlyAmount(makeClient({ weekdays: [] }), '2026-11', null)).toBe(0);
  });

  it('exposes activity and presence helpers', () => {
    expect(isActiveOn(makeClient({ startDate: '2026-11-04', endDate: '2026-11-30' }), '2026-11-03')).toBe(false);
    expect(isActiveOn(makeClient({ startDate: '2026-11-04', endDate: '2026-11-30' }), '2026-11-30')).toBe(true);
    expect(worksOn(fullWeek, '2026-11-11')).toBe(false);
    expect(worksOn(fullWeek, '2026-11-12')).toBe(true);
    expect(worksOn(makeClient({ billingMode: 'FORFAIT' }), '2026-11-12')).toBe(false);
  });

  it('handles isOnLeave correctly', () => {
    expect(isOnLeave(null, '2026-11-12', 'c1')).toBe(false);
    const leaves = indexLeaves([
      { date: '2026-11-12', scope: 'ALL', clientId: null },
      { date: '2026-11-13', scope: 'CLIENT', clientId: 'c1' },
      { date: '2026-11-14', scope: 'CLIENT', clientId: 'other' },
    ]);
    expect(isOnLeave(leaves, '2026-11-12', 'c1')).toBe(true);
    expect(isOnLeave(leaves, '2026-11-13', 'c1')).toBe(true);
    expect(isOnLeave(leaves, '2026-11-14', 'c1')).toBe(false);
    expect(isOnLeave(leaves, '2026-11-15', 'c1')).toBe(false);
  });
});

describe('monthlyAmount (TJM)', () => {
  it('prorates a mid-month rate change to the day', () => {
    const c = makeClient({ rates: [{ validFrom: '2026-01-01', amount: 60_000 }, { validFrom: '2026-11-16', amount: 70_000 }] });
    // 9 jours à 600 € avant le 16, 11 jours à 700 € ensuite
    expect(monthlyAmount(c, '2026-11', null)).toBe(9 * 60_000 + 11 * 70_000);
  });

  it('bills 0 before a first rate that starts after the mission', () => {
    const c = makeClient({ startDate: '2026-11-02', rates: [{ validFrom: '2026-11-16', amount: 70_000 }] });
    expect(monthlyAmount(c, '2026-11', null)).toBe(11 * 70_000);
  });

  it('bills 0 when every rate is in the future', () => {
    const c = makeClient({ rates: [{ validFrom: '2027-07-01', amount: 70_000 }] });
    expect(monthlyAmount(c, '2026-11', null)).toBe(0);
  });

  it('deducts leaves', () => {
    const leaves = indexLeaves([{ date: '2026-11-12', scope: 'ALL', clientId: null }]);
    expect(monthlyAmount(fullWeek, '2026-11', leaves)).toBe(19 * 60_000);
  });
});

describe('monthlyAmount (forfait)', () => {
  const forfait = makeClient({ billingMode: 'FORFAIT', weekdays: [], startDate: '2026-11-15', endDate: '2027-01-10', rates: [{ validFrom: '2026-11-01', amount: 120_000 }] });

  it('prorates the first month (start on the 15th ≈ half)', () => {
    const amount = monthlyAmount(forfait, '2026-11', null);
    expect(amount).toBe(64_000); // 16 jours / 30
    expect(amount / 120_000).toBeGreaterThan(0.5);
    expect(amount / 120_000).toBeLessThan(0.55);
  });

  it('prorates the last month', () => {
    expect(monthlyAmount(forfait, '2027-01', null)).toBe(Math.round((120_000 * 10) / 31));
  });

  it('bills the full amount on full months, ignoring holidays and leaves', () => {
    const leaves = indexLeaves([
      { date: '2026-12-24', scope: 'ALL', clientId: null },
      { date: '2026-12-28', scope: 'CLIENT', clientId: 'c1' },
    ]);
    expect(monthlyAmount(forfait, '2026-12', null)).toBe(120_000);
    expect(monthlyAmount(forfait, '2026-12', leaves)).toBe(120_000);
  });
});
