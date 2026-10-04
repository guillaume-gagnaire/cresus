<script setup lang="ts">
/**
 * « Combien te verser chaque mois » (Main-Micro.dc.html l. 118 à 131, Mobile-Accueil-Micro.dc.html l. 88 à 89) : barres
 * vertes, orange pour un mois bas (`low`), moyenne lissée en pointillés. Un seul sens : le « pour toi » du mois, 160 px au
 * plus pour le plus grand montant (ou la moyenne). `compact` : 15 colonnes sans défilement (100 px, libellés de 9 px).
 */
const props = defineProps<{
  bars: { key: string; label: string; value: number; low: boolean; aria: string; selected: boolean }[];
  average: number;
  averageLabel: string;
  ariaLabel?: string;
  compact?: boolean;
}>();
const emit = defineEmits<{ select: [index: number] }>();

const reach = computed(() => (props.compact ? 100 : 160));
const peak = computed(() => Math.max(1, ...props.bars.map((b) => b.value), props.average));
const px = (n: number): number => Math.round((Math.max(0, n) / peak.value) * reach.value);
const barHeight = (value: number): string => `${Math.max(props.compact ? 2 : 3, px(value))}px`;
</script>

<template>
  <div class="scroll" :class="{ compact }">
    <div class="grid" role="group" :aria-label="ariaLabel ?? 'Ce qui te reste chaque mois'">
      <button
        v-for="(bar, i) in bars"
        :key="bar.key"
        type="button"
        class="col"
        :class="{ selected: bar.selected }"
        :aria-label="bar.aria"
        :aria-pressed="bar.selected"
        @click="emit('select', i)"
      >
        <span class="slot" aria-hidden="true"><span class="bar" :class="{ low: bar.low }" :style="{ height: barHeight(bar.value) }" /></span>
        <span class="month" aria-hidden="true">{{ bar.label }}</span>
      </button>
      <!-- Pointillés à la hauteur de la moyenne : au-dessus du libellé de mois, dont la hauteur est fixe. -->
      <span class="average" role="img" :aria-label="averageLabel" :style="{ bottom: `calc(var(--label) + var(--gap) + ${px(average)}px)` }" />
    </div>
  </div>
</template>

<style scoped>
.scroll { --label: 26px; --gap: 6px; overflow-x: auto; padding: 5px; margin: -5px; }
/* Le libellé « janv. 27 » peut passer sur deux lignes : la hauteur fixe garde la base des barres alignée. */
.grid { position: relative; min-width: 480px; display: grid; grid-template-columns: repeat(15, minmax(0, 1fr)); gap: 5px; align-items: end; }
.col { border: 0; padding: 0; background: transparent; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: var(--gap); border-radius: 10px; font: inherit; color: var(--ink); min-width: 0; }
.col.selected { background: var(--tip-bg); box-shadow: inset 0 0 0 2px var(--ink); }
.slot { height: 160px; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
.bar { width: 75%; display: block; border-radius: 8px; background: var(--bar-up); }
.bar.low { background: var(--client-orange); }
.month { height: var(--label); font-size: 11px; line-height: 13px; font-weight: 700; color: var(--muted); text-align: center; }
.average { position: absolute; left: 0; right: 0; border-top: 2.5px dashed var(--positive-ink); pointer-events: none; }
.compact { --label: 11px; --gap: 3px; }
.compact .grid { min-width: 0; gap: 2px; }
.compact .col { border-radius: 6px; }
.compact .slot { height: 100px; }
.compact .bar { width: 70%; border-radius: 4px; }
.compact .month { font-size: 9px; line-height: 11px; }
.compact .average { border-top-width: 2px; }
</style>
