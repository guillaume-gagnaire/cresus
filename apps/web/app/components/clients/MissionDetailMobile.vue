<script setup lang="ts">
/**
 * « Ta mission », écran poussé du mobile (Mobile-Client.dc.html l. 51 à 100), ou formulaire de création quand `clientId` vaut
 * `'new'`. Mêmes champs et mêmes actions que la fiche desktop (`useMissionEditor`), rangés en cartes : Client, Tarif, Dates,
 * Paiement, puis ce que la mission encaisse.
 */
const props = defineProps<{ clientId: string | 'new' }>();

const treso = useTresoStore();
const {
  isNew, view, panel, draft, fields, color, change,
  nameText, subtitleText, commitName, commitSubtitle, colorOptions, colorKey, prospect,
  MODES, setMode, dayOptions, weekdays, dateNonce, setStart, noEnd,
  termOptions, term, delay, delayId, onDelayInput, onDelayChange,
  addRate, removeRate, confirmDelete, deleteClient, creating, dayError, create,
} = useMissionEditor(() => props.clientId);
const { clientCash } = view;

// Sélecteur de client : une pastille par client (sa lettre, son nom en nom accessible), qui ouvre sa fiche.
const pickerOptions = computed(() =>
  treso.clients.map((c) => ({ value: c.id, label: clientLetter(c.name), ariaLabel: c.name, color: { bg: PALETTE[c.color].base, fg: PALETTE[c.color].fg } })),
);
function pick(value: string | string[]): void {
  const id = Array.isArray(value) ? value[0] : value;
  // Une fiche en attente de confirmation (`tmp-…`, R26) ne s’ouvre pas : l’API ne la connaît pas encore.
  if (id && id !== props.clientId && !id.startsWith('tmp-')) void navigateTo(`/clients/${id}`, { replace: true });
}

/** Bandeau : le statut, et « Forfait mensuel » pour une facturation au forfait. */
const bannerSub = computed(() => [panel.value?.badge, panel.value?.billingMode === 'FORFAIT' ? 'Forfait mensuel' : ''].filter(Boolean).join(' · '));
</script>

