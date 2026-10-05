<script setup lang="ts">
/**
 * « Ajouter une charge » (Charges.dc.html l. 110 à 116) : le nom, le montant, Mensuelle ou Annuelle (avec le mois du
 * prélèvement quand elle est annuelle), la catégorie, puis « Ajouter ». Rien ne part tant que le nom ou le montant manque :
 * un message le dit (`role="alert"`). Après l’ajout, le nom et le montant sont vidés ; la fréquence, le mois et la catégorie restent.
 * `compact` (mobile) retire le titre : le bouton qui déplie le formulaire le porte déjà.
 */
import { type ChargeFrequency, type ChargeInput, MONTHS_LONG } from '@matreso/engine';

defineProps<{ compact?: boolean }>();
const emit = defineEmits<{ submit: [input: ChargeInput] }>();

const CATEGORIES = ['Toi', 'Social', 'Impôts', 'Véhicule', 'Services', 'Outils', 'Banque', 'Assurance', 'Autre'] as const;
const FREQUENCIES = [
  { value: 'MONTHLY' as const, label: 'Mensuelle' },
  { value: 'YEARLY' as const, label: 'Annuelle' },
];

const name = ref('');
const amount = ref<number | null>(null);
const frequency = ref<ChargeFrequency>('MONTHLY');
const month = ref(0);
const category = ref<string>('Autre');
const error = ref('');

function submit(): void {
  const trimmed = name.value.trim();
  if (!trimmed) {
    error.value = 'Donne un nom à cette charge.';
    return;
  }
  if (!amount.value || amount.value <= 0) {
    error.value = 'Indique un montant supérieur à 0.';
    return;
  }
  error.value = '';
  emit('submit', {
    name: trimmed,
    amount: amount.value,
    frequency: frequency.value,
    month: frequency.value === 'YEARLY' ? month.value : null,
    category: category.value,
  });
  name.value = '';
  amount.value = null;
}
</script>

<template>
  <form class="form" novalidate @submit.prevent="submit">
    <h2 v-if="!compact">Ajouter une charge</h2>
    <label class="field">
      Nom de la charge
      <input v-model="name" type="text" maxlength="80" autocomplete="off" placeholder="Ex. coworking">
    </label>
    <MoneyInput v-model="amount" label="Montant" :min="0" :step="10" />
    <div class="field">
      Fréquence
      <SegmentedControl v-model="frequency" :options="FREQUENCIES" ariaLabel="Fréquence" />
    </div>
    <label v-if="frequency === 'YEARLY'" class="field">
      Mois du prélèvement
      <select v-model="month">
        <option v-for="(label, index) in MONTHS_LONG" :key="label" :value="index">{{ label }}</option>
      </select>
    </label>
    <label class="field">
      Catégorie
      <select v-model="category">
        <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
      </select>
    </label>
    <p v-if="error" role="alert" class="message">{{ error }}</p>
    <AppButton type="submit" variant="primary">Ajouter</AppButton>
  </form>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
h2 { margin: 0; font-size: 24px; font-weight: 800; }
.message { margin: 0; padding: 12px 16px; border-radius: 16px; background: var(--danger-bg); color: var(--danger-ink); font-size: 15px; font-weight: 600; }
</style>
