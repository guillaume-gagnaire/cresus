import { euros, invoiceLabel, kEuros, longDate, monthLabel, monthLetter, monthShort } from '@matreso/engine';

/** Carte verdict du mois sélectionné, déjà formatée (montants avec leur signe : « +6 600 € », « −2 310 € », « 0 € »). */
export type CompanyVerdict = NonNullable<ReturnType<typeof useCompanyDashboard>['verdict']['value']>;

export function useCompanyDashboard() {
  const treso = useTresoStore();
  const index = ref(0);
  const max = computed(() => Math.max(0, treso.results.length - 1));
  const current = computed(() => treso.results[index.value] ?? null);

  const select = (i: number) => { index.value = Math.min(max.value, Math.max(0, i)); };
  const prev = () => select(index.value - 1);
  const next = () => select(index.value + 1);

  const verdict = computed(() => {
    const r = current.value;
    if (!r) return null;
    const positive = r.result >= 0;
    const overdrawn = r.balance < 0;
    // Le titre et la phrase suivent l’état du mois (donc la couleur de la carte) : un mois positif mais encore à découvert n’est pas « dans le positif ».
    const title = overdrawn && positive ? 'Ton compte est à découvert' : positive ? 'Tu es dans le positif' : 'Tu es dans le rouge ce mois-ci';
    let sentence: string;
    if (overdrawn) {
      sentence = positive
        ? 'Tes rentrées couvrent tes charges ce mois-ci, mais le compte reste à découvert après les mois précédents.'
        : 'Ton solde ne suffit pas : le compte passe à découvert.';
    } else if (positive) {
      sentence = 'Tes rentrées couvrent toutes tes charges, et il te reste ce montant en plus.';
    } else {
      sentence = `Il manque ce montant pour couvrir tes charges, mais ton solde absorbe le choc : il reste ${euros(r.balance)} sur le compte.`;
    }
    if (r.state === 'RED_DUE_TO_LEAVES') sentence += ' Sans tes vacances, ce mois serait dans le positif.';
    return {
      month: r.month,
      monthLabel: monthLabel(r.month),
      state: r.state,
      style: STATE_STYLE[r.state],
      title,
      result: euros(r.result, { sign: true }),
      sentence,
      // Le signe est dans la chaîne (et non ajouté par le gabarit) : un mois sans rentrée ni charge affiche « 0 € », jamais « +0 € » ou « −0 € ».
      income: euros(r.income, { sign: true }),
      charges: euros(-r.charges),
      balance: euros(r.balance),
    };
  });

  const incomeRows = computed(() =>
    (current.value?.entries ?? []).map((e) => {
      const client = treso.clientById(e.clientId);
      return {
        key: `${e.clientId}-${e.workMonth}`,
        name: client?.name ?? 'Client',
        color: client ? PALETTE[client.color].base : 'var(--muted)',
        sub: invoiceLabel(e, client?.billingMode ?? 'TJM'),
        amount: euros(e.amount, { sign: true }),
        lost: e.leaveCost > 0 ? `−${euros(e.leaveCost)} de vacances déjà retirés` : null,
      };
    }),
  );

  const chargeRows = computed(() =>
    (current.value?.chargeItems ?? []).map((c) => ({
      key: c.id,
      name: c.name,
      sub: c.frequency === 'MONTHLY' ? 'Chaque mois' : 'Une fois par an',
      amount: euros(-c.amount),
      computed: c.computed,
    })),
  );

  const bars = computed(() =>
    treso.results.map((r, i) => ({
      key: r.month,
      label: monthShort(r.month) + (r.month.endsWith('-01') || i === 0 ? ` ${r.month.slice(2, 4)}` : ''),
      letter: monthLetter(r.month),
      valueLabel: kEuros(r.result),
      value: r.result,
      aria: `${monthLabel(r.month)} : ${euros(r.result, { sign: true })}`,
      selected: i === index.value,
      state: r.state,
    })),
  );

  const summary = computed(() => {
    const tone: 'danger' | 'warn' | 'positive' = treso.summary.overdraftCount > 0 ? 'danger' : treso.summary.redCount > 0 ? 'warn' : 'positive';
    // `short` : version de l’accueil mobile (« 6 mois dans le rouge »), où la ligne d’en-tête est étroite.
    const short = treso.summary.overdraftCount === 0 && treso.summary.redCount > 0 ? `${treso.summary.redCount} mois dans le rouge` : treso.summary.text;
    return { text: treso.summary.text, short, tone };
  });

  const greeting = computed(() => `Salut ${treso.profile?.firstName ?? ''} !`);
  const todayLabel = computed(() => `Aujourd’hui, ${longDate(treso.today)}`);

  return { index, select, prev, next, canPrev: computed(() => index.value > 0), canNext: computed(() => index.value < max.value), verdict, incomeRows, chargeRows, bars, summary, greeting, todayLabel };
}
