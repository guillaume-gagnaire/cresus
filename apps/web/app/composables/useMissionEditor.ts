import {
  type BillingMode, type ClientColor, type ClientPatch, firstDayOfMonth, type ISODate, monthKey, PAYMENT_TERM_KEYS, PAYMENT_TERMS, type PaymentTerm,
} from '@matreso/engine';
import type { MaybeRefOrGetter } from 'vue';

type Fields = {
  billingMode: BillingMode;
  weekdays: number[];
  startDate: ISODate;
  endDate: ISODate | null;
  paymentTerm: PaymentTerm;
  averageDelayDays: number;
};

const MODES = [
  { value: 'TJM', label: 'Au temps passé' },
  { value: 'FORFAIT', label: 'Forfait mensuel' },
] as const;

/**
 * Logique d’édition d’une mission, partagée par la fiche desktop (`MissionPanel`) et la fiche poussée du mobile
 * (`MissionDetailMobile`) : chaque écran n’apporte que sa mise en page.
 * `clientId` vaut `'new'` pour le formulaire de création. Sur une mission existante, chaque modification part tout de suite
 * (champ par champ, au `change`) : le store applique le changement, appelle l’API, et recharge l’état si elle refuse (par
 * exemple `END_BEFORE_START`). En création, les mêmes champs remplissent un brouillon local, envoyé en une fois par `create()`.
 * Les champs d’identité (nom, sous-titre, couleur, piste ou signée) sont modifiables dans les deux modes.
 * À appeler depuis le `setup` d’un composant (watchers, `useId`).
 */
