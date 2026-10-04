import {
  addMonths, billedVsCashed, type BillingMode, type Cents, type Client, type ClientColor, currentRate, daysInMonth, estimatedMonthly, euros,
  eurosExact, firstInvoicePath, type ISODate, kEuros, missionTimeline, monthKey, monthLabel, monthName, monthShort, nextRate,
  PAYMENT_TERMS, plural, type PaymentTerm, rateHistory, type RateStatus, shortDate,
} from '@matreso/engine';
import type { Ref } from 'vue';

/** Ligne du tableau « Missions » (Clients.dc.html l. 93 à 102). */
export interface MissionRow {
  id: string;
  name: string;
  color: { base: string; fg: string; soft: string };
  prospect: boolean;
  selected: boolean;
  days: string;
  period: string;
  rate: string;
  rateSub: string;
  term: string;
  delay: string;
  monthly: string;
}

/** Un tarif de l’historique, prêt à afficher (Clients.dc.html l. 117 à 122). */
export interface RateItem {
  /** Identifiant du tarif ; `tmp-…` tant que le serveur n’a pas répondu. */
  id: string;
  value: string;
  when: string;
  status: RateStatus;
  badge: 'Actuel' | 'À venir' | 'Ancien';
  canDelete: boolean;
  /** Tarif créé en local, pas encore confirmé : on ne le supprime qu’une fois son identifiant réel connu (R26). */
  pending: boolean;
  deleteLabel: string;
}

export interface PathStep {
  label: string;
  date: string;
}

/** Fiche du client sélectionné (Clients.dc.html l. 105 à 157). */
export interface MissionPanelView {
  id: string;
  name: string;
  /** Sous-titre ; chaîne vide quand il n’y en a pas. */
  subtitle: string;
  colorKey: ClientColor;
  color: { base: string; fg: string; soft: string };
  isProspect: boolean;
  badge: string;
  billingMode: BillingMode;
  modeHelp: string;
  rateTitle: string;
  rateNow: string;
  newRateLabel: string;
  history: RateItem[];
  weekdays: number[];
  startDate: ISODate;
  endDate: ISODate | null;
  paymentTerm: PaymentTerm;
  averageDelayDays: number;
  path: { steps: [PathStep, PathStep, PathStep]; wait: string };
}

export interface CashBars {
  columns: { label: string; totalLabel: string; segments: { value: number; color: string; faded: boolean }[] }[];
  ariaLabels: string[];
}

export const MODE_HELP: Readonly<Record<BillingMode, string>> = {
  TJM: 'Jours travaillés × TJM. Fériés et congés retirés.',
  FORFAIT: 'Même montant chaque mois, quels que soient tes jours et tes congés. Premier et dernier mois au prorata.',
};

const unit = (mode: BillingMode): string => (mode === 'FORFAIT' ? '/mois' : '/j');
const rateText = (amount: Cents, mode: BillingMode): string => `${eurosExact(amount)}${unit(mode)}`;

/** « Retard moyen constaté » : « aucun » ou « 5 jours ». */
export const delayLabel = (days: number): string => (days > 0 ? plural(days, 'jour') : 'aucun');

/** Fin proposée quand on passe une mission « sans fin » à « avec fin » : six mois après le début, au même quantième. */
export function suggestedEnd(start: ISODate): ISODate {
  const month = addMonths(monthKey(start), 6);
  const day = Math.min(Number(start.slice(8, 10)), daysInMonth(month));
  return `${month}-${String(day).padStart(2, '0')}`;
}

const period = (c: Client): string => `Du ${shortDate(c.startDate)}${c.endDate ? ` au ${shortDate(c.endDate)}` : ', sans fin'}`;
const daysLabel = (c: Client): string =>
  c.billingMode === 'FORFAIT' ? 'Forfait mensuel' : c.weekdays.length ? c.weekdays.map((d) => WEEKDAY_SHORT[d] ?? '').join(', ') : 'aucun jour';

