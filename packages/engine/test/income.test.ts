import { describe, expect, it } from 'vitest';
import { countedClients, projectIncome, sumBy } from '../src/income';
import { makeClient } from './helpers';

describe('projectIncome', () => {
  it('lands January and February invoices in March with EOM_30', () => {
    const c = makeClient({ startDate: '2027-01-01', paymentTerm: 'EOM_30', rates: [{ validFrom: '2027-01-01', amount: 50_000 }] });
    const entries = projectIncome([c], [], { firstMonth: '2027-03', months: 1, includeProspects: false });
    expect(entries.map((e) => e.workMonth)).toEqual(['2027-01', '2027-02']);
    expect(entries.every((e) => e.cashMonth === '2027-03')).toBe(true);
  });

  it('looks back 8 months to catch late payments of past work', () => {
    const slow = makeClient({ paymentTerm: 'NET_60', averageDelayDays: 30 });
    const entries = projectIncome([slow], [], { firstMonth: '2026-10', months: 1, includeProspects: false });
    expect(entries.map((e) => e.workMonth)).toEqual(['2026-07']);
    expect(entries[0]?.cashDate).toBe('2026-10-29');
  });

  it('excludes prospects unless asked, and always excludes archived clients', () => {
    const prospect = makeClient({ id: 'p', isProspect: true });
    const archived = makeClient({ id: 'a', archivedAt: '2026-09-01T00:00:00Z' });
    expect(countedClients([prospect, archived], false)).toEqual([]);
    expect(countedClients([prospect, archived], true).map((c) => c.id)).toEqual(['p']);
    expect(projectIncome([prospect], [], { firstMonth: '2026-11', months: 1, includeProspects: false })).toEqual([]);
    expect(projectIncome([prospect], [], { firstMonth: '2026-11', months: 1, includeProspects: true })).toHaveLength(1);
  });

  it('reports amounts with and without leaves', () => {
    const c = makeClient();
    const [entry] = projectIncome([c], [{ date: '2026-11-12', scope: 'ALL', clientId: null }], { firstMonth: '2026-11', months: 1, includeProspects: false });
    expect(entry?.amountWithoutLeaves).toBe(20 * 60_000);
    expect(entry?.amount).toBe(19 * 60_000);
    expect(entry?.leaveCost).toBe(60_000);
  });

  it('adds extra hypothetical clients', () => {
    const extra = makeClient({ id: 'x' });
    const entries = projectIncome([], [], { firstMonth: '2026-11', months: 1, includeProspects: false, extraClients: [extra] });
    expect(entries.map((e) => e.clientId)).toEqual(['x']);
  });

  it('skips months without any amount and sorts by cash date', () => {
    const a = makeClient({ id: 'a', paymentTerm: 'NET_30' });
    const b = makeClient({ id: 'b', paymentTerm: 'RECEPTION', startDate: '2026-11-01' });
    const entries = projectIncome([a, b], [], { firstMonth: '2026-11', months: 1, includeProspects: false });
    expect(entries.map((e) => e.clientId)).toEqual(['a', 'b']); // a : facture d'octobre le 30/11, b : facture de novembre le 30/11
    expect(sumBy(entries, 'amount')).toBe(entries[0]!.amount + entries[1]!.amount);
  });

  it('filters work months that end before client start date', () => {
    const future = makeClient({ id: 'future', startDate: '2026-12-01' });
    const entries = projectIncome([future], [], { firstMonth: '2026-11', months: 1, includeProspects: false });
    expect(entries.filter((e) => e.clientId === 'future')).toEqual([]);
  });

  it('filters work months that start after client end date', () => {
    const ended = makeClient({ id: 'ended', endDate: '2026-10-31' });
    const entries = projectIncome([ended], [], { firstMonth: '2026-11', months: 1, includeProspects: false });
    expect(entries.filter((e) => e.clientId === 'ended')).toEqual([]);
  });

  it('skips months with zero billable amount', () => {
    const noWeekdays = makeClient({ id: 'nope', weekdays: [] });
    const entries = projectIncome([noWeekdays], [], { firstMonth: '2026-11', months: 1, includeProspects: false });
    // TJM client with no weekdays has 0 billable days each month
    expect(entries.filter((e) => e.clientId === 'nope')).toEqual([]);
  });
});
