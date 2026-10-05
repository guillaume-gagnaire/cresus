<script setup lang="ts">
/**
 * « Poser des vacances » (Calendrier.dc.html l. 90 à 97) : une période Du / Au, chez qui, puis « Ajouter et simuler ». Le
 * message dit ce que la période coûte (`role="status"`) ou pourquoi elle est refusée (`role="alert"`). Les dates saisies
 * sont vérifiées par `addPeriod` avant tout appel à l’API ; elles restent affichées après l’ajout. `compact` (mobile) retire
 * le titre : le bouton qui déplie le formulaire le porte déjà.
 */
defineProps<{
  options: readonly { value: string; label: string }[];
  /** Clé de la cible choisie (« ALL » ou l’identifiant d’un client). */
  target: string;
  message: FlashMessage | null;
  /** Une période est en cours d’enregistrement : le bouton attend. */
  busy?: boolean;
  compact?: boolean;
}>();
const emit = defineEmits<{ 'update:target': [key: string | string[]]; submit: [from: string | null, to: string | null] }>();

const from = ref<string | null>(null);
const to = ref<string | null>(null);
</script>

<template>
  <form class="form" novalidate @submit.prevent="emit('submit', from, to)">
    <h2 v-if="!compact">Poser des vacances</h2>
    <div class="dates">
      <DateInput v-model="from" label="Du" />
      <DateInput v-model="to" label="Au" :min="from ?? undefined" />
    </div>
    <div class="field">
      Chez qui&#160;?
      <ChoiceChips :model-value="target" :options="options" ariaLabel="Chez qui" @update:model-value="emit('update:target', $event)" />
    </div>
    <AppButton type="submit" variant="primary" :disabled="busy">Ajouter et simuler</AppButton>
    <p v-if="message" :role="message.tone === 'error' ? 'alert' : 'status'" class="message" :class="`is-${message.tone}`">{{ message.text }}</p>
  </form>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
h2 { margin: 0; font-size: 24px; font-weight: 800; }
.dates { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.message { margin: 0; padding: 14px 16px; border-radius: 16px; font-size: 15px; font-weight: 600; }
.message.is-ok { background: #E7F6EC; color: #1E6B3A; }
.message.is-info { background: var(--border-soft); color: var(--ink-3); }
.message.is-error { background: var(--danger-bg); color: var(--danger-ink); }
</style>
