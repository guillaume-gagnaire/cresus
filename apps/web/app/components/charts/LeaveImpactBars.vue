<script setup lang="ts">
/**
 * « Ce que tes vacances font à chaque mois » (Calendrier.dc.html l. 116 à 140) : deux barres par mois, grise sans les
 * congés, verte ou rouge avec, sur un axe commun (86 px de chaque côté pour le plus grand montant). Les mois que les
 * congés font passer dans le rouge sont surlignés. `valueLabel` (« −2,3k ») s’affiche au-dessus, coloré selon le signe
 * du résultat avec congés. Graphique en lecture seule : chaque colonne est une image décrite par `aria`.
 */
const props = defineProps<{
  columns: { label: string; without: number; with: number; highlight: boolean; aria: string; valueLabel?: string }[];
  ariaLabel?: string;
}>();

const peak = computed(() => Math.max(1, ...props.columns.flatMap((c) => [Math.abs(c.without), Math.abs(c.with)])));
const px = (n: number): string => `${Math.round((Math.abs(n) / peak.value) * 86)}px`;
const up = (n: number): string => (n > 0 ? px(n) : '0px');
const down = (n: number): string => (n < 0 ? px(n) : '0px');
</script>

<template>
  <div class="chart">
    <div class="scroll">
      <div class="grid" role="group" :aria-label="ariaLabel ?? 'Effet des vacances sur chaque mois'">
        <div v-for="(column, i) in columns" :key="i" class="col" :class="{ lit: column.highlight }" role="img" :aria-label="column.aria">
          <span v-if="column.valueLabel" class="num value" :class="column.with < 0 ? 'neg' : 'pos'" aria-hidden="true">{{ column.valueLabel }}</span>
          <span class="plot" aria-hidden="true">
            <span class="half up">
              <span class="bar without" :style="{ height: up(column.without) }" />
              <span class="bar pos" :style="{ height: up(column.with) }" />
            </span>
            <span class="axis" />
            <span class="half down">
              <span class="bar without under" :style="{ height: down(column.without) }" />
              <span class="bar neg under" :style="{ height: down(column.with) }" />
            </span>
          </span>
          <span class="month" aria-hidden="true">{{ column.label }}</span>
        </div>
      </div>
    </div>
    <div class="legend">
      <span class="key"><span class="swatch without" />Sans vacances</span>
      <span class="key"><span class="swatch pos" />Avec vacances : positif</span>
      <span class="key"><span class="swatch neg" />Avec vacances : dans le rouge</span>
      <span class="key"><span class="swatch lit" />Mois que tes vacances font passer dans le rouge</span>
    </div>
  </div>
</template>

<style scoped>
.chart { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.scroll { overflow-x: auto; padding: 5px; margin: -5px; }
.grid { min-width: 760px; display: grid; grid-template-columns: repeat(15, minmax(0, 1fr)); gap: 8px; }
.col { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 6px 0; border-radius: 14px; }
.col.lit { background: var(--red-bg); }
.value { font-size: 12px; }
.value.pos { color: #1E6B3A; }
.value.neg { color: #C2272D; }
.plot { height: 180px; width: 80%; display: flex; flex-direction: column; }
.half { flex: 1; display: flex; gap: 3px; }
.half.up { align-items: flex-end; }
.bar { flex: 1; display: block; border-radius: 6px 6px 0 0; }
.bar.under { border-radius: 0 0 6px 6px; }
.bar.without, .swatch.without { background: #D9D2C5; }
.bar.pos, .swatch.pos { background: var(--bar-up); }
.bar.neg, .swatch.neg { background: var(--bar-down); }
.axis { height: 2px; background: var(--ink); }
.month { font-size: 12px; font-weight: 700; color: var(--ink-3); }
.legend { display: flex; gap: 18px; flex-wrap: wrap; font-size: 14px; font-weight: 600; color: var(--ink-3); }
.key { display: flex; align-items: center; gap: 8px; }
.swatch { width: 14px; height: 14px; border-radius: 4px; flex: none; }
.swatch.lit { background: var(--red-bg); }
</style>
