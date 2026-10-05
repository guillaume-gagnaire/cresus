import {
  type BalanceSnapshotDto,
  ceilingGauge,
  type ChargeItem,
  type Client,
  type EngineInput,
  groupLeaves,
  HORIZON_MONTHS,
  type ISODate,
  type MonthKey,
  microMonths,
  monthKey,
  monthResults,
  resultsSummary,
  smoothedIncome,
  type StateDto,
  type UserProfileDto,
  yearOf,
} from '@matreso/engine';
import { AppError } from '../common/app-error.js';
import { toEuros } from './money.js';

type ChargeDto = StateDto['charges'][number];

/**
 * Représentations renvoyées par les outils MCP : les mêmes données que l'API, avec les montants en euros.
 * Les calculs (projection, jauge, périodes de congés) sont ceux du moteur, partagés avec le front.
 */

export const clientView = (c: Client) => ({ ...c, rates: c.rates.map((r) => ({ id: r.id, validFrom: r.validFrom, amount: toEuros(r.amount) })) });

export const chargeView = (c: ChargeDto) => ({ ...c, amount: toEuros(c.amount) });

export const balanceView = (b: BalanceSnapshotDto) => ({ ...b, amount: toEuros(b.amount) });

export const profileView = ({ id: _id, ...p }: UserProfileDto) => ({
  ...p,
  netPayMonthly: toEuros(p.netPayMonthly),
  microProExpensesMonthly: toEuros(p.microProExpensesMonthly),
});

/** Entrée du moteur pour l'état de l'utilisateur ; `includeProspects` remplace, le temps de l'appel, l'option du profil. */
export function engineInput(state: StateDto, today: ISODate, includeProspects?: boolean): EngineInput {
  return {
    today,
    profile: { ...state.profile, includeProspects: includeProspects ?? state.profile.includeProspects },
    clients: state.clients,
    leaves: state.leaves,
    charges: state.charges,
    balance: state.balance.latest,
  };
}

export function overviewView(state: StateDto, today: ISODate, includeProspects?: boolean) {
  const input = engineInput(state, today, includeProspects);
  const results = monthResults(input);
  const summary = resultsSummary(results);
  const latest = state.balance.latest;
  const isMicro = input.profile.legalStatus === 'MICRO';
  const overview = {
    today,
    balance: toEuros(latest?.amount ?? 0),
    balanceDate: latest?.date ?? null,
    mode: isMicro ? ('micro' as const) : ('societe' as const),
    summary: {
      redCount: summary.redCount,
      overdraftCount: summary.overdraftCount,
      redDueToLeavesCount: summary.redDueToLeavesCount,
      lowestBalance: toEuros(summary.lowestBalance),
      lowestBalanceMonth: summary.lowestBalanceMonth,
      text: summary.text,
    },
    months: results.map((r) => ({
      month: r.month,
      income: toEuros(r.income),
      incomeWithoutLeaves: toEuros(r.incomeWithoutLeaves),
      charges: toEuros(r.charges),
      result: toEuros(r.result),
      balance: toEuros(r.balance),
      state: r.state,
    })),
  };
  if (!isMicro) return overview;
  const micro = microMonths(input);
  const gauge = ceilingGauge(input, yearOf(today));
  return {
    ...overview,
    micro: {
      months: micro.map((m) => ({ month: m.month, income: toEuros(m.income), forYou: toEuros(m.breakdown.forYou) })),
      gauge: {
        year: gauge.year,
        total: toEuros(gauge.total),
        ceiling: toEuros(gauge.ceiling),
        pct: gauge.pct,
        level: gauge.level,
        overMonth: gauge.overMonth,
        vatMonth: gauge.vatMonth,
      },
      smoothedAverage: toEuros(smoothedIncome(micro).average),
    },
  };
}

const chargeLine = (c: ChargeItem) => ({ name: c.name, amount: toEuros(c.amount), frequency: c.frequency, computed: c.computed });

/** Détail d'un mois de l'horizon de projection. Le total des charges est `chargesTotal` : `charges` en est la liste. */
export function monthView(state: StateDto, today: ISODate, month: MonthKey) {
  const results = monthResults(engineInput(state, today));
  const found = results.find((r) => r.month === month);
  if (!found) {
    throw new AppError(
      422,
      'OUT_OF_HORIZON',
      `Ce mois est hors de l’horizon de projection (${HORIZON_MONTHS} mois, de ${monthKey(today)} à ${results[results.length - 1]!.month}).`,
    );
  }
  const names = new Map(state.clients.map((c) => [c.id, c.name]));
  return {
    month: found.month,
    state: found.state,
    income: toEuros(found.income),
    chargesTotal: toEuros(found.charges),
    result: toEuros(found.result),
    balance: toEuros(found.balance),
    entries: found.entries.map((e) => ({
      client: names.get(e.clientId) ?? 'Client supprimé',
      workMonth: e.workMonth,
      cashDate: e.cashDate,
      amount: toEuros(e.amount),
      leaveCost: toEuros(e.leaveCost),
    })),
    charges: found.chargeItems.map(chargeLine),
  };
}

/** Périodes de congés regroupées (jours ouvrés consécutifs), avec leur coût et les mois d'encaissement touchés. */
export function leavePeriodsView(state: StateDto) {
  const names = new Map(state.clients.map((c) => [c.id, c.name]));
  return groupLeaves(state).map((p) => ({
    from: p.from,
    to: p.to,
    dayCount: p.dayCount,
    scope: p.scope,
    client: p.clientId ? (names.get(p.clientId) ?? null) : null,
    cost: toEuros(p.cost),
    impacts: p.impacts.map((i) => ({ cashMonth: i.cashMonth, amount: toEuros(i.amount) })),
    leaveIds: p.leaveIds,
  }));
}
