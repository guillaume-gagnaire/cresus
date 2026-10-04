import { describe, expect, it } from 'vitest';
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
});