export function useMissionEditor(clientId: MaybeRefOrGetter<string | 'new'>) {
  const treso = useTresoStore();
  const toast = useToast();
  const id = (): string => toValue(clientId);
  const isNew = computed(() => id() === 'new');
  const view = useClientsView(computed(() => (isNew.value ? null : id())));
  const { panel } = view;

  /** Brouillon du formulaire de création : début au 1er du mois courant, sans fin, 30 jours, aucun retard. */
  const draft = reactive<Fields & { color: ClientColor; amount: number | null; isProspect: boolean }>({
    color: nextColor(treso.clients.map((c) => c.color)),
    amount: null,
    isProspect: false,
    billingMode: 'TJM',
    weekdays: [],
    startDate: firstDayOfMonth(monthKey(treso.today)),
    endDate: null,
    paymentTerm: 'NET_30',
    averageDelayDays: 0,
  });

  const fields = computed<Fields | null>(() => (isNew.value ? draft : panel.value));
  const color = computed(() => (isNew.value ? PALETTE[draft.color] : panel.value?.color ?? PALETTE.indigo));

  function change(patch: ClientPatch): void {
    if (isNew.value) Object.assign(draft, patch);
    else void treso.updateClient(id(), patch);
  }

  // --- Identité : nom (obligatoire), sous-titre, couleur, piste ou signée.
  // Le texte est local et part au `change` (ou à la sortie du champ, ou sur Entrée) ; un nom vidé reprend le nom enregistré.
  const nameText = ref(panel.value?.name ?? '');
  const subtitleText = ref(panel.value?.subtitle ?? '');
  watch(() => panel.value?.name, (name) => { nameText.value = name ?? ''; });
  watch(() => panel.value?.subtitle, (subtitle) => { subtitleText.value = subtitle ?? ''; });

  function commitName(): void {
    const name = nameText.value.trim();
    if (!isNew.value && !name) {
      nameText.value = panel.value?.name ?? '';
      return;
    }
    nameText.value = name;
    if (!isNew.value && name !== panel.value?.name) change({ name });
  }
  function commitSubtitle(): void {
    const subtitle = subtitleText.value.trim();
    subtitleText.value = subtitle;
    if (!isNew.value && subtitle !== panel.value?.subtitle) change({ subtitle: subtitle || null });
  }

  const colorOptions = Object.entries(PALETTE).map(([value, p]) => ({ value: value as ClientColor, label: p.label, ariaLabel: p.label, color: { bg: p.base, fg: p.fg } }));
  const colorKey = computed({
    get: (): ClientColor => (isNew.value ? draft.color : panel.value?.colorKey ?? 'indigo'),
    set: (value: ClientColor | ClientColor[]) => change({ color: Array.isArray(value) ? value[0] ?? 'indigo' : value }),
  });
  const prospect = computed({
    get: () => (isNew.value ? draft.isProspect : panel.value?.isProspect ?? false),
    set: (value: boolean) => change({ isProspect: value }),
  });

  // --- Facturation
  function setMode(mode: BillingMode): void {
    const f = fields.value;
    if (!f || mode === f.billingMode) return;
    // Repasser en TJM sans aucun jour ne laisserait rien à facturer : on pose le lundi.
    change({ billingMode: mode, ...(mode === 'TJM' && f.weekdays.length === 0 ? { weekdays: [0] } : {}) });
  }

  // --- Jours de présence
  const dayOptions = computed(() =>
    WEEKDAY_LETTERS.map((label, value) => ({ value, label, ariaLabel: WEEKDAY_LONG[value], color: { bg: color.value.base, fg: color.value.fg } })),
  );
  const weekdays = computed({
    get: () => fields.value?.weekdays ?? [],
    set: (days: number | number[]) => change({ weekdays: Array.isArray(days) ? days : [days] }),
  });

  // --- Dates : un champ vidé reprend la valeur enregistrée (le début est obligatoire), la fin vidée veut dire « sans fin ».
  const dateNonce = ref(0);
  function setStart(date: string | null): void {
    if (date) change({ startDate: date });
    else dateNonce.value++;
  }
  const noEnd = computed({
    get: () => fields.value?.endDate === null,
    set: (value: boolean) => change({ endDate: value || !fields.value ? null : suggestedEnd(fields.value.startDate) }),
  });

  // --- Délai de paiement et retard moyen
  const termOptions = PAYMENT_TERM_KEYS.map((value) => ({ value, label: PAYMENT_TERMS[value].label }));
  const term = computed({
    get: () => fields.value?.paymentTerm ?? 'NET_30',
    set: (value: PaymentTerm | PaymentTerm[]) => change({ paymentTerm: Array.isArray(value) ? value[0] ?? 'NET_30' : value }),
  });
  const delay = ref(fields.value?.averageDelayDays ?? 0);
  watch(() => fields.value?.averageDelayDays, (days) => { delay.value = days ?? 0; });
  const delayId = useId();

  function onDelayInput(event: Event): void {
    delay.value = Number((event.target as HTMLInputElement).value);
  }
  function onDelayChange(): void {
    if (delay.value !== fields.value?.averageDelayDays) change({ averageDelayDays: delay.value });
  }

  // --- Tarifs (mission existante)
  function addRate(rate: { validFrom: string; amount: number }): void {
    void treso.addRate(id(), rate);
  }
  function removeRate(rateId: string): void {
    void treso.deleteRate(id(), rateId);
  }

  // --- Suppression (mission existante)
  const confirmDelete = ref(false);
  async function deleteClient(): Promise<void> {
    confirmDelete.value = false;
    // `null` : l’API a refusé (le store a déjà prévenu et rechargé), la mission est toujours là, on reste sur sa fiche.
    if ((await treso.deleteClient(id())) !== null) await navigateTo('/clients');
  }

  // --- Création
  const creating = ref(false);
  /** Message sous les jours quand on tente de créer une mission au temps passé sans aucun jour de présence. */
  const dayError = ref(false);
  watch(() => [draft.weekdays.length, draft.billingMode], () => { dayError.value = false; });

  async function create(): Promise<void> {
    const name = nameText.value.trim();
    if (!name) return toast.error('Donne un nom à ce client.');
    if (!draft.amount || draft.amount <= 0) return toast.error(draft.billingMode === 'FORFAIT' ? 'Indique le montant du forfait.' : 'Indique ton TJM.');
    if (draft.billingMode === 'TJM' && draft.weekdays.length === 0) {
      dayError.value = true;
      return;
    }
    creating.value = true;
    const created = await treso.createClient({
      name,
      subtitle: subtitleText.value.trim() || null,
      color: draft.color,
      billingMode: draft.billingMode,
      weekdays: draft.billingMode === 'FORFAIT' ? [] : draft.weekdays,
      startDate: draft.startDate,
      endDate: draft.endDate,
      paymentTerm: draft.paymentTerm,
      averageDelayDays: draft.averageDelayDays,
      isProspect: draft.isProspect,
      rate: { validFrom: draft.startDate, amount: draft.amount },
    });
    creating.value = false;
    if (created) await navigateTo(`/clients/${created.id}`);
  }

  return {
    isNew, view, panel, draft, fields, color, change,
    nameText, subtitleText, commitName, commitSubtitle, colorOptions, colorKey, prospect,
    MODES, setMode, dayOptions, weekdays, dateNonce, setStart, noEnd,
    termOptions, term, delay, delayId, onDelayInput, onDelayChange,
    addRate, removeRate, confirmDelete, deleteClient, creating, dayError, create,
  };
}
