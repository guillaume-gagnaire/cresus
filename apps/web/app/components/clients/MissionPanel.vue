<script setup lang="ts">
/**
 * Fiche d’une mission (Clients.dc.html l. 105 à 157), ou formulaire de création quand `clientId` vaut `'new'`. La logique
 * d’édition (champs, brouillon de création, appels au store) vit dans `useMissionEditor`, partagée avec la fiche mobile.
 */
const props = defineProps<{ clientId: string | 'new' }>();

const {
  isNew, panel, draft, fields, change,
  nameText, subtitleText, commitName, commitSubtitle, colorOptions, colorKey, prospect,
  MODES, setMode, dayOptions, weekdays, dateNonce, setStart, noEnd,
  termOptions, term, delay, delayId, onDelayInput, onDelayChange,
  addRate, removeRate, confirmDelete, deleteClient, creating, dayError, create,
} = useMissionEditor(() => props.clientId);
</script>

<template>
  <section v-if="fields" role="region" :aria-label="isNew ? 'Nouveau client' : panel?.name" class="card panel">
    <div class="head">
      <h2>{{ isNew ? 'Nouveau client' : panel?.name }}</h2>
      <AppBadge v-if="panel" :bg="panel.color.soft" fg="var(--ink)">{{ panel.badge }}</AppBadge>
    </div>

    <label class="field">Nom du client
      <input v-model="nameText" type="text" autocomplete="off" maxlength="80" @change="commitName" @blur="commitName" @keydown.enter="commitName">
    </label>
    <label class="field">Sous-titre
      <input v-model="subtitleText" type="text" autocomplete="off" maxlength="80" placeholder="Via ESN, en direct…" @change="commitSubtitle" @blur="commitSubtitle" @keydown.enter="commitSubtitle">
    </label>
    <div class="field">Couleur<ChoiceChips v-model="colorKey" :options="colorOptions" ariaLabel="Couleur" /></div>
    <ToggleSwitch v-model="prospect" label="Piste (pas encore signée)" />

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
      <p v-if="dayError" class="error" role="alert">Choisis au moins un jour de présence.</p>
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
.error { margin: 0; font-size: 14px; font-weight: 600; color: var(--danger); }
.delete { align-self: flex-start; color: var(--danger); }
</style>