function statusLabel(c: Client, today: ISODate): string {
  if (c.isProspect) return 'Piste';
  if (c.startDate > today) return 'À venir';
  if (c.endDate !== null && c.endDate < today) return 'Terminée';
  return 'En cours';
}

const RATE_BADGES = { PAST: 'Ancien', CURRENT: 'Actuel', FUTURE: 'À venir' } as const;

/**
 * Modèle de vue de « Clients & missions » (Clients.dc.html, script l. 186 à 282) : transforme l’état du store en props pour la
 * frise, le tableau, la fiche et le graphique empilé. Aucun calcul métier ici, tout vient du moteur.
 */
export function useClientsView(selectedId: Ref<string | null>) {
  const treso = useTresoStore();

  const selected = computed<Client | null>(() => treso.clients.find((c) => c.id === selectedId.value) ?? null);

  const kicker = computed(() => {
    const prospects = treso.clients.filter((c) => c.isProspect).length;
    return `${plural(treso.clients.length - prospects, 'mission')} · ${plural(prospects, 'piste')}`;
  });

  const timeline = computed(() => {
    const input = treso.input;
    const view = input ? missionTimeline(input) : null;
    const includeProspects = treso.profile?.includeProspects ?? false;
    const months = view?.months ?? [];
    const rows = (view?.bars ?? []).flatMap((bar) => {
      const c = treso.clientById(bar.clientId);
      if (!c) return [];
      const end = c.endDate ? shortDate(c.endDate) : null;
      return [{
        id: c.id,
        name: c.name,
        sub: c.isProspect ? 'Piste' : c.billingMode === 'FORFAIT' ? (c.subtitle ? `Forfait · ${c.subtitle}` : 'Forfait') : (c.subtitle ?? ''),
        leftPct: bar.leftPct,
        widthPct: bar.widthPct,
        openEnd: bar.openEnd,
        prospect: c.isProspect,
        dimmed: c.isProspect && !includeProspects,
        selected: c.id === selectedId.value,
        color: PALETTE[c.color],
        label: `${shortDate(c.startDate)} → ${end ?? '…'}`,
        aria: `Ouvrir ${c.name} : Du ${shortDate(c.startDate)}${end ? ` au ${end}` : ', sans fin'}`,
      }];
    });
    const low = view?.lowMonths ?? [];
    const nothing = view !== null && view.billed.every((v) => v === 0);
    const gapMessage: { text: string; tone: 'warn' | 'ok' } = nothing
      ? { text: 'Aucun revenu prévu sur ces 12 mois. Ajoute une mission pour commencer.', tone: 'warn' }
      : low.length
        ? { text: `Creux repéré : ${low.map(monthLabel).join(', ')}. Il manque une mission pour remplir tes jours.`, tone: 'warn' }
        : { text: 'Aucun creux sur 12 mois : tes jours sont remplis.', tone: 'ok' };
    const first = months[0];
    const last = months[months.length - 1];
    const range = first && last ? `${/^[aeiouy]/.test(monthName(first)) ? 'D’' : 'De '}${monthLabel(first)} à ${monthLabel(last)}` : '';
    return {
      months: months.map(monthShort),
      range,
      rows,
      gaps: months.map((m, i) => ({ label: `${monthShort(m)} : ${euros(view?.billed[i] ?? 0)} facturés`, low: low.includes(m) })),
      gapMessage,
    };
  });

  const rows = computed<MissionRow[]>(() =>
    treso.clients.map((c) => {
      const now = currentRate(c, treso.today);
      const next = nextRate(c, treso.today);
      return {
        id: c.id,
        name: c.name,
        color: PALETTE[c.color],
        prospect: c.isProspect,
        selected: c.id === selectedId.value,
        days: daysLabel(c),
        period: period(c),
        rate: now ? rateText(now.amount, c.billingMode) : '—',
        rateSub: next
          ? `→ ${eurosExact(next.amount)} au ${shortDate(next.validFrom)}`
          : c.rates.length > 1 ? `${c.rates.length} tarifs dans l’historique` : '',
        term: PAYMENT_TERMS[c.paymentTerm].label,
        delay: c.averageDelayDays ? `+ ${c.averageDelayDays} j de retard en moyenne` : 'paie à l’heure',
        monthly: `${c.isProspect ? '+' : ''}${euros(estimatedMonthly(c, treso.today))}`,
      };
    }),
  );

  const panel = computed<MissionPanelView | null>(() => {
    const c = selected.value;
    if (!c) return null;
    const today = treso.today;
    const now = currentRate(c, today);
    const path = firstInvoicePath(c, today);
    return {
      id: c.id,
      name: c.name,
      subtitle: c.subtitle ?? '',
      colorKey: c.color,
      color: PALETTE[c.color],
      isProspect: c.isProspect,
      badge: statusLabel(c, today),
      billingMode: c.billingMode,
      modeHelp: MODE_HELP[c.billingMode],
      rateTitle: c.billingMode === 'FORFAIT' ? 'Montant mensuel actuel' : 'TJM actuel',
      rateNow: now ? rateText(now.amount, c.billingMode) : '—',
      newRateLabel: c.billingMode === 'FORFAIT' ? 'Nouveau forfait (€)' : 'Nouveau TJM (€)',
      history: rateHistory(c.rates, today).map(({ rate, status, validTo }) => {
        const id = rate.id ?? rate.validFrom;
        return {
          id,
          value: rateText(rate.amount, c.billingMode),
          when: `Du ${shortDate(rate.validFrom)}${validTo ? ` au ${shortDate(validTo)}` : ''}`,
          status,
          badge: RATE_BADGES[status],
          canDelete: c.rates.length > 1,
          pending: id.startsWith('tmp-'),
          deleteLabel: `Supprimer le tarif du ${shortDate(rate.validFrom)}`,
        };
      }),
      weekdays: c.weekdays,
      startDate: c.startDate,
      endDate: c.endDate,
      paymentTerm: c.paymentTerm,
      averageDelayDays: c.averageDelayDays,
      path: {
        steps: [
          { label: 'Tu factures le', date: shortDate(path.invoiceDate) },
          { label: 'Échéance le', date: shortDate(path.dueDate) },
          { label: 'L’argent arrive vers le', date: shortDate(path.cashDate) },
        ],
        wait: `Soit ${plural(path.waitDays, 'jour')} d’attente entre la fin du mois travaillé et l’argent sur ton compte.`,
      },
    };
  });

  const cash = computed(() => (treso.input ? billedVsCashed(treso.input) : []));

  /** Colonnes du graphique empilé, au choix « Facturé » ou « Encaissé » : un segment par mission, la dernière en haut. */
  const cashBars = computed<Record<'billed' | 'cashed', CashBars>>(() => {
    const stacked = [...treso.clients].reverse();
    const build = (kind: 'billed' | 'cashed'): CashBars => {
      const total = (m: (typeof cash.value)[number]): Cents => (kind === 'billed' ? m.billedTotal : m.cashedTotal);
      return {
        columns: cash.value.map((m) => ({
          label: monthShort(m.month),
          totalLabel: total(m) ? kEuros(total(m), { sign: false }) : '0',
          segments: stacked.filter((c) => m[kind][c.id]).map((c) => ({ value: m[kind][c.id]!, color: PALETTE[c.color].base, faded: c.isProspect })),
        })),
        ariaLabels: cash.value.map((m) => `${monthLabel(m.month)} : ${euros(total(m))} ${kind === 'billed' ? 'facturés' : 'encaissés'}`),
      };
    };
    return { billed: build('billed'), cashed: build('cashed') };
  });

  const totals = computed(() => ({
    billed: `${euros(cash.value.reduce((sum, m) => sum + m.billedTotal, 0))} facturés`,
    cashed: `${euros(cash.value.reduce((sum, m) => sum + m.cashedTotal, 0))} encaissés`,
  }));

  return { timeline, rows, selected, panel, cashBars, totals, kicker };
}
