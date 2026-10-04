import { describe, expect, it } from 'vitest';
import { monthResults, monthState, resultsSummary } from '../src/results';
import { DEMO_TODAY, demoData, demoExportFile, demoInput } from '../src/seed';
import { makeInput } from './helpers';

// Valeurs de référence calculées avec la logique de démo des maquettes (Main.dc.html), en centimes
const REF = {
  months: ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06', '2027-07', '2027-08', '2027-09', '2027-10', '2027-11', '2027-12'],
  income: [660000, 1425000, 1485000, 1170000, 660000, 2080000, 1400000, 1605000, 1405000, 795000, 975000, 855000, 375000, 975000, 855000],
  incomeWithoutLeaves: [660000, 1425000, 1485000, 1235000, 900000, 2080000, 1400000, 1605000, 1475000, 795000, 975000, 855000, 915000, 975000, 855000],
  charges: [891400, 891400, 951400, 957400, 891400, 891400, 891400, 891400, 891400, 891400, 891400, 891400, 891400, 891400, 951400],
  balance: [4600600, 5134200, 5667800, 5880400, 5649000, 6837600, 7346200, 8059800, 8573400, 8477000, 8560600, 8524200, 8007800, 8091400, 7995000],
  states: ['RED', 'POSITIVE', 'POSITIVE', 'POSITIVE', 'RED_DUE_TO_LEAVES', 'POSITIVE', 'POSITIVE', 'POSITIVE', 'POSITIVE', 'RED', 'POSITIVE', 'RED', 'RED_DUE_TO_LEAVES', 'POSITIVE', 'RED'],
};

describe('monthResults with the demo seed', () => {
  const results = monthResults(demoInput());

  it('shows October 2026 in the red at −2 314 € with 46 006 € left (acceptance criterion)', () => {
    expect(results[0]).toMatchObject({ month: '2026-10', result: -231_400, balance: 4_600_600, state: 'RED' });
  });

  it('matches the 15-month reference table', () => {
    expect(results.map((r) => r.month)).toEqual(REF.months);
    expect(results.map((r) => r.income)).toEqual(REF.income);
    expect(results.map((r) => r.incomeWithoutLeaves)).toEqual(REF.incomeWithoutLeaves);
    expect(results.map((r) => r.charges)).toEqual(REF.charges);
    expect(results.map((r) => r.balance)).toEqual(REF.balance);
    expect(results.map((r) => r.state)).toEqual(REF.states);
  });

  it('removes the Christmas leaves from January (A: −650 €) and February (B: −2 400 €)', () => {
    expect(results[3]!.incomeWithoutLeaves - results[3]!.income).toBe(65_000);
    expect(results[4]!.incomeWithoutLeaves - results[4]!.income).toBe(240_000);
    expect(results[4]!.leaveCost).toBe(240_000);
  });

  it('counts the prospect only when asked', () => {
    const withProspects = monthResults(demoInput(), { includeProspects: true });
    expect(withProspects[11]!.income).toBe(1_485_000);
    expect(withProspects[12]!.income).toBe(585_000);
  });

  it('keeps every month before March 2027 unchanged when client A goes to 700 € in January 2027', () => {
    const base = demoInput();
    const flat = {
      ...base,
      clients: base.clients.map((c) => (c.id === 'client-a' ? { ...c, rates: [{ validFrom: '2026-10-01', amount: 65_000 }] } : c)),
    };
    const a = monthResults(base);
    const b = monthResults(flat);
    for (let i = 0; i < 5; i++) expect(a[i]!.income).toBe(b[i]!.income); // oct. 2026 → févr. 2027
    expect(a[5]!.income).toBeGreaterThan(b[5]!.income); // mars 2027
  });

  it('summarises the horizon', () => {
    expect(resultsSummary(results)).toEqual({
      redCount: 6,
      overdraftCount: 0,
      redDueToLeavesCount: 2,
      lowestBalance: 4_600_600,
      lowestBalanceMonth: '2026-10',
      text: '6 mois dans le rouge, jamais à découvert',
    });
  });
});

describe('monthResults edge cases', () => {
  it('starts from 0 € with an empty account, without NaN', () => {
    const results = monthResults(makeInput());
    expect(results).toHaveLength(15);
    expect(results.every((r) => r.income === 0 && r.charges === 0 && r.balance === 0 && r.state === 'POSITIVE')).toBe(true);
    expect(resultsSummary(results).text).toBe('Aucun mois dans le rouge');
  });

  it('flags overdraft first', () => {
    const input = makeInput({ balance: { date: '2026-10-01', amount: 100 }, charges: [{ id: 'x', name: 'Loyer', amount: 10_000, frequency: 'MONTHLY', month: null, category: null }] });
    const results = monthResults(input);
    expect(results[0]!.state).toBe('OVERDRAFT');
    expect(resultsSummary(results).text).toBe('15 mois à découvert');
  });

  it('derives states', () => {
    expect(monthState({ result: 0, resultWithoutLeaves: 0, balance: 0 })).toBe('POSITIVE');
    expect(monthState({ result: -1, resultWithoutLeaves: -1, balance: 5 })).toBe('RED');
    expect(monthState({ result: -1, resultWithoutLeaves: 0, balance: 5 })).toBe('RED_DUE_TO_LEAVES');
    expect(monthState({ result: 10, resultWithoutLeaves: 10, balance: -1 })).toBe('OVERDRAFT');
  });
});

describe('demo seed', () => {
  it('matches SPEC §8.6', () => {
    const d = demoData();
    expect(DEMO_TODAY).toBe('2026-10-04');
    expect(d.balance).toEqual({ date: '2026-10-04', amount: 4_832_000 });
    expect(d.clients.map((c) => c.id)).toEqual(['client-a', 'client-b', 'client-c', 'client-d']);
    expect(d.charges).toHaveLength(8);
    expect(d.profile).toMatchObject({ legalStatus: 'SASU', netPayMonthly: 400_000 });
    // 5 jours à Noël + 1 pont + 15 jours en août
    expect(d.leaves).toHaveLength(21);
    expect(d.leaves.find((l) => l.date === '2026-12-25')).toBeUndefined();
  });

  it('builds an importable export file from the demo data', () => {
    const file = demoExportFile();
    expect(file).toMatchObject({ format: 'ma-treso', version: 1 });
    expect(file.clients.map((c) => c.ref)).toEqual(['client-a', 'client-b', 'client-c', 'client-d']);
    expect(file.leaves.find((l) => l.date === '2027-05-07')).toEqual({ date: '2027-05-07', scope: 'CLIENT', clientRef: 'client-a' });
    expect(file.balanceSnapshots).toEqual([{ date: '2026-10-04', amount: 4_832_000 }]);
    expect(file.profile).toMatchObject({ firstName: 'Guillaume', legalStatus: 'SASU', alertRedMonth: true });
  });
});
