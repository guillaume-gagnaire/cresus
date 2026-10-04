import { addMonths, ceilingGauge, euros, eurosExact, microMonths, monthLabel, monthLetter, monthName, monthShort, paramsFor, smoothedIncome, testMissionClient, yearOf } from '@matreso/engine';

/** Carte « À mettre de côté » du mois sélectionné, déjà formatée. */
export type MicroSetAside = NonNullable<ReturnType<typeof useMicroDashboard>['setAside']['value']>;
/** Jauge du plafond de CA de l’année choisie, déjà formatée (`level` et couleurs viennent du moteur). */
export type MicroGauge = NonNullable<ReturnType<typeof useMicroDashboard>['gauge']['value']>;

/** « 26,1 % » : taux du moteur (0,261), espace insécable avant le signe. */
const percent = (rate: number): string => `${(rate * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;

export function useMicroDashboard() {
  const treso = useTresoStore();
  const index = ref(0);
  const testMission = ref(false);
  const year = ref(yearOf(treso.today));

  const months = computed(() => (treso.input ? microMonths(treso.input) : []));
  const current = computed(() => months.value[index.value] ?? null);
  const smoothed = computed(() => smoothedIncome(months.value));
  const max = computed(() => Math.max(0, months.value.length - 1));
  const select = (i: number) => { index.value = Math.min(max.value, Math.max(0, i)); };
  /** Mois bas : sous 60 % de la moyenne lissée. Sans moyenne positive (aucun encaissement), aucun mois n’est « bas ». */
  const isLow = (month: string): boolean => smoothed.value.average > 0 && smoothed.value.lowMonths.includes(month);

  const split = computed(() => {
    const b = current.value?.breakdown;
    if (!b) return [];
    return [
      { label: 'Cotisations', value: b.contributions, color: '#FF8A3D', display: euros(b.contributions) },
      { label: 'Impôt', value: b.tax, color: '#9B6BFF', display: euros(b.tax) },
      { label: 'Frais pro', value: b.proExpenses, color: '#B9B2CC', display: euros(b.proExpenses) },
      { label: 'Pour toi', value: Math.max(0, b.forYou), color: '#2E9E6A', display: euros(b.forYou) },
    ];
  });
  /** Base de 100 % de la barre : la somme des parts (= l’encaissement, ou davantage quand les frais dépassent ce qui rentre). */
  const splitTotal = computed(() => split.value.reduce((sum, s) => sum + s.value, 0));

  const tiles = computed(() => {
    const m = current.value;
    return m
      ? { forYou: euros(m.breakdown.forYou), income: `sur ${euros(m.breakdown.income)} encaissés`, low: isLow(m.month), monthLabel: monthLabel(m.month) }
      : null;
  });

  const setAside = computed(() => {
    const m = current.value;
    if (!m || !treso.profile) return null;
    const next = addMonths(m.month, 1);
    const vl = treso.profile.microVersementLiberatoire;
    return {
      contributions: { title: 'Cotisations URSSAF', sub: `Déclarées et payées fin ${monthName(next)}`, amount: euros(m.breakdown.contributions) },
      tax: { title: vl ? 'Versement libératoire' : 'Impôt sur le revenu', sub: vl ? 'Payé avec tes cotisations' : 'À garder pour ta déclaration au printemps', amount: euros(m.breakdown.tax) },
      versementLiberatoire: vl,
      versementLiberatoireRate: percent(paramsFor(yearOf(m.month)).microVersementLiberatoireRate),
      provisionPct: treso.profile.microIncomeTaxProvisionPct,
    };
  });

  const years = computed(() => [yearOf(treso.today), yearOf(treso.today) + 1]);

  const gauge = computed(() => {
    if (!treso.input) return null;
    const g = ceilingGauge(treso.input, year.value, { testMission: testMission.value });
    const scale = Math.max(g.ceiling * 1.1, g.total);
    const color = g.level === 'OVER' ? '#E5484D' : g.level === 'WARN' ? '#E0A800' : '#2E9E6A';
    const soft = g.level === 'OVER' ? '#FBD2CE' : g.level === 'WARN' ? '#FFF1B8' : '#CDEBD8';
    const message =
      g.level === 'OVER'
        ? `Au rythme prévu, tu dépasses le plafond en ${monthLabel(g.overMonth!)} (${g.pct} %). Si ça se répète deux années de suite, tu sors du régime micro : anticipe le passage en société.`
        : g.level === 'WARN'
          ? `Tu frôles le plafond : ${g.pct} % prévus sur ${g.year}. Garde un œil dessus.`
          : `Tranquille : ${g.pct} % du plafond prévus sur ${g.year}.`;
    const vat = g.vatMonth
      ? `Seuil de franchise de TVA dépassé en ${monthLabel(g.vatMonth)} : tu devras facturer la TVA en plus de tes prix, tout de suite ou l’année suivante selon le montant.`
      : 'Sous le seuil de franchise de TVA : tu factures sans TVA.';
    return {
      total: euros(g.total), ceiling: euros(g.ceiling), level: g.level, color, soft, message, vat,
      actualPct: (g.actual / scale) * 100, plannedPct: (g.planned / scale) * 100, vatPct: (g.vatThreshold / scale) * 100,
      aria: `Plafond ${g.year} : ${euros(g.total)} sur ${euros(g.ceiling)}, ${g.pct} %`,
    };
  });

  /** « Tester une mission en plus » : le jour, le tarif et le mois viennent de la mission d’essai du moteur (dès le mois suivant). */
  const testMissionLabel = computed(() => {
    const test = testMissionClient(treso.today);
    return `Tester une mission en plus : ${WEEKDAY_LONG[test.weekdays[0] ?? 0]}, ${eurosExact(test.rates[0]!.amount)}/j, dès ${monthName(addMonths(treso.currentMonth, 1))}`;
  });

  const bars = computed(() =>
    months.value.map((m, i) => ({
      key: m.month,
      label: monthShort(m.month) + (m.month.endsWith('-01') || i === 0 ? ` ${m.month.slice(2, 4)}` : ''),
      letter: monthLetter(m.month),
      value: Math.max(0, m.breakdown.forYou),
      low: isLow(m.month),
      aria: `${monthLabel(m.month)} : ${euros(m.breakdown.forYou)} pour toi`,
      selected: i === index.value,
    })),
  );

  /** Hypothèses affichées en pied de page : les taux, plafond et seuil sont ceux du moteur pour l’année de la jauge. */
  const notes = computed(() => {
    const p = paramsFor(year.value);
    const frais = treso.profile ? eurosExact(treso.profile.microProExpensesMonthly) : null;
    return {
      long: `Taux simplifiés : cotisations ${percent(p.microContributionRate)} du CA (prestations de services), versement libératoire ${percent(p.microVersementLiberatoireRate)}${frais ? `, frais pro ${frais}/mois` : ''}. Plafond ≈ ${euros(p.microCeiling)} et seuil de TVA ≈ ${euros(p.vatThreshold)} à vérifier.`,
      short: `Taux simplifiés : ${percent(p.microContributionRate)} de cotisations, plafond ≈ ${euros(p.microCeiling)}, seuil de TVA ≈ ${euros(p.vatThreshold)}, à vérifier.`,
    };
  });

  return {
    index, select, prev: () => select(index.value - 1), next: () => select(index.value + 1),
    canPrev: computed(() => index.value > 0), canNext: computed(() => index.value < max.value),
    split, splitTotal, tiles, setAside, years, year, setYear: (y: number) => { year.value = y; },
    gauge, testMission, testMissionLabel, toggleTestMission: () => { testMission.value = !testMission.value; },
    smoothed: computed(() => ({
      average: smoothed.value.average,
      amount: euros(smoothed.value.average),
      label: `Revenu lissé sur 12 mois : ${euros(smoothed.value.average)} / mois`,
    })),
    bars, notes,
  };
}
