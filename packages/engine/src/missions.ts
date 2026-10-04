import { indexLeaves, monthlyAmount } from './billing';
import { diffDays, firstDayOfMonth, type ISODate, lastDayOfMonth, maxDate, minDate, type MonthKey, monthKey, monthRange } from './dates';
import { countedClients, projectIncome } from './income';
import { type PaymentPath, paymentPath } from './payment';
import { currentRate } from './rates';
import type { Cents, Client, EngineInput } from './types';

export function estimatedMonthly(client: Client, today: ISODate): Cents {
  const rate = currentRate(client, today)?.amount ?? 0;
  return client.billingMode === 'FORFAIT' ? rate : Math.round(client.weekdays.length * 4.3 * rate);
}

export const estimatedDaysPerMonth = (client: Client): number => Math.round(client.weekdays.length * 4.3);

export interface TimelineBar {
  clientId: string;
  leftPct: number;
  widthPct: number;
  openEnd: boolean;
  visible: boolean;
}

export interface MissionTimeline {
  months: MonthKey[];
  bars: TimelineBar[];
  /** Montant facturé (hors congés) par mois de la fenêtre */
  billed: Cents[];
  lowMonths: MonthKey[];
}

export function missionTimeline(input: EngineInput, opts: { months?: number; includeProspects?: boolean } = {}): MissionTimeline {
  const n = opts.months ?? 12;
  const months = monthRange(monthKey(input.today), n);
  const winStart = firstDayOfMonth(months[0]!);
  const winEnd = lastDayOfMonth(months[n - 1]!);
  const span = diffDays(winStart, winEnd) + 1;
  const bars = input.clients
    .filter((c) => c.archivedAt === null)
    .map((c): TimelineBar => {
      const s = maxDate(c.startDate, winStart);
      const e = c.endDate === null ? winEnd : minDate(c.endDate, winEnd);
      const visible = s <= e;
      return {
        clientId: c.id,
        leftPct: visible ? (diffDays(winStart, s) / span) * 100 : 0,
        widthPct: visible ? ((diffDays(s, e) + 1) / span) * 100 : 0,
        openEnd: c.endDate === null || c.endDate > winEnd,
        visible,
      };
    });
  const counted = countedClients(input.clients, opts.includeProspects ?? input.profile.includeProspects);
  const billed = months.map((m) => counted.reduce((s, c) => s + monthlyAmount(c, m, null), 0));
  const best = Math.max(0, ...billed);
  const lowMonths = best > 0 ? months.filter((_, i) => billed[i]! < best * 0.75) : [];
  return { months, bars, billed, lowMonths };
}

export interface CashMonth {
  month: MonthKey;
  billed: Record<string, Cents>;
  cashed: Record<string, Cents>;
  billedTotal: Cents;
  cashedTotal: Cents;
}

export function billedVsCashed(input: EngineInput, opts: { months?: number; includeProspects?: boolean } = {}): CashMonth[] {
  const n = opts.months ?? 12;
  const first = monthKey(input.today);
  const includeProspects = opts.includeProspects ?? input.profile.includeProspects;
  const counted = countedClients(input.clients, includeProspects);
  const index = indexLeaves(input.leaves);
  const entries = projectIncome(input.clients, input.leaves, { firstMonth: first, months: n, includeProspects });
  return monthRange(first, n).map((month) => {
    const billed: Record<string, Cents> = {};
    for (const c of counted) {
      const amount = monthlyAmount(c, month, index);
      if (amount) billed[c.id] = amount;
    }
    const cashed: Record<string, Cents> = {};
    for (const e of entries) if (e.cashMonth === month) cashed[e.clientId] = (cashed[e.clientId] ?? 0) + e.amount;
    const total = (r: Record<string, Cents>) => Object.values(r).reduce((s, v) => s + v, 0);
    return { month, billed, cashed, billedTotal: total(billed), cashedTotal: total(cashed) };
  });
}

/** « Le chemin d'une facture » : premier mois facturé dans les 12 mois, sinon mois de début (ou courant). */
export function firstInvoicePath(client: Client, today: ISODate): PaymentPath {
  const first = monthKey(today);
  for (const m of monthRange(first, 12)) if (monthlyAmount(client, m, null) > 0) return paymentPath(client, m);
  return paymentPath(client, maxDate(first, monthKey(client.startDate)));
}

function templateClients(clients: readonly Client[], today: ISODate): Client[] {
  return clients.filter(
    (c) => c.billingMode === 'TJM' && c.archivedAt === null && !c.isProspect && (c.endDate === null || c.endDate >= today),
  );
}

export function weekTemplate(clients: readonly Client[], today: ISODate): Array<{ weekday: number; clientId: string | null }> {
  const eligible = templateClients(clients, today);
  return [0, 1, 2, 3, 4].map((weekday) => ({ weekday, clientId: eligible.find((c) => c.weekdays.includes(weekday))?.id ?? null }));
}

/** Semaine type mobile : fait tourner le jour vers le client suivant, puis « libre », puis le premier client. */
export function cycleWeekday(clients: readonly Client[], today: ISODate, weekday: number): Array<{ clientId: string; weekdays: number[] }> {
  const eligible = templateClients(clients, today);
  const currentIdx = eligible.findIndex((c) => c.weekdays.includes(weekday));
  const next = currentIdx === -1 ? eligible[0] : eligible[currentIdx + 1];
  const patches: Array<{ clientId: string; weekdays: number[] }> = [];
  const current = eligible[currentIdx];
  if (current) patches.push({ clientId: current.id, weekdays: current.weekdays.filter((d) => d !== weekday) });
  if (next) patches.push({ clientId: next.id, weekdays: [...next.weekdays, weekday].sort((x, y) => x - y) });
  return patches;
}
