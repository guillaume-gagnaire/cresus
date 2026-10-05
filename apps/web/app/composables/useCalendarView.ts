import {
  calendarMonth, type CalendarDay, diffDays, euros, groupLeaves, type ISODate, kEuros, leaveKpis, type LeaveTarget, matchesTarget,
  type MonthResult, type MonthState, monthKey, monthLabel as formatMonth, monthLetter, monthName, monthResults, monthShort, plural, shortDate,
  weekday, workingDaysBetween, yearOf,
} from '@matreso/engine';

type CardTone = 'neutral' | 'positive' | 'warn' | 'danger' | 'info';

/** Une case du calendrier (Calendrier.dc.html l. 72 à 88, Mobile-Conges.dc.html l. 67 à 69). */
export interface DayView {
  date: ISODate;
  day: number;
  inMonth: boolean;
  weekend: boolean;
  holidayName: string | null;
  clickable: boolean;
  /** Il y a un congé posé ce jour-là chez la cible choisie (le toucher le retirerait). */
  pressed: boolean;
  /** Il y a au moins un congé ce jour-là, quelle que soit sa cible. */
  isLeave: boolean;
  /** Un enregistrement est en cours pour ce jour : on ignore les touchers (R26). */
  pending: boolean;
  /** Teinte de la case : le week-end l’emporte sur le férié, le congé sur le client. */
  kind: 'weekend' | 'holiday' | 'leave' | 'client' | 'free';
  /** Mention sous le numéro : « Vacances », nom du férié, nom du client (« Client A +1 » s’ils sont plusieurs), « Libre ». */
  tag: string;
  /** Couleur du premier client du jour. */
  color: { base: string; soft: string } | null;
  prospect: boolean;
  ariaLabel: string;
}

export interface KpiView {
  value: string;
  sub: string;
  tone: CardTone;
  /** Couleur du montant quand elle n’est pas celle de l’encre (solde à découvert). */
  valueColor?: string;
}

export interface AlertView {
  text: string;
  tone: 'danger' | 'red' | 'warn' | 'positive';
  style: { bg: string; ink: string };
}

/** Ligne du tableau « Mois par mois » (Calendrier.dc.html l. 142 à 160). */
export interface MonthRowView {
  key: string;
  month: string;
  base: string;
  withLeaves: string;
  cost: string;
  charges: string;
  /** Charges annuelles du mois (« Assurance RC Pro »), chaîne vide s’il n’y en a pas. */
  chargeNote: string;
  result: string;
  resultNegative: boolean;
  balance: string;
  balanceNegative: boolean;
  badge: { label: string; bg: string; fg: string };
  rowBg: string | null;
}

/** Mois touché par les vacances ou dans le rouge (Mobile-Conges.dc.html l. 85). */
export interface ImpactedMonthView {
  key: string;
  month: string;
  sub: string;
  amount: string;
  negative: boolean;
  badge: { label: string; bg: string; fg: string };
}

export interface PeriodView {
  key: string;
  title: string;
  sub: string;
  cost: string;
  impact: string;
  ariaLabel: string;
  leaveIds: string[];
  /** Au moins un congé de la période n’est pas encore confirmé par le serveur (`tmp-…`) : pas de suppression (R26). */
  pending: boolean;
}

export interface FlashMessage {
  text: string;
  tone: 'ok' | 'info' | 'error';
}

/** Durée minimale pendant laquelle les corbeilles des périodes restent désactivées après une suppression. */
const DELETE_LOCK_MS = 400;

const isTemporary = (id: string | undefined): boolean => id?.startsWith('tmp-') ?? false;

/** Couleurs des bandeaux (Calendrier.dc.html l. 270 à 280), reprises de STATE_STYLE sauf le jaune « délais de paiement ». */
const ALERT_STYLE: Readonly<Record<AlertView['tone'], { bg: string; ink: string }>> = {
  danger: { bg: STATE_STYLE.OVERDRAFT.bg, ink: STATE_STYLE.OVERDRAFT.ink },
  red: { bg: STATE_STYLE.RED_DUE_TO_LEAVES.bg, ink: STATE_STYLE.RED_DUE_TO_LEAVES.ink },
  warn: { bg: '#FFF4C2', ink: '#5A4A00' },
  positive: { bg: STATE_STYLE.POSITIVE.badgeBg, ink: STATE_STYLE.POSITIVE.badgeInk },
};

