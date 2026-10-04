import { describe, expect, it } from 'vitest';
import { calendarMonth, leaveKpis, matchesTarget } from '../src/calendar';
import { monthResults } from '../src/results';
import { demoInput } from '../src/seed';

describe('calendarMonth', () => {
  const days = calendarMonth(demoInput(), '2026-12', { scope: 'ALL' });
  const day = (date: string) => days.find((x) => x.date === date)!;

  it('builds full monday-to-sunday weeks', () => {
    expect(days).toHaveLength(35);
    expect(days[0]!.date).toBe('2026-11-30');
    expect(days[0]!.inMonth).toBe(false);
    expect(days[34]!.date).toBe('2027-01-03');
  });

  it('describes each cell', () => {
    expect(day('2026-12-25')).toMatchObject({ holidayName: 'Noël', clickable: false });
    expect(day('2026-12-26')).toMatchObject({ weekend: true, clickable: false });
    expect(day('2026-12-28').clientIds).toEqual(['client-a']);
    expect(day('2026-12-24').targetLeave).not.toBeNull();
    expect(day('2026-12-23')).toMatchObject({ clientIds: ['client-b'], targetLeave: null, clickable: true });
    expect(day('2026-11-30').clickable).toBe(false);
  });

  it('targets CLIENT leaves for a client filter', () => {
    const forA = calendarMonth(demoInput(), '2027-05', { scope: 'CLIENT', clientId: 'client-a' });
    expect(forA.find((x) => x.date === '2027-05-07')!.targetLeave).not.toBeNull();
    expect(matchesTarget({ date: '2027-05-07', scope: 'ALL', clientId: null }, { scope: 'CLIENT', clientId: 'client-a' })).toBe(false);
  });
});

describe('leaveKpis', () => {
  it('summarises leaves over the horizon', () => {
    const input = demoInput();
    expect(leaveKpis(input, monthResults(input))).toEqual({
      dayCount: 21,
      lostIncome: 915_000,
      lowestBalance: 4_600_600,
      lowestBalanceMonth: '2026-10',
      riskCount: 6,
      overdraftCount: 0,
      dueToLeavesCount: 2,
    });
  });

  it('handles an empty horizon', () => {
    expect(leaveKpis(demoInput(), []).dayCount).toBe(0);
  });

  it('finds lowest balance in a later month', () => {
    const input = demoInput();
    const base = monthResults(input);
    const tweaked = base.map((r, i) => (i === 5 ? { ...r, balance: -100 } : r));
    const k = leaveKpis(input, tweaked);
    expect(k.lowestBalance).toBe(-100);
    expect(k.lowestBalanceMonth).toBe(base[5]!.month);
    expect(k.overdraftCount).toBe(1);
  });
});
