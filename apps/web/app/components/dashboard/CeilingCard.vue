<script setup lang="ts">
/**
 * « Ton plafond de CA » (Main-Micro.dc.html l. 96 à 116, Mobile-Accueil-Micro.dc.html l. 75 à 83) : l’année, le total sur le
 * plafond, la jauge, le message coloré (toujours écrit : la couleur ne porte jamais seule le sens), l’encart TVA et
 * l’essai d’une mission en plus. `compact` : version mobile.
 */
defineProps<{ gauge: MicroGauge; years: number[]; year: number; testMission: boolean; testMissionLabel: string; compact?: boolean }>();
const emit = defineEmits<{ pickYear: [year: number]; toggleTest: [] }>();
</script>

<template>
  <section class="card ceiling" :class="{ 'is-compact': compact }">
    <div class="head">
      <h2>{{ compact ? 'Plafond de CA' : 'Ton plafond de CA' }}</h2>
      <SegmentedControl
        class="years"
        :model-value="year"
        ariaLabel="Année du plafond"
        :options="years.map((y) => ({ value: y, label: String(y) }))"
        @update:model-value="emit('pickYear', $event)"
      />
    </div>
    <div class="total">
      <span class="num amount">{{ gauge.total }}</span>
      <span class="of">{{ compact ? `sur ${gauge.ceiling}` : `sur ${gauge.ceiling} autorisés` }}</span>
    </div>
    <CeilingGauge
      :actual-pct="gauge.actualPct"
      :planned-pct="gauge.plannedPct"
      :vat-pct="gauge.vatPct"
      :color="gauge.color"
      :soft="gauge.soft"
      :ariaLabel="gauge.aria"
      :compact="compact"
    />
    <div role="status" class="message" :class="`level-${gauge.level}`">{{ gauge.message }}</div>
    <div class="vat">{{ gauge.vat }}</div>
    <label class="test">
      <input type="checkbox" :checked="testMission" @change="emit('toggleTest')">
      {{ testMissionLabel }}
    </label>
  </section>
</template>

<style scoped>
.ceiling { min-width: 0; padding: 28px; display: flex; flex-direction: column; gap: 18px; }
.head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; }
h2 { margin: 0; font-size: 26px; font-weight: 800; }
/* Sélecteur d’année : fond crème sur la carte blanche (maquette). */
.years { background: var(--bg); }
.years :deep(button) { flex: none; }
.total { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 10px; }
.amount { font-size: 40px; line-height: 1; overflow-wrap: anywhere; }
.of { font-size: 16px; color: var(--ink-2); }
.message { padding: 14px 18px; border-radius: 16px; font-size: 16px; font-weight: 600; line-height: 1.5; }
.level-OK { background: var(--positive-bg); color: var(--positive-ink); }
.level-WARN { background: var(--tip-bg); color: #5A4A00; }
.level-OVER { background: var(--danger-bg); color: var(--danger-ink); }
.vat { padding: 14px 18px; border-radius: 16px; background: #F1EAFE; color: #3B2470; font-size: 15px; line-height: 1.5; }
.test { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 16px; border-radius: 16px; border: 2px dashed var(--field-border); font-weight: 600; cursor: pointer; }
.test input { flex: none; width: 20px; height: 20px; accent-color: var(--link); }

/* Version mobile : carte de 16 px de marge, chiffres et messages plus petits, case sans cadre. */
.is-compact { padding: 16px; gap: 12px; }
.is-compact h2 { font-size: 18px; }
.is-compact .years { gap: 4px; padding: 0; border: 0; background: transparent; }
.is-compact .years :deep(button) { min-width: 44px; padding: 0 14px; border: 2px solid var(--field-border); background: var(--surface); }
.is-compact .years :deep(button[aria-pressed='true']) { border-color: var(--ink); background: var(--ink); }
.is-compact .total { flex-wrap: nowrap; gap: 8px; }
.is-compact .amount { font-size: 28px; }
.is-compact .of { font-size: 13px; color: var(--muted); }
.is-compact .message { padding: 12px 14px; border-radius: 14px; font-size: 14px; line-height: 1.45; }
.is-compact .vat { padding: 0; border-radius: 0; background: none; font-size: 13px; line-height: 1.4; }
.is-compact .test { min-height: 44px; padding: 0; border: 0; border-radius: 0; font-size: 14px; }
.is-compact .test input { width: 22px; height: 22px; }
</style>
