import {
  ceilingGauge, type ChargeInput, type ChargeItem, chargesSummary, COMPUTED_NET_ID, euros, eurosExact, LEGAL_STATUS_LABELS, LEGAL_STATUSES,
  type LegalStatus, MONTHS_LONG, monthlyEquivalent, paramsFor, plural, REGIME_OF, remunerationComparison, remunerationCost, remunerationLines,
  type SocialRegime, yearOf,
} from '@matreso/engine';

export type PeriodMode = 'MONTH' | 'YEAR';

/** L’équation « Net + Cotisations = Coût » de la carte « Ta rémunération », déjà formatée (Charges.dc.html l. 73 à 84). */
export interface CostView {
  /** « Salaire net par mois » : la question change avec le régime. */
  netLabel: string;
  /** Version courte du mobile : « Salaire net / mois ». */
  netLabelShort: string;
  /** Intitulé de la tuile du net : « Salaire net » ou « Pour toi ». */
  netShort: string;
  net: string;
  contributions: string;
  /** « ≈ 80 % du net », « 26,1 % du CA ». */
  contributionsSub: string;
  /** Version courte du mobile : « ≈ 80 % », « 26,1 % du CA ». */
  contributionsShort: string;
  totalLabel: string;
  total: string;
  yearly: string;
}

export interface ComparisonView {
  regime: SocialRegime;
  label: string;
  /** Statuts juridiques concernés : « SASU, SAS, SASU à l’IR ». */
  sub: string;
  value: string;
  /** Le régime du statut choisi, mis en avant. */
  current: boolean;
}

/** Une ligne du tableau (desktop) ou de la liste (mobile) : une ligne calculée en lecture seule, ou une charge saisie. */
export interface ChargeRowView {
  id: string;
  name: string;
  icon: IconName;
  /** Ligne de rémunération calculée par le moteur : pas de saisie, pas de suppression. */
  computed: boolean;
  /** Charge pas encore confirmée par le serveur (`tmp-…`) : on ne la modifie ni ne la supprime (R26). */
  pending: boolean;
  /** « Chaque mois · calculé », « Chaque mois », « Une fois par an · mars ». */
  frequency: string;
  /** Mobile : la fréquence, suivie du montant entre parenthèses pour une charge annuelle. */
  detail: string;
  /** Montant saisi, en centimes. */
  amountCents: number;
  /** Montant saisi, lisible (la ligne calculée est arrondie à la dizaine, comme la carte ; une saisie reste à l’euro près). */
  amount: string;
  /** Montant mensualisé : les charges annuelles lissées sur 12 mois. */
  monthly: string;
  /** Montant du mobile, selon « Par mois » ou « Par an ». */
  shown: string;
  editLabel: string;
  deleteLabel: string;
}

const isTemporary = (id: string): boolean => id.startsWith('tmp-');

const STATUS_HELP: Readonly<Record<Exclude<LegalStatus, 'MICRO'>, string>> = {
  SASU: 'Président assimilé salarié : régime général (sans chômage). Plus cher, mais mieux protégé.',
  SAS: 'Comme la SASU, avec plusieurs associés : le président est assimilé salarié.',
  SASU_IR: 'Option de 5 ans maximum. Ton salaire coûte autant qu’en SASU ; le bénéfice est imposé directement à ton impôt sur le revenu.',
  SARL: 'Gérant majoritaire : indépendant (TNS). Si tu es minoritaire ou égalitaire, tu es assimilé salarié, comme en SAS.',
  EURL_IS: 'Gérant indépendant (TNS) : moins de cotisations, protection plus légère.',
  EURL_IR: 'Pas de salaire : tu prélèves ce que tu veux. Les cotisations TNS portent sur tout le bénéfice, imposé à ton impôt sur le revenu.',
  EI: 'Même logique que l’EURL à l’IR, sans créer de société : cotisations TNS sur le bénéfice, impôt sur le revenu.',
};

const NET_LABEL: Readonly<Record<SocialRegime, { long: string; short: string }>> = {
  SALARIE: { long: 'Salaire net par mois', short: 'Salaire net / mois' },
  TNS: { long: 'Ce que tu te verses par mois (net)', short: 'Tu te verses / mois' },
  MICRO: { long: 'Ce que tu veux garder par mois', short: 'Tu gardes / mois' },
};

/** Statuts de chaque régime, tels que la maquette les nomme sous la comparaison. */
const REGIME_STATUSES: Readonly<Record<SocialRegime, string>> = {
  SALARIE: 'SASU, SAS, SASU à l’IR',
  TNS: 'SARL, EURL, EI',
  MICRO: 'micro',
};

