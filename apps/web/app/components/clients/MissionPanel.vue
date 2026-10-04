<script setup lang="ts">
import { type BillingMode, type ClientColor, type ClientPatch, firstDayOfMonth, type ISODate, monthKey, PAYMENT_TERM_KEYS, PAYMENT_TERMS, type PaymentTerm } from '@matreso/engine';

/**
 * Fiche d’une mission (Clients.dc.html l. 105 à 157), ou formulaire de création quand `clientId` vaut `'new'`.
 * Sur une mission existante, chaque modification part tout de suite (champ par champ, au `change`) : le store applique le
 * changement, appelle l’API, et recharge l’état si elle refuse (par exemple `END_BEFORE_START`). En création, les mêmes champs
 * remplissent un brouillon local, envoyé en une fois par « Créer la mission ».
 */
const props = defineProps<{ clientId: string | 'new' }>();

const treso = useTresoStore();
const toast = useToast();
const isNew = computed(() => props.clientId === 'new');
const { panel } = useClientsView(computed(() => (isNew.value ? null : props.clientId)));

type Fields = { billingMode: BillingMode; weekdays: number[]; startDate: ISODate; endDate: ISODate | null; paymentTerm: PaymentTerm; averageDelayDays: number };

/** Brouillon du formulaire de création : début au 1er du mois courant, sans fin, 30 jours, aucun retard. */
const draft = reactive<Fields & { name: string; subtitle: string; color: ClientColor; amount: number | null; isProspect: boolean }>({
  name: '',
  subtitle: '',
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
  else void treso.updateClient(props.clientId, patch);
}

// --- Facturation
const MODES = [
  { value: 'TJM', label: 'Au temps passé' },
  { value: 'FORFAIT', label: 'Forfait mensuel' },
] as const;

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
  void treso.addRate(props.clientId, rate);
}
function removeRate(id: string): void {
  void treso.deleteRate(props.clientId, id);
}

// --- Suppression (mission existante)
const confirmDelete = ref(false);
async function deleteClient(): Promise<void> {
  confirmDelete.value = false;
  await treso.deleteClient(props.clientId);
  await navigateTo('/clients');
}

// --- Création
const colorOptions = Object.entries(PALETTE).map(([value, p]) => ({ value: value as ClientColor, label: p.label, color: { bg: p.base, fg: p.fg } }));
const creating = ref(false);

async function create(): Promise<void> {
  const name = draft.name.trim();
  if (!name) return toast.error('Donne un nom à ce client.');
  if (!draft.amount || draft.amount <= 0) return toast.error(draft.billingMode === 'FORFAIT' ? 'Indique le montant du forfait.' : 'Indique ton TJM.');
  creating.value = true;
  const created = await treso.createClient({
    name,
    subtitle: draft.subtitle.trim() || null,
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
</script>

<template>
  <section v-if="fields" role="region" :aria-label="isNew ? 'Nouveau client' : panel?.name" class="card panel">
    <div class="head">
      <h2>{{ isNew ? 'Nouveau client' : panel?.name }}</h2>
      <AppBadge v-if="panel" :bg="panel.color.soft" fg="var(--ink)">{{ panel.badge }}</AppBadge>
    </div>

    <template v-if="isNew">
      <label class="field">Nom du client<input v-model="draft.name" type="text" autocomplete="off" maxlength="80"></label>
      <label class="field">Sous-titre<input v-model="draft.subtitle" type="text" autocomplete="off" maxlength="80" placeholder="Via ESN, en direct…"></label>
      <div class="field">Couleur<ChoiceChips v-model="draft.color" :options="colorOptions" ariaLabel="Couleur" /></div>
    </template>

    <div class="field">Facturation
      <SegmentedControl :model-value="fields.billingMode" :options="MODES" ariaLabel="Facturation" @update:model-value="setMode" />
      <span class="help">{{ MODE_HELP[fields.billingMode] }}</span>
    </div>

    <RateEditor
      v-if="panel"
      :title="panel.rateTitle"
      :current="panel.rateNow"
      :history="panel.history"
      :new-label="panel.newRateLabel"
      @add="addRate"
      @remove="removeRate"
    />
    <MoneyInput v-else v-model="draft.amount" :label="draft.billingMode === 'FORFAIT' ? 'Forfait (€)' : 'TJM (€)'" :min="0" :step="10" />

    <div v-if="fields.billingMode === 'TJM'" class="field">Jours chez ce client
      <div class="days"><ChoiceChips v-model="weekdays" :options="dayOptions" multiple ariaLabel="Jours chez ce client" /></div>
    </div>

    <div class="dates">
      <DateInput :key="`start-${dateNonce}`" :model-value="fields.startDate" label="Début" @update:model-value="setStart" />
      <DateInput v-if="fields.endDate !== null" :model-value="fields.endDate" label="Fin" @update:model-value="change({ endDate: $event })" />
      <div v-else class="field">Fin<span class="no-end">Sans date de fin</span></div>
    </div>
    <ToggleSwitch v-model="noEnd" label="Mission sans date de fin" />

    <div class="field">Délai de paiement
      <div class="terms"><ChoiceChips v-model="term" :options="termOptions" ariaLabel="Délai de paiement" /></div>
    </div>
    <div class="field">
      <label :for="delayId" class="slider-label"><span>Retard moyen constaté</span><span class="num">{{ delayLabel(delay) }}</span></label>
      <input :id="delayId" type="range" min="0" max="30" step="1" :value="delay" :aria-valuetext="delayLabel(delay)" @input="onDelayInput" @change="onDelayChange">
    </div>

    <label v-if="isNew" class="check"><input v-model="draft.isProspect" type="checkbox">Piste (pas encore signée)</label>

    <InvoicePath v-if="panel" :steps="panel.path.steps" :wait="panel.path.wait" />

    <AppButton v-if="isNew" variant="primary" :disabled="creating" @click="create">Créer la mission</AppButton>
    <AppButton v-else variant="ghost" class="delete" @click="confirmDelete = true">Supprimer ce client</AppButton>

    <ConfirmDialog
      v-if="panel"
      :open="confirmDelete"
      title="Supprimer ce client&#160;?"
      :message="`Supprimer ${panel.name} efface ses tarifs et les congés qui lui sont propres. Cette action est définitive.`"
      confirm-label="Supprimer"
      danger
      @confirm="deleteClient"
      @cancel="confirmDelete = false"
    />
  </section>
</template>

<style scoped>
.panel { min-width: 0; padding: 26px; display: flex; flex-direction: column; gap: 18px; }
.head { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
h2 { margin: 0; font-size: 26px; font-weight: 800; overflow-wrap: anywhere; }
.help { font-size: 14px; color: var(--muted); font-weight: 500; }
.days :deep(.chips) { flex-wrap: nowrap; }
.days :deep(.chip) { width: 50px; min-height: 50px; padding: 0; font-size: 16px; }
.terms :deep(.chip) { font-size: 14px; }
.dates { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.no-end { min-height: 50px; display: flex; align-items: center; padding: 0 16px; border-radius: 16px; background: var(--border-soft); color: var(--muted); font-weight: 500; }
.slider-label { display: flex; justify-content: space-between; }
.check { display: flex; align-items: center; gap: 10px; min-height: 44px; font-weight: 600; cursor: pointer; }
.check input { width: 20px; height: 20px; accent-color: var(--link); }
.delete { align-self: flex-start; color: var(--danger); }
</style>
