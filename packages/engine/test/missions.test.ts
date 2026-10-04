import { describe, expect, it } from 'vitest';
import { billedVsCashed, cycleWeekday, estimatedDaysPerMonth, estimatedMonthly, firstInvoicePath, missionTimeline, weekTemplate } from '../src/missions';
import { demoData, demoInput, DEMO_TODAY } from '../src/seed';

const { clients } = demoData();
const [a, b, c, d] = clients as [typeof clients[0], typeof clients[0], typeof clients[0], typeof clients[0]];

describe('estimates', () => {
  it('estimates the monthly amount like the mockup table (days × 4.3 × current rate)', () => {
    expect(estimatedMonthly(a, DEMO_TODAY)).toBe(Math.round(2 * 4.3 * 65_000));
    expect(estimatedMonthly(d, DEMO_TODAY)).toBe(120_000);
    expect(estimatedMonthly(c, DEMO_TODAY)).toBe(Math.round(2 * 4.3 * 70_000));
    expect(estimatedDaysPerMonth(b)).toBe(13);
  });
});

describe('missionTimeline', () => {
  const t = missionTimeline(demoInput());

  it('covers 12 months from the current month', () => {
    expect(t.months[0]).toBe('2026-10');
    expect(t.months[11]).toBe('2027-09');
  });

  it('positions bars on the window', () => {
    const barA = t.bars.find((x) => x.clientId === 'client-a')!;
    expect(barA.leftPct).toBe(0);
    expect(barA.widthPct).toBeCloseTo((243 / 365) * 100, 5);
    expect(barA.openEnd).toBe(false);
    const barB = t.bars.find((x) => x.clientId === 'client-b')!;
    expect(barB.widthPct).toBeCloseTo(100, 5);
    expect(barB.openEnd).toBe(true);
    const barC = t.bars.find((x) => x.clientId === 'client-c')!;
    expect(barC.leftPct).toBeCloseTo((273 / 365) * 100, 5);
    expect(barC.openEnd).toBe(true);
  });

  it('flags months under 75 % of the best billed month', () => {
    expect(t.lowMonths).toEqual(expect.arrayContaining(['2027-06', '2027-07', '2027-08', '2027-09']));
    expect(t.lowMonths).not.toContain('2027-03');
  });

  it('hides bars outside the window', () => {
    const old = { ...a, id: 'old', startDate: '2025-01-01', endDate: '2025-06-30' };
    expect(missionTimeline({ ...demoInput(), clients: [old] }).bars[0]!.visible).toBe(false);
  });
});

describe('billedVsCashed', () => {
  it('reports billed (worked month) and cashed (payment month) per client', () => {
    const [oct] = billedVsCashed(demoInput());
    expect(oct!.billed).toEqual({ 'client-a': 585_000, 'client-b': 780_000 });
    expect(oct!.cashed).toEqual({ 'client-b': 660_000 });
    expect(oct!.cashedTotal).toBe(660_000);
    expect(oct!.billedTotal).toBe(1_365_000);
  });
});

describe('firstInvoicePath', () => {
  it('follows the first billed month: invoice 31 Oct → due 30 Nov → 30 days', () => {
    expect(firstInvoicePath(a, DEMO_TODAY)).toMatchObject({ invoiceDate: '2026-10-31', dueDate: '2026-11-30', cashDate: '2026-11-30', waitDays: 30 });
    expect(firstInvoicePath(c, DEMO_TODAY).invoiceDate).toBe('2027-07-31');
    const never = { ...a, weekdays: [] };
    expect(firstInvoicePath(never, DEMO_TODAY).invoiceDate).toBe('2026-10-31');
  });
});

describe('week template', () => {
  it('shows who works each weekday among signed TJM clients', () => {
    expect(weekTemplate(clients, DEMO_TODAY)).toEqual([
      { weekday: 0, clientId: 'client-a' },
      { weekday: 1, clientId: 'client-b' },
      { weekday: 2, clientId: 'client-b' },
      { weekday: 3, clientId: 'client-b' },
      { weekday: 4, clientId: 'client-a' },
    ]);
  });

  it('shows null for weekdays with no assigned clients', () => {
    const partial = [{ ...a, weekdays: [0] }, { ...b, weekdays: [1] }];
    expect(weekTemplate(partial, DEMO_TODAY)[2]?.clientId).toBeNull();
  });

  it('cycles A → B → free → A', () => {
    expect(cycleWeekday(clients, DEMO_TODAY, 0)).toEqual([
      { clientId: 'client-a', weekdays: [4] },
      { clientId: 'client-b', weekdays: [0, 1, 2, 3] },
    ]);
    expect(cycleWeekday(clients, DEMO_TODAY, 1)).toEqual([{ clientId: 'client-b', weekdays: [2, 3] }]);
    const freed = clients.map((x) => (x.id === 'client-b' ? { ...x, weekdays: [2, 3] } : x));
    expect(cycleWeekday(freed, DEMO_TODAY, 1)).toEqual([{ clientId: 'client-a', weekdays: [0, 1, 4] }]);
  });

  it('deduplicates overlapping weekdays when cycling', () => {
    const overlap = [{ ...a, weekdays: [0, 4] }, { ...b, weekdays: [0, 1] }];
    const patches = cycleWeekday(overlap, DEMO_TODAY, 0);
    expect(patches).toEqual([
      { clientId: 'client-a', weekdays: [4] },
      { clientId: 'client-b', weekdays: [0, 1] },
    ]);
  });
});
