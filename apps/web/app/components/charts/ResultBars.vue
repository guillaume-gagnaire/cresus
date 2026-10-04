<script setup lang="ts">
/**
 * Barres « Mois par mois » (Main.dc.html l. 107 à 114) : barre verte au-dessus de l’axe, rouge en dessous, hauteur
 * proportionnelle au plus grand montant absolu (76 px de chaque côté pour 160 px de haut). Données déjà formatées :
 * aucun calcul métier ici. Le conteneur défile horizontalement dans sa carte (jamais la page).
 */
const props = withDefaults(
  defineProps<{
    bars: { key: string; label: string; valueLabel: string; value: number; aria: string; selected: boolean }[];
    height?: number;
    ariaLabel?: string;
  }>(),
  { height: 160, ariaLabel: 'Résultat de chaque mois' },
);
const emit = defineEmits<{ select: [index: number] }>();

/** Axe de 2 px au milieu ; 3 px de marge en bout de demi-hauteur (79 → 76). */
const reach = computed(() => Math.floor((props.height - 2) / 2) - 3);
const peak = computed(() => Math.max(1, ...props.bars.map((b) => Math.abs(b.value))));
/** Une valeur non nulle garde au moins 2 px : un petit mois ne disparaît pas. */
const px = (n: number): string => `${Math.max(2, Math.round((n / peak.value) * reach.value))}px`;
</script>

<template>
  <div class="scroll">
    <div class="grid" role="group" :aria-label="ariaLabel" :style="{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))`, minWidth: `${bars.length * 52}px` }">
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
        <span class="num value" :class="bar.value < 0 ? 'neg' : 'pos'">{{ bar.valueLabel }}</span>
        <span class="plot" :style="{ height: `${height}px` }" aria-hidden="true">
          <span class="half up"><span class="bar pos" :style="{ height: bar.value > 0 ? px(bar.value) : '0px' }" /></span>
          <span class="axis" />
          <span class="half down"><span class="bar neg" :style="{ height: bar.value < 0 ? px(-bar.value) : '0px' }" /></span>
        </span>
        <span class="month">{{ bar.label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Le défilement reste dans la carte ; la marge négative laisse la place du contour de focus sans décaler la mise en page. */
.scroll { overflow-x: auto; padding: 5px; margin: -5px; }
/* 52 px par colonne (780 px pour 15 mois) : au moins 44 px de large par colonne, cibles tactiles comprises. */
.grid { display: grid; gap: 8px; }
.col { border: 0; background: transparent; padding: 6px 0; border-radius: 16px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 6px; font: inherit; color: var(--ink); }
.col.selected { background: var(--tip-bg); box-shadow: inset 0 0 0 2px var(--ink); }
.value { font-size: 12px; }
.value.pos { color: #1E6B3A; }
.value.neg { color: #C2272D; }
.plot { width: 70%; display: flex; flex-direction: column; }
.half { flex: 1; display: flex; }
.half.up { align-items: flex-end; }
.bar { width: 100%; display: block; }
.bar.pos { border-radius: 8px 8px 0 0; background: var(--bar-up); }
.bar.neg { border-radius: 0 0 8px 8px; background: var(--bar-down); }
.axis { height: 2px; background: var(--ink); }
.month { font-size: 12px; font-weight: 700; color: var(--ink-3); }
</style>