/** Pastille d’état de l’écran mobile : les mois dans le rouge sans lien avec les vacances restent discrets (Mobile-Conges.dc.html l. 185). */
function mobileBadge(state: MonthState): { label: string; bg: string; fg: string } {
  const style = STATE_STYLE[state];
  if (state === 'RED') return { label: style.label, bg: 'var(--border-soft)', fg: 'var(--muted)' };
  return { label: style.label, bg: style.badgeBg, fg: style.badgeInk };
}

/**
 * Modèle de vue de « Calendrier & congés » (Calendrier.dc.html, script l. 163 à 307 ; Mobile-Conges.dc.html, script l. 97 à 216) :
 * transforme l’état du store en props pour le calendrier, les KPI, le bandeau, les graphiques et la liste des périodes.
 * Aucun calcul métier ici, tout vient du moteur. « Compter la piste » est un état local : il change ce que cet écran
 * affiche (KPI, mois, périodes, cases), jamais le profil.
 */
export function useCalendarView() {
  const treso = useTresoStore();

  const monthIndex = ref(0);
  const includeProspect = ref(treso.profile?.includeProspects ?? false);
  const targetKey = ref('ALL');
  const lastMessage = ref<FlashMessage | null>(null);
  const adding = ref(false);
  /** Une suppression de période est en cours : toutes les corbeilles attendent (R33). */
  const deleting = ref(false);
  /** Jours dont un toucher est en cours d’enregistrement : un second toucher serait ignoré (R26). */
  const pendingDates = reactive(new Set<ISODate>());

  /** Projection avec ou sans la piste ; celle du store quand le choix local est celui du profil. */
  const results = computed<MonthResult[]>(() => {
    const input = treso.input;
    if (!input) return [];
    return includeProspect.value === input.profile.includeProspects ? treso.results : monthResults(input, { includeProspects: includeProspect.value });
  });
  const months = computed(() => results.value.map((r) => r.month));
  const currentMonth = computed(() => months.value[monthIndex.value] ?? null);
  const monthLabel = computed(() => (currentMonth.value ? formatMonth(currentMonth.value) : ''));
  const range = computed(() => {
    const first = months.value[0];
    const last = months.value[months.value.length - 1];
    if (!first || !last) return '';
    return `Simulation sur ${months.value.length} mois · ${monthShort(first)} ${yearOf(first)} → ${monthShort(last)} ${yearOf(last)}`;
  });

  const canPrev = computed(() => monthIndex.value > 0);
  const canNext = computed(() => monthIndex.value < months.value.length - 1);
  const prev = () => { monthIndex.value = Math.max(0, monthIndex.value - 1); };
  const next = () => { monthIndex.value = Math.min(Math.max(0, months.value.length - 1), monthIndex.value + 1); };

  // « Poser chez » : tous les clients, ou un client facturé au TJM (le forfait ne baisse pas pendant les congés).
  const tjmClients = computed(() => treso.clients.filter((c) => c.billingMode === 'TJM'));
  const target = computed<LeaveTarget>(() =>
    targetKey.value !== 'ALL' && tjmClients.value.some((c) => c.id === targetKey.value)
      ? { scope: 'CLIENT', clientId: targetKey.value }
      : { scope: 'ALL' },
  );
  /** Clé du choix (« ALL » ou l’identifiant du client) : un client archivé ou supprimé redonne « Tous ». */
  const selectedTarget = computed(() => (target.value.scope === 'ALL' ? 'ALL' : target.value.clientId));
  /** Accepte la valeur d’un `ChoiceChips` (qui peut être une liste en sélection multiple) : on garde la première. */
  const setTarget = (key: string | string[]) => { targetKey.value = (Array.isArray(key) ? key[0] : key) ?? 'ALL'; };
  const targetOptions = computed(() => [
    { value: 'ALL', label: 'Tous' },
    ...tjmClients.value.map((c) => ({ value: c.id, label: c.name })),
  ]);
  /** Version courte du mobile (« A », « B ») : le nom complet reste le nom accessible. Deux clients de même lettre gardent leur nom. */
  const targetShortOptions = computed(() => {
    const letters = tjmClients.value.map((c) => clientLetter(c.name));
    return [
      { value: 'ALL', label: 'Tous' },
      ...tjmClients.value.map((c, i) => {
        const letter = letters[i] ?? '';
        return { value: c.id, label: letters.filter((l) => l === letter).length > 1 ? c.name : letter, ariaLabel: c.name };
      }),
    ];
  });

  const hasProspects = computed(() => treso.clients.some((c) => c.isProspect));
  const prospectLabel = computed(() => {
    const prospects = treso.clients.filter((c) => c.isProspect);
    return prospects.length === 1 ? `Compter la piste ${prospects[0]?.name ?? ''}`.trim() : 'Compter les pistes';
  });
  const toggleProspect = () => { includeProspect.value = !includeProspect.value; };

  function dayView(day: CalendarDay): DayView {
    const names = day.clientIds.map((id) => treso.clientById(id)?.name ?? 'Client');
    const first = treso.clientById(day.clientIds[0]);
    const kind: DayView['kind'] = day.weekend ? 'weekend' : day.holidayName ? 'holiday' : day.leaves.length ? 'leave' : names.length ? 'client' : 'free';
    const pending = pendingDates.has(day.date) || isTemporary(day.targetLeave?.id);
    const detail = { weekend: 'week-end', holiday: `${day.holidayName ?? ''} (férié)`, leave: 'vacances', client: names.join(', '), free: 'libre' }[kind];
    const tag = { weekend: '', holiday: day.holidayName ?? '', leave: 'Vacances', client: names.length > 1 ? `${names[0]} +${names.length - 1}` : (names[0] ?? ''), free: 'Libre' }[kind];
    const dayOfMonth = Number(day.date.slice(8, 10));
    return {
      date: day.date,
      day: dayOfMonth,
      inMonth: day.inMonth,
      weekend: day.weekend,
      holidayName: day.holidayName,
      clickable: day.clickable,
      pressed: day.targetLeave !== null,
      isLeave: day.leaves.length > 0,
      pending,
      kind,
      tag,
      color: first ? { base: PALETTE[first.color].base, soft: PALETTE[first.color].soft } : null,
      prospect: first?.isProspect ?? false,
      ariaLabel: `${WEEKDAY_LONG[weekday(day.date)]} ${dayOfMonth} ${monthName(monthKey(day.date))} ${yearOf(day.date)} : ${detail}`,
    };
  }

  const days = computed<DayView[]>(() => {
    const input = treso.input;
    const month = currentMonth.value;
    if (!input || !month) return [];
    return calendarMonth(input, month, target.value, { includeProspects: includeProspect.value }).map(dayView);
  });

  /** Clients du calendrier, pour la légende : ceux qui comptent dans la projection. */
  const legend = computed(() =>
    tjmClients.value
      .filter((c) => !c.isProspect || includeProspect.value)
      .map((c) => ({ key: c.id, label: c.isProspect ? `${c.name} (piste)` : c.name, color: PALETTE[c.color], prospect: c.isProspect })),
  );

  /** Fériés du mois affiché, pour l’écran mobile où les cases sont trop petites pour leur nom. */
  const holidayCaption = computed(() => {
    const list = days.value.filter((d) => d.inMonth && d.kind === 'holiday').map((d) => `${d.holidayName} (${shortDate(d.date)})`);
    return list.length ? `${list.length > 1 ? 'Jours fériés' : 'Jour férié'} : ${list.join(', ')}` : '';
  });

  async function toggleDay(day: DayView): Promise<void> {
    if (!day.clickable || pendingDates.has(day.date)) return;
    // On lit le store, pas la case : le congé créé à l’instant (`tmp-…`) n’est peut-être pas encore rendu (R26).
    const existing = treso.input?.leaves.find((l) => l.date === day.date && matchesTarget(l, target.value));
    if (isTemporary(existing?.id)) return;
    lastMessage.value = null;
    pendingDates.add(day.date);
    try {
      await treso.toggleLeave(day.date, target.value);
    } finally {
      pendingDates.delete(day.date);
    }
  }

  const periods = computed<PeriodView[]>(() => {
    const input = treso.input;
    if (!input) return [];
    const shown = new Set(months.value);
    return groupLeaves(input, { includeProspects: includeProspect.value }).map((p) => {
      const who = p.scope === 'ALL' ? 'tous clients' : (treso.clientById(p.clientId)?.name ?? 'un client');
      const visible = p.impacts.filter((i) => shown.has(i.cashMonth));
      // Les congés sans client ce jour-là n’ont aucun effet ; ceux dont l’argent tombe avant ou après les 15 mois n’y sont pas visibles.
      const impact = visible.length
        ? `Se voit en ${visible.map((i) => `${monthShort(i.cashMonth)} (${euros(-i.amount)})`).join(', ')}`
        : p.impacts.length ? 'Hors période simulée' : 'Sans effet sur ta tréso';
      return {
        key: p.key,
        title: p.from === p.to ? `${shortDate(p.from)} ${yearOf(p.from)}` : `${shortDate(p.from)} → ${shortDate(p.to)} ${yearOf(p.to)}`,
        sub: `${plural(p.dayCount, 'jour')} · ${who}`,
        cost: euros(-p.cost),
        impact,
        ariaLabel: `Supprimer les vacances du ${shortDate(p.from)}${p.scope === 'CLIENT' ? ` chez ${who}` : ''}`,
        leaveIds: p.leaveIds,
        pending: p.leaveIds.length === 0 || p.leaveIds.some(isTemporary),
      };
    });
  });

  /**
   * Supprime une période, puis garde toutes les corbeilles désactivées jusqu’à la fin de l’appel ET pendant au moins
   * `DELETE_LOCK_MS` : la suppression est optimiste et revient presque aussitôt, mais la liste se resserre tout de suite, et le
   * second clic d’un double appui tomberait sur la corbeille de la période suivante, remontée à sa place (R33).
   */
  async function deletePeriod(period: PeriodView): Promise<void> {
    if (period.pending || deleting.value) return;
    deleting.value = true;
    lastMessage.value = null;
    try {
      await Promise.all([treso.deleteLeaves(period.leaveIds), new Promise<void>((resolve) => setTimeout(resolve, DELETE_LOCK_MS))]);
    } finally {
      deleting.value = false;
    }
  }

  /** « Ajouter et simuler » : la période est posée chez `who`, le message dit ce qu’elle coûte, le calendrier saute à son premier mois. */
  async function addPeriod(from: ISODate | null, to: ISODate | null, who: LeaveTarget = target.value): Promise<void> {
    if (adding.value) return;
    const fail = (text: string) => { lastMessage.value = { text, tone: 'error' }; };
    if (!from) return fail('Choisis la date de début.');
    const end = to ?? from;
    if (end < from) return fail('La date de fin ne peut pas être avant la date de début.');
    if (diffDays(from, end) > 366) return fail('Pose tes congés sur une année au plus.');
    if (workingDaysBetween(from, end).length === 0) {
      return fail(end === from ? 'Ce jour n’est pas ouvré : impossible d’y poser un congé.' : 'Aucun jour ouvré sur cette période.');
    }
    lastMessage.value = null;
    adding.value = true;
    try {
      // Le coût suit « Compter la piste » de cet écran, pas le profil.
      const res = await treso.addLeaves(
        { from, to: end, scope: who.scope, clientId: who.scope === 'CLIENT' ? who.clientId : null },
        { includeProspects: includeProspect.value },
      );
      if (!res) return; // l’API a refusé : le store a déjà prévenu et rechargé
      lastMessage.value = {
        text: res.created === 0 ? 'Ces jours étaient déjà posés.' : `${plural(res.created, 'jour')} ${res.created > 1 ? 'ajoutés' : 'ajouté'} : ${euros(-res.cost)} encaissés`,
        tone: res.created === 0 ? 'info' : 'ok',
      };
      const at = months.value.indexOf(monthKey(from));
      if (at >= 0) monthIndex.value = at;
    } finally {
      adding.value = false;
    }
  }

  const kpis = computed<{ days: KpiView; lost: KpiView; low: KpiView; risk: KpiView }>(() => {
    const k = treso.input ? leaveKpis(treso.input, results.value) : null;
    const overdraft = (k?.overdraftCount ?? 0) > 0;
    const lowest = k?.lowestBalance ?? 0;
    const riskSub = overdraft
      ? `${k?.overdraftCount} à découvert`
      : (k?.dueToLeavesCount ?? 0) > 0 ? `${k?.dueToLeavesCount} à cause des vacances` : (k?.riskCount ?? 0) > 0 ? 'à cause des délais' : 'aucun';
    return {
      days: { value: `${k?.dayCount ?? 0} j`, sub: plural(periods.value.length, 'période'), tone: 'warn' },
      lost: { value: euros(-(k?.lostIncome ?? 0)), sub: 'encaissé en moins, plus tard', tone: 'info' },
      low: {
        value: euros(lowest),
        sub: k?.lowestBalanceMonth ? `en ${formatMonth(k.lowestBalanceMonth)}` : '',
        tone: lowest < 0 ? 'danger' : 'positive',
        valueColor: lowest < 0 ? 'var(--danger)' : undefined,
      },
      risk: {
        value: String(k?.riskCount ?? 0),
        sub: riskSub,
        tone: overdraft ? 'danger' : (k?.riskCount ?? 0) > 0 ? 'warn' : 'positive',
        valueColor: overdraft ? 'var(--danger)' : undefined,
      },
    };
  });

  const alert = computed<AlertView>(() => {
    const list = (state: MonthState) => results.value.filter((r) => r.state === state).map((r) => formatMonth(r.month)).join(', ');
    const has = (state: MonthState) => results.value.some((r) => r.state === state);
    const make = (tone: AlertView['tone'], text: string): AlertView => ({ tone, text, style: ALERT_STYLE[tone] });
    if (has('OVERDRAFT')) return make('danger', `Attention : avec tes vacances, le compte passe à découvert en ${list('OVERDRAFT')}.`);
    if (has('RED_DUE_TO_LEAVES')) {
      const lowest = Math.min(...results.value.map((r) => r.balance));
      return make('red', `Tes vacances font passer ${list('RED_DUE_TO_LEAVES')} dans le rouge : les rentrées ne couvrent plus les charges. Ton solde absorbe, il ne descend jamais sous ${euros(lowest)}.`);
    }
    if (has('RED')) return make('warn', `${list('RED')} dans le rouge, même sans vacances, à cause des délais de paiement. Ton solde absorbe.`);
    return make('positive', 'Tous les mois restent dans le positif, vacances comprises.');
  });

  /** Libellé court d’une colonne : « oct. 26 » pour le premier mois et chaque janvier, « nov. » sinon. */
  const columnLabel = (r: MonthResult, i: number): string => monthShort(r.month) + (r.month.endsWith('-01') || i === 0 ? ` ${r.month.slice(2, 4)}` : '');

  const impactColumns = computed(() =>
    results.value.map((r, i) => ({
      label: columnLabel(r, i),
      without: r.resultWithoutLeaves,
      with: r.result,
      highlight: r.state === 'RED_DUE_TO_LEAVES',
      valueLabel: kEuros(r.result),
      aria: `${formatMonth(r.month)} : ${euros(r.result, { sign: true })} avec vacances, ${euros(r.resultWithoutLeaves, { sign: true })} sans`,
    })),
  );

  const tableRows = computed<MonthRowView[]>(() =>
    results.value.map((r) => {
      const style = STATE_STYLE[r.state];
      return {
        key: r.month,
        month: formatMonth(r.month),
        base: euros(r.incomeWithoutLeaves),
        withLeaves: euros(r.income),
        cost: r.leaveCost > 0 ? euros(-r.leaveCost) : '—',
        charges: euros(-r.charges),
        chargeNote: r.chargeItems.filter((c) => c.frequency !== 'MONTHLY').map((c) => c.name).join(', '),
        result: euros(r.result, { sign: true }),
        resultNegative: r.result < 0,
        balance: euros(r.balance),
        balanceNegative: r.balance < 0,
        badge: { label: style.label, bg: style.badgeBg, fg: style.badgeInk },
        rowBg: r.state === 'OVERDRAFT' ? '#FDEBE9' : r.state === 'RED_DUE_TO_LEAVES' ? '#FFF1E3' : null,
      };
    }),
  );

  /** Mobile : les 15 mois en barres d’une lettre, avec les mois que les vacances font passer dans le rouge surlignés. */
  const miniBars = computed(() =>
    results.value.map((r) => ({
      key: r.month,
      label: monthLetter(r.month),
      valueLabel: kEuros(r.result),
      value: r.result,
      aria: `${formatMonth(r.month)} : ${euros(r.result, { sign: true })}`,
      selected: false,
    })),
  );
  const litMonths = computed(() => results.value.filter((r) => r.state === 'RED_DUE_TO_LEAVES').map((r) => r.month));

  const impactedMonths = computed<ImpactedMonthView[]>(() =>
    results.value
      .filter((r) => r.leaveCost !== 0 || r.result < 0 || r.state === 'OVERDRAFT')
      .map((r) => ({
        key: r.month,
        month: formatMonth(r.month),
        sub: r.leaveCost > 0 ? `vacances : ${euros(-r.leaveCost)}` : r.result < 0 ? 'creux lié aux délais de paiement' : 'compte encore à découvert',
        amount: euros(r.result, { sign: true }),
        negative: r.result < 0,
        badge: mobileBadge(r.state),
      })),
  );

  return {
    monthIndex, months, monthLabel, range, canPrev, canNext, prev, next,
    target, selectedTarget, setTarget, targetOptions, targetShortOptions,
    days, legend, holidayCaption, toggleDay,
    kpis, alert, impactColumns, tableRows, miniBars, litMonths, impactedMonths,
    periods, deletePeriod, deleting,
    includeProspect, hasProspects, prospectLabel, toggleProspect,
    addPeriod, adding, lastMessage,
  };
}