/**
 * Modèle de vue de « Tes charges » (Charges.dc.html, script l. 124 à 234 ; Mobile-Charges.dc.html, script l. 83 à 181) :
 * la rémunération et son coût, les deux chiffres, puis les lignes (calculées d’abord, saisies ensuite). Aucun calcul métier
 * ici : taux, coûts, totaux et jauge du plafond viennent du moteur, avec les paramètres de l’année en cours.
 */
export function useExpensesView() {
  const treso = useTresoStore();

  const year = computed(() => yearOf(treso.today));
  const params = computed(() => paramsFor(year.value));

  const statuses = LEGAL_STATUSES.map((value) => ({ value, label: LEGAL_STATUS_LABELS[value] }));
  const status = computed<LegalStatus>(() => treso.profile?.legalStatus ?? 'SASU');
  const regime = computed(() => REGIME_OF[status.value]);

  /** Choisir « Micro » passe par le store, qui retient le statut de société quitté pour le retrouver au retour. */
  function setStatus(value: LegalStatus | LegalStatus[]): void {
    const next = Array.isArray(value) ? value[0] : value;
    if (!next || next === status.value || !LEGAL_STATUSES.includes(next)) return;
    void (next === 'MICRO' ? treso.setCompanyMode('MICRO') : treso.updateProfile({ legalStatus: next }));
  }

  const statusHelp = computed(() =>
    status.value === 'MICRO'
      ? `Cotisations : ${percent(params.value.microContributionRate * 100)} de ce que tu encaisses, sans déduire tes charges. Plafond de CA d’environ ${euros(params.value.microCeiling)} par an pour les services.`
      : STATUS_HELP[status.value],
  );

  // Pendant que le curseur glisse, `draft` montre le net voulu sans écrire : l’enregistrement part au relâchement, pas en rafale.
  const draft = ref<number | null>(null);
  const net = computed(() => draft.value ?? treso.profile?.netPayMonthly ?? 0);
  const previewNet = (cents: number) => { draft.value = cents; };
  async function setNet(cents: number): Promise<void> {
    draft.value = null;
    if (cents === treso.profile?.netPayMonthly) return;
    await treso.updateProfile({ netPayMonthly: cents });
  }

  /** Le profil avec le net affiché : les lignes calculées et les totaux suivent le curseur en direct. */
  const shownProfile = computed(() => (treso.input ? { ...treso.input.profile, netPayMonthly: net.value } : null));

  const cost = computed<CostView>(() => {
    const c = remunerationCost(net.value, status.value, params.value);
    const p = params.value;
    // Part de cotisations : `coef − 1` du net en société, un taux du CA en micro.
    const share = regime.value === 'MICRO' ? null : `≈ ${percent(((regime.value === 'SALARIE' ? p.salarieCoef : p.tnsCoef) - 1) * 100)}`;
    const microRate = `${percent(p.microContributionRate * 100)} du CA`;
    return {
      netLabel: NET_LABEL[regime.value].long,
      netLabelShort: NET_LABEL[regime.value].short,
      netShort: regime.value === 'SALARIE' ? 'Salaire net' : 'Pour toi',
      net: euros(c.net),
      contributions: euros(c.contributions),
      contributionsSub: share === null ? microRate : `${share} du net`,
      contributionsShort: share ?? microRate,
      totalLabel: c.totalLabel,
      total: euros(c.total),
      yearly: euros(c.total * 12),
    };
  });

  const comparison = computed<ComparisonView[]>(() =>
    remunerationComparison(net.value, params.value).map((c) => ({
      regime: c.regime,
      label: c.label,
      sub: REGIME_STATUSES[c.regime],
      value: euros(c.total),
      current: c.regime === regime.value,
    })),
  );

  /** Le plafond de la micro est dépassé cette année : ce statut n’est pas possible (alerte rouge de la maquette, seulement en micro). */
  const microAlert = computed(() => {
    if (status.value !== 'MICRO' || !treso.input) return null;
    const gauge = ceilingGauge(treso.input, year.value);
    if (gauge.level !== 'OVER') return null;
    const revenue = euros(Math.round(gauge.total / 100_000) * 100_000); // « environ » : au millier d’euros
    return {
      text: `Avec ton CA actuel (environ ${revenue} par an), tu dépasses le plafond de la micro-entreprise : ce régime n’est pas possible pour toi.`,
      short: `Avec ton CA actuel (~${revenue}/an), tu dépasses le plafond micro.`,
    };
  });

  /**
   * Détail des hypothèses sous la mention d’estimation (Charges.dc.html l. 93, Mobile-Charges.dc.html l. 70) : les taux sont ceux
   * de l’année. La mention elle-même (« Estimation simplifiée, à affiner avec ton expert-comptable. ») est celle de `EstimateNote`.
   */
  const assumptions = computed(() => {
    const p = params.value;
    return {
      long: `Cotisations ≈ ${percent((p.salarieCoef - 1) * 100)} du net en assimilé salarié, ≈ ${percent((p.tnsCoef - 1) * 100)} en TNS, ${percent(p.microContributionRate * 100)} du CA en micro (prestations de services). L’impôt sur le revenu n’est pas compté.`,
      short: 'Impôt sur le revenu non compté.',
    };
  });

  const periodMode = ref<PeriodMode>('MONTH');
  const periodOptions = [
    { value: 'MONTH' as const, label: 'Par mois' },
    { value: 'YEAR' as const, label: 'Par an' },
  ];
  const setPeriodMode = (mode: PeriodMode | PeriodMode[]) => { periodMode.value = (Array.isArray(mode) ? mode[0] : mode) ?? 'MONTH'; };

  const frequencyLabel = (item: ChargeItem): string => {
    if (item.computed) return 'Chaque mois · calculé';
    if (item.frequency === 'MONTHLY') return 'Chaque mois';
    return item.month === null ? 'Une fois par an' : `Une fois par an · ${MONTHS_LONG[item.month]}`;
  };

  function rowView(item: ChargeItem): ChargeRowView {
    // La ligne calculée est une estimation arrondie à la dizaine, comme la carte ; une charge saisie reste exacte à l’euro près.
    const format = item.computed ? euros : eurosExact;
    const frequency = frequencyLabel(item);
    const monthly = monthlyEquivalent(item);
    const annual = item.frequency === 'MONTHLY' ? item.amount * 12 : item.amount;
    // Pour le net des statuts sans salaire, la maquette dit « Ta rémunération (net) ».
    const name = item.id === COMPUTED_NET_ID && regime.value !== 'SALARIE' ? 'Ta rémunération (net)' : item.name;
    return {
      id: item.id,
      name,
      icon: categoryIcon(item.category),
      computed: item.computed,
      pending: isTemporary(item.id),
      frequency,
      detail: item.frequency === 'YEARLY' && !item.computed ? `${frequency} (${format(item.amount)})` : frequency,
      amountCents: item.amount,
      amount: format(item.amount),
      monthly: format(monthly),
      shown: format(periodMode.value === 'MONTH' ? monthly : annual),
      editLabel: `Montant de ${name}`,
      deleteLabel: `Supprimer ${name}`,
    };
  }

  const rows = computed<ChargeRowView[]>(() => {
    const input = treso.input;
    const profile = shownProfile.value;
    if (!input || !profile) return [];
    const stored: ChargeItem[] = input.charges.map((c) => ({ ...c, computed: false }));
    return [...remunerationLines(profile, params.value), ...stored].map(rowView);
  });

  const kpis = computed(() => {
    const input = treso.input;
    const profile = shownProfile.value;
    const summary = input && profile ? chargesSummary(input.charges, profile, year.value) : { monthlyAverage: 0, annualTotal: 0 };
    return { average: euros(summary.monthlyAverage), yearly: euros(summary.annualTotal), count: plural(rows.value.length, 'charge') };
  });

  const total = computed(() =>
    periodMode.value === 'MONTH'
      ? { label: 'Chaque mois, en moyenne', value: kpis.value.average }
      : { label: 'Sur un an', value: kpis.value.yearly },
  );

  /** En micro, les cotisations sont un pourcentage de ce qui rentre : le moteur ne les ajoute pas aux charges. */
  const note = computed(() =>
    status.value === 'MICRO' ? 'En micro-entreprise, tes cotisations sont prélevées sur ce que tu encaisses : elles ne figurent pas dans cette liste.' : '',
  );

  const addCharge = (input: ChargeInput) => treso.addCharge(input);

  async function updateAmount(row: ChargeRowView, cents: number): Promise<void> {
    if (row.computed || row.pending || cents === row.amountCents) return; // R26 : jamais d’appel avec un identifiant `tmp-`
    await treso.updateCharge(row.id, { amount: cents });
  }

  /** Une suppression est en cours : toutes les corbeilles attendent (le double appui viserait sinon la ligne qui vient de remonter, R33). */
  const { locked: deleting, run: runDelete } = useDeleteLock();
  async function removeCharge(row: ChargeRowView): Promise<void> {
    if (row.computed || row.pending) return;
    await runDelete(() => treso.deleteCharge(row.id));
  }

  return {
    statuses, status, setStatus, statusHelp, net, setNet, previewNet, cost, comparison, microAlert, assumptions,
    kpis, rows, note, periodMode, periodOptions, setPeriodMode, total,
    addCharge, updateAmount, removeCharge, deleting,
  };
}
