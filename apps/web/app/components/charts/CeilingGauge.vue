<script setup lang="ts">
/**
 * Jauge du plafond de CA (Main-Micro.dc.html l. 96 à 116, Mobile-Accueil-Micro.dc.html l. 76 à 80) : rail crème, réel
 * plein, prévu hachuré, marqueur vertical « Seuil TVA ». Les trois pourcentages sont des parts de la largeur du rail (déjà
 * calculées sur l’échelle de la jauge). `compact` : rail de 24 px, marqueur « TVA », sans légende (écran mobile).
 */
const props = defineProps<{
  actualPct: number;
  plannedPct: number;
  vatPct: number;
  color: string;
  soft: string;
  ariaLabel: string;
  compact?: boolean;
}>();

const clamp = (n: number): number => Math.min(100, Math.max(0, n));
const actual = computed(() => clamp(props.actualPct));
const planned = computed(() => clamp(Math.min(props.plannedPct, 100 - actual.value)));
const vat = computed(() => clamp(props.vatPct));
const stripe = computed(() => {
  const size = props.compact ? 6 : 8;
  return `repeating-linear-gradient(135deg, ${props.color} 0 ${size}px, ${props.soft} ${size}px ${size * 2}px)`;
});
</script>

<template>
  <div class="gauge" :class="{ compact }">
    <div class="figure" role="img" :aria-label="ariaLabel">
      <span class="marker-label" :style="{ left: `${vat}%` }">{{ compact ? 'TVA' : 'Seuil TVA' }}</span>
      <span class="marker" :style="{ left: `${vat}%` }" />
      <span class="rail">
        <span :style="{ width: `${actual}%`, background: color }" />
        <span :style="{ width: `${planned}%`, background: stripe }" />
      </span>
    </div>
    <div v-if="!compact" class="legend">
      <span class="key"><span class="swatch" :style="{ background: color }" />Déjà encaissé</span>
      <span class="key">
        <span class="swatch" :style="{ background: `repeating-linear-gradient(135deg, ${color} 0 4px, ${soft} 4px 8px)` }" />Prévu
      </span>
    </div>
  </div>
</template>

<style scoped>
.gauge { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
.figure { position: relative; padding-top: 26px; }
.marker-label { position: absolute; top: 0; transform: translateX(-50%); font-size: 12px; font-weight: 700; color: #6A3FC9; white-space: nowrap; }
.marker { position: absolute; top: 18px; bottom: 0; width: 2px; margin-left: -1px; background: #6A3FC9; z-index: 1; }
.rail { display: flex; height: 34px; border-radius: 999px; background: var(--border-soft); overflow: hidden; }
.legend { display: flex; gap: 16px; flex-wrap: wrap; font-size: 14px; font-weight: 600; color: var(--ink-3); }
.key { display: flex; align-items: center; gap: 6px; }
.swatch { width: 14px; height: 14px; border-radius: 4px; }
.compact { gap: 0; }
.compact .figure { padding-top: 20px; }
.compact .marker-label { font-size: 11px; }
.compact .marker { top: 14px; }
.compact .rail { height: 24px; }
</style>
