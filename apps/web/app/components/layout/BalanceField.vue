<script setup lang="ts">
import { relativeDays } from '@matreso/engine';

/**
 * « Solde du compte » : le point de départ de toute la projection. `pill` (desktop, Main.dc.html l. 64) tient dans l’en-tête,
 * `card` (mobile, en bas de l’accueil) pose le champ pleine largeur. La saisie enregistre un nouveau solde daté d’aujourd’hui.
 */
withDefaults(defineProps<{ variant?: 'pill' | 'card' }>(), { variant: 'pill' });

const treso = useTresoStore();
const amount = computed(() => treso.balance?.amount ?? null);
/** Un champ vidé ne supprime pas le solde : on remonte le champ pour qu’il reprenne la valeur enregistrée. */
const fieldKey = ref(0);

function update(cents: number | null): void {
  if (cents === null) {
    fieldKey.value += 1;
    return;
  }
  void treso.setBalance(cents);
}
</script>

<template>
  <div class="balance" :class="variant">
    <div class="box">
      <MoneyInput :key="fieldKey" :model-value="amount" label="Solde du compte" :step="10" @update:model-value="update" />
    </div>
    <p class="hint">
      <template v-if="treso.balance">Mis à jour {{ relativeDays(treso.balance.date, treso.today) }}</template>
      <template v-else>Indique ton solde pour démarrer</template>
    </p>
  </div>
</template>

<style scoped>
.balance { display: flex; flex-direction: column; gap: 6px; }
.hint { margin: 0; font-size: 13px; color: var(--muted); }

/* Pastille de l’en-tête : libellé à gauche, champ rond de 120 px. */
.pill .box :deep(.field) {
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 6px 6px 6px 18px;
  border-radius: var(--radius-pill);
  background: var(--surface);
  border: 1.5px solid var(--border);
  color: var(--ink);
}
.pill .box :deep(.wrap input) {
  width: 132px;
  min-height: 44px;
  padding: 0 32px 0 12px;
  border-radius: var(--radius-pill);
  font: 700 16px var(--font-display);
}
.pill .box :deep(.suffix) { right: 14px; }

/* Carte mobile : libellé au-dessus, champ pleine largeur. */
.balance.card { padding: 16px; } /* fond, contour, rayon et ombre : classe globale .card */
.card .box :deep(.wrap input) { min-height: 50px; font: 700 18px var(--font-display); }
</style>
