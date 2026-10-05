import { describe, expect, it } from 'vitest';
import { addDays } from '../src/dates';
import { groupLeaves, leaveImpact, leavesCost, workingDaysBetween } from '../src/leaves';
import { demoData, demoInput } from '../src/seed';
import type { Leave } from '../src/types';
import { makeInput } from './helpers';

const { clients } = demoData();
const counted = clients.filter((c) => !c.isProspect);

describe('workingDaysBetween', () => {
  it('keeps weekdays that are not public holidays', () => {
    expect(workingDaysBetween('2026-12-24', '2026-12-31')).toEqual(['2026-12-24', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31']);
    expect(workingDaysBetween('2026-12-26', '2026-12-27')).toEqual([]);
  });
});

describe('leaveImpact', () => {
  it('costs the rate of the client who would have billed, landing in that client’s cash month', () => {
    expect(leaveImpact({ date: '2026-12-28', scope: 'ALL', clientId: null }, counted)).toEqual([
      { clientId: 'client-a', date: '2026-12-28', cost: 65_000, cashMonth: '2027-01' },
    ]);
    expect(leaveImpact({ date: '2026-12-29', scope: 'ALL', clientId: null }, counted)).toEqual([
      { clientId: 'client-b', date: '2026-12-29', cost: 60_000, cashMonth: '2027-02' },
    ]);
  });

  it('only hits the targeted client for a CLIENT leave', () => {
    expect(leaveImpact({ date: '2026-12-29', scope: 'CLIENT', clientId: 'client-a' }, counted)).toEqual([]);
    expect(leaveImpact({ date: '2027-05-07', scope: 'CLIENT', clientId: 'client-a' }, counted)).toEqual([
      { clientId: 'client-a', date: '2027-05-07', cost: 70_000, cashMonth: '2027-06' },
    ]);
  });

  it('costs 0 when no TJM client is active that day', () => {
    expect(leaveImpact({ date: '2026-09-07', scope: 'ALL', clientId: null }, [clients[0]!])).toEqual([]);
    expect(leavesCost([{ date: '2026-09-07', scope: 'ALL', clientId: null }], [clients[0]!], false)).toBe(0);
  });

  it('sums the cost of several leaves and honours includeProspects', () => {
    const xmas: Leave[] = [
      { date: '2026-12-28', scope: 'ALL', clientId: null }, // A: 650 €
      { date: '2026-12-29', scope: 'ALL', clientId: null }, // B: 600 €
    ];
    expect(leavesCost(xmas, clients, false)).toBe(125_000);
    const monday: Leave[] = [{ date: '2027-08-02', scope: 'ALL', clientId: null }]; // only C (prospect) works
    expect(leavesCost(monday, clients, false)).toBe(0);
    expect(leavesCost(monday, clients, true)).toBe(70_000);
  });
});

describe('groupLeaves', () => {
  it('groups the Christmas leaves across a holiday and a weekend, with cost and impact months', () => {
    const periods = groupLeaves(demoInput());
    expect(periods).toHaveLength(3);
    expect(periods[0]).toMatchObject({
      from: '2026-12-24', to: '2026-12-31', scope: 'ALL', clientId: null, dayCount: 5, cost: 305_000,
      impacts: [{ cashMonth: '2027-01', amount: 65_000 }, { cashMonth: '2027-02', amount: 240_000 }],
    });
    expect(periods[1]).toMatchObject({ from: '2027-05-07', to: '2027-05-07', scope: 'CLIENT', clientId: 'client-a', dayCount: 1, cost: 70_000 });
    expect(periods[2]).toMatchObject({ from: '2027-08-02', to: '2027-08-20', dayCount: 15, cost: 540_000, impacts: [{ cashMonth: '2027-10', amount: 540_000 }] });
  });

  it('splits when a working day separates two leaves, or when scopes differ', () => {
    const leaves: Leave[] = [
      { id: '1', date: '2027-08-05', scope: 'ALL', clientId: null },
      { id: '2', date: '2027-08-06', scope: 'ALL', clientId: null },
      { id: '3', date: '2027-08-10', scope: 'ALL', clientId: null }, // le lundi 9 est ouvré
      { id: '4', date: '2027-08-11', scope: 'CLIENT', clientId: 'client-b' },
    ];
    const periods = groupLeaves(makeInput({ clients, leaves }));
    expect(periods.map((p) => [p.from, p.to, p.scope])).toEqual([
      ['2027-08-05', '2027-08-06', 'ALL'],
      ['2027-08-10', '2027-08-10', 'ALL'],
      ['2027-08-11', '2027-08-11', 'CLIENT'],
    ]);
    expect(periods[0]!.leaveIds).toEqual(['1', '2']);
  });

  it('does not double-count a CLIENT leave on a day already covered by an ALL leave', () => {
    const leaves: Leave[] = [
      { date: '2026-12-29', scope: 'ALL', clientId: null },
      { date: '2026-12-29', scope: 'CLIENT', clientId: 'client-b' },
    ];
    const periods = groupLeaves(makeInput({ clients, leaves }));
    expect(periods.map((p) => p.cost)).toEqual([60_000, 0]);
  });

  it('ignores prospects unless asked', () => {
    const leaves: Leave[] = [{ date: '2027-08-02', scope: 'ALL', clientId: null }]; // lundi : C (piste) y travaillerait
    expect(groupLeaves(makeInput({ clients, leaves }))[0]!.cost).toBe(0);
    expect(groupLeaves(makeInput({ clients, leaves }), { includeProspects: true })[0]!.cost).toBe(70_000);
  });

  it('collapses duplicate ALL leaves on the same date into one period with dayCount 1', () => {
    const leaves: Leave[] = [
      { id: 'x1', date: '2026-12-28', scope: 'ALL', clientId: null },
      { id: 'x2', date: '2026-12-28', scope: 'ALL', clientId: null },
    ];
    const periods = groupLeaves(makeInput({ clients, leaves }));
    expect(periods).toHaveLength(1);
    expect(periods[0]).toMatchObject({
      from: '2026-12-28',
      to: '2026-12-28',
      dayCount: 1,
      cost: 65_000,
      leaveIds: ['x1'],
    });
  });

  it('groups 20 000 leaves (import cap) without quadratic copying', () => {
    const leaves: Leave[] = [];
    let d = '2000-01-03';
    for (let i = 0; i < 20_000; i++) {
      leaves.push({ id: `l${i}`, date: d, scope: i % 2 === 0 ? 'ALL' : 'CLIENT', clientId: i % 2 === 0 ? null : 'client-a' });
      d = addDays(d, 1);
    }
    const t0 = Date.now();
    const periods = groupLeaves(makeInput({ clients, leaves }));
    const elapsed = Date.now() - t0;
    expect(periods.length).toBeGreaterThan(0);
    expect(periods.reduce((n, p) => n + p.dayCount, 0)).toBe(20_000);
    expect(elapsed).toBeLessThan(5_000);
  });
});