<template>
  <div class="detail">
    <NuxtLink to="/clients" class="back" aria-label="Retour aux missions">
      <span class="circle"><AppIcon name="arrow-left" :size="22" /></span>
      <span class="back-label">Missions</span>
    </NuxtLink>

    <h1>{{ isNew ? 'Nouveau client' : 'Ta mission' }}</h1>

    <template v-if="fields">
      <ChoiceChips v-if="!isNew" :model-value="clientId" :options="pickerOptions" ariaLabel="Client" @update:model-value="pick" />

      <div class="body" role="region" :aria-label="isNew ? 'Nouveau client' : panel?.name">
        <div class="banner" :style="{ background: color.base, color: color.fg }">
          <div class="banner-who">
            <span class="banner-name">{{ isNew ? nameText || 'Nouveau client' : panel?.name }}</span>
            <span v-if="panel" class="banner-sub">{{ bannerSub }}</span>
          </div>
          <span v-if="panel" class="num banner-month">{{ panel.monthly }}<span class="per"> /mois</span></span>
        </div>

        <section class="card block" aria-labelledby="identity-title">
          <h2 id="identity-title">Client</h2>
          <label class="field">Nom du client
            <input v-model="nameText" type="text" autocomplete="off" maxlength="80" @change="commitName" @blur="commitName" @keydown.enter="commitName">
          </label>
          <label class="field">Sous-titre
            <input v-model="subtitleText" type="text" autocomplete="off" maxlength="80" placeholder="Via ESN, en direct…" @change="commitSubtitle" @blur="commitSubtitle" @keydown.enter="commitSubtitle">
          </label>
          <div class="field">Couleur<ChoiceChips v-model="colorKey" :options="colorOptions" ariaLabel="Couleur" /></div>
          <ToggleSwitch v-model="prospect" label="Piste (pas encore signée)" />
        </section>

        <section class="card block" aria-labelledby="rate-title">
          <h2 id="rate-title">Tarif</h2>
          <SegmentedControl :model-value="fields.billingMode" :options="MODES" ariaLabel="Mode de facturation" @update:model-value="setMode" />
          <span class="sm">{{ MODE_HELP[fields.billingMode] }}</span>
          <div v-if="fields.billingMode === 'TJM'" class="field">Jours chez ce client
            <div class="days"><ChoiceChips v-model="weekdays" :options="dayOptions" multiple ariaLabel="Jours chez ce client" /></div>
            <p v-if="dayError" class="error" role="alert">Choisis au moins un jour de présence.</p>
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
        </section>

        <section class="card block" aria-labelledby="dates-title">
          <h2 id="dates-title">Dates</h2>
          <DateInput :key="`start-${dateNonce}`" :model-value="fields.startDate" label="Début" @update:model-value="setStart" />
          <DateInput v-if="fields.endDate !== null" :model-value="fields.endDate" label="Fin" @update:model-value="change({ endDate: $event })" />
          <ToggleSwitch v-model="noEnd" label="Mission sans date de fin" />
          <span v-if="panel" class="sm">{{ panel.period }}</span>
        </section>

        <section class="card block" aria-labelledby="payment-title">
          <h2 id="payment-title">Paiement</h2>
          <ChoiceChips v-model="term" :options="termOptions" ariaLabel="Délai de paiement" />
          <div class="slider">
            <label :for="delayId" class="slider-label"><span>Retard moyen</span><span class="num">{{ delayLabel(delay) }}</span></label>
            <input :id="delayId" type="range" min="0" max="30" step="1" :value="delay" :aria-valuetext="delayLabel(delay)" @input="onDelayInput" @change="onDelayChange">
          </div>
          <InvoicePath v-if="panel" :steps="panel.path.steps" :wait="panel.path.wait" />
        </section>

        <section v-if="clientCash" class="card block" aria-labelledby="cash-title">
          <div class="cash-head">
            <h2 id="cash-title">Encaissements</h2>
            <span class="num cash-total">{{ clientCash.total }}</span>
          </div>
          <MiniBars :bars="clientCash.bars" :height="90" readonly unipolar :bar-color="color.base" ariaLabel="Encaissements de la mission, mois par mois" />
          <span class="sm">{{ clientCash.note }}</span>
        </section>

        <TipBubble title="Une mission finie paie encore" compact>
          Le dernier mois travaillé arrive sur ton compte un à deux mois après la fin. À l’inverse, une nouvelle mission met du temps à remplir ta tréso.
        </TipBubble>

        <AppButton v-if="isNew" variant="primary" block :disabled="creating" class="action" @click="create">Créer la mission</AppButton>
        <AppButton v-else variant="ghost" block class="action delete" @click="confirmDelete = true">Supprimer ce client</AppButton>
      </div>

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
    </template>
  </div>
</template>

<style scoped>
.detail { display: flex; flex-direction: column; gap: 18px; }
/* Retour : pastille de 44 px (cible tactile) et le mot « Missions », le tout cliquable ; le lien se nomme « Retour aux missions ». */
.back { align-self: flex-start; min-height: 44px; margin: 2px 0 -6px -8px; padding-right: 12px; border-radius: 999px; display: flex; align-items: center; gap: 8px; color: var(--ink); text-decoration: none; font-weight: 700; }
.back:hover { color: var(--ink); }
.circle { width: 44px; height: 44px; border-radius: 999px; background: var(--surface); border: 1.5px solid var(--border); display: flex; align-items: center; justify-content: center; }
h1 { margin: 0; font-size: 30px; font-weight: 800; letter-spacing: -0.02em; }
.body { display: flex; flex-direction: column; gap: 18px; }
.banner { padding: 18px; border-radius: 24px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.banner-who { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.banner-name { font-family: var(--font-display); font-size: 22px; font-weight: 800; overflow-wrap: anywhere; }
.banner-sub { font-size: 14px; opacity: .85; }
.banner-month { flex: none; font-size: 20px; }
.per { font-family: var(--font-text); font-size: 13px; font-weight: 600; }
.block { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
h2 { margin: 0; font-size: 18px; font-weight: 800; }
.days :deep(.chips) { flex-wrap: nowrap; gap: 6px; }
.days :deep(.chip) { flex: 1 1 0; min-width: 0; min-height: 48px; padding: 0; font-size: 16px; }
.error { margin: 0; font-size: 14px; font-weight: 600; color: var(--danger); }
.slider { display: flex; flex-direction: column; gap: 4px; }
.slider-label { display: flex; justify-content: space-between; font-weight: 600; }
.cash-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.cash-total { font-size: 15px; }
.action { min-height: 52px; }
.delete { color: var(--danger); }
</style>
