import { describe, expect, it } from 'vitest';
import { ceilingGauge, microBreakdown, microMonths, smoothedIncome, testMissionClient } from '../src/micro';
import { paramsFor } from '../src/params';
import { makeClient, makeInput, makeProfile } from './helpers';

const p = paramsFor(2026);
const microProfile = makeProfile({ legalStatus: 'MICRO' });
// Forfait de 6 800 €/mois payé à réception : 81 600 € sur 2026 (98 % du plafond)
const forfait = makeClient({ billingMode: 'FORFAIT', weekdays: [], startDate: '2026-01-01', rates: [{ validFrom: '2026-01-01', amount: 680_000 }] });
const input = makeInput({ profile: microProfile, clients: [forfait] });

describe('microBreakdown', () => {
  it('splits income with versement libératoire', () => {
    expect(microBreakdown(1_000_000, makeProfile({ microVersementLiberatoire: true }), p)).toEqual({
      income: 1_000_000, contributions: 261_000, tax: 22_000, proExpenses: 18_000, forYou: 699_000,
    });
  });

  it('uses the income tax provision otherwise', () => {
    expect(microBreakdown(1_000_000, makeProfile({ microIncomeTaxProvisionPct: 10 }), p).tax).toBe(100_000);
    expect(microBreakdown(0, makeProfile(), p).forYou).toBe(-18_000);
  });
});

describe('microMonths', () => {
  it('projects 15 months from the current month', () => {
    const months = microMonths(input);
    expect(months).toHaveLength(15);
    expect(months[0]).toMatchObject({ month: '2026-10', income: 680_000 });
    expect(months[0]!.breakdown.contributions).toBe(177_480);
  });
});

describe('testMissionClient', () => {
  it('works mondays at 650 €/day from next month, paid at 30 days', () => {
    expect(testMissionClient('2026-10-04')).toMatchObject({
      id: 'test-mission', billingMode: 'TJM', weekdays: [0], startDate: '2026-11-01', endDate: null, paymentTerm: 'NET_30',
      rates: [{ validFrom: '2026-11-01', amount: 65_000 }],
    });
  });
});

describe('ceilingGauge', () => {
  it('splits actual (past months) and planned (current and future months)', () => {
    const g = ceilingGauge(input, 2026);
    expect(g).toMatchObject({ year: 2026, actual: 6_120_000, planned: 2_040_000, total: 8_160_000, ceiling: 8_360_000, pct: 98, level: 'WARN', overMonth: null });
    expect(g.vatThreshold).toBe(3_750_000);
    expect(g.vatMonth).toBe('2026-06');
  });

  it('shows the overrun month when the test mission tips the year over the ceiling', () => {
    const g = ceilingGauge(input, 2026, { testMission: true });
    expect(g.total).toBe(8_160_000 + 325_000); // 5 lundis de novembre encaissés fin décembre
    expect(g.level).toBe('OVER');
    expect(g.overMonth).toBe('2026-12');
  });

  it('is OK under 85 %', () => {
    // 3 200 €/mois : 38 400 € sur l'année (46 %), seuil de TVA franchi en décembre seulement
    const small = makeInput({ profile: microProfile, clients: [{ ...forfait, rates: [{ validFrom: '2026-01-01', amount: 320_000 }] }] });
    expect(ceilingGauge(small, 2026).level).toBe('OK');
    expect(ceilingGauge(small, 2026).vatMonth).toBe('2026-12');
  });
});

describe('smoothedIncome', () => {
  it('averages "pour toi" over 12 months and flags months under 60 %', () => {
    const months = microMonths(input);
    const s = smoothedIncome(months);
    expect(s.average).toBe(months[0]!.breakdown.forYou);
    expect(s.lowMonths).toEqual([]);
    const withHole = months.map((m, i) => (i === 2 ? { ...m, breakdown: { ...m.breakdown, forYou: 0 } } : m));
    expect(smoothedIncome(withHole).lowMonths).toEqual(['2026-12']);
    expect(smoothedIncome([])).toEqual({ average: 0, lowMonths: [] });
  });
});
