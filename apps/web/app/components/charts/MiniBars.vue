<script setup lang="ts">
/**
 * Version compacte des barres du mois (Mobile-Accueil.dc.html l. 76 à 82, Mobile-Conges.dc.html l. 72 à 78) : 15 colonnes
 * qui tiennent en 350 px, libellés d’une ou deux lettres. Les colonnes sont des boutons (44 px de haut ; la largeur est
 * bornée par les 15 colonnes, le pas-à-pas de mois reste la commande de référence). `readonly` donne l’image seule
 * (écran des congés), `highlight` surligne des mois par leur clé, `height` règle la hauteur de la zone des barres
 * (100 px par défaut, 120 px dans Mobile-Conges.dc.html). `label` : 1 ou 2 lettres (`monthLetter`).
 */
const props = withDefaults(
  defineProps<{
    bars: { key: string; label: string; valueLabel: string; value: number; aria: string; selected: boolean }[];
    highlight?: string[];
    height?: number;
    ariaLabel?: string;
    readonly?: boolean;
  }>(),
  { highlight: () => [], height: 100, ariaLabel: 'Résultat de chaque mois', readonly: false },
);
const emit = defineEmits<{ select: [index: number] }>();

/** Axe de 1,5 px au milieu ; 3 px de marge en bout de demi-hauteur (49 → 46). */
const reach = computed(() => Math.floor((props.height - 1.5) / 2) - 3);
const peak = computed(() => Math.max(1, ...props.bars.map((b) => Math.abs(b.value))));
const px = (n: number): string => `${Math.round((n / peak.value) * reach.value)}px`;
</script>

<template>
  <div class="grid" :role="readonly ? 'img' : 'group'" :aria-label="ariaLabel">
    <component
      :is="readonly ? 'span' : 'button'"
      v-for="(bar, i) in bars"
      :key="bar.key"
      class="col"
      :class="{ selected: bar.selected, lit: highlight.includes(bar.key), tap: !readonly }"
      v-bind="readonly ? {} : { type: 'button', 'aria-label': bar.aria, 'aria-pressed': bar.selected }"
      @click="!readonly && emit('select', i)"
    >
      <span class="plot" :style="{ height: `${height}px` }" aria-hidden="true">
        <span class="half up"><span class="bar pos" :style="{ height: bar.value > 0 ? px(bar.value) : '0px' }" /></span>
        <span class="axis" />
        <span class="half down"><span class="bar neg" :style="{ height: bar.value < 0 ? px(-bar.value) : '0px' }" /></span>
      </span>
      <span class="letter" aria-hidden="true">{{ bar.label }}</span>
    </component>
  </div>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(15, minmax(0, 1fr)); gap: 2px; }
.col { border: 0; background: transparent; padding: 4px 0; border-radius: 8px; display: flex; flex-direction: column; align-items: center; gap: 4px; font: inherit; color: var(--ink); min-width: 0; }
.col.tap { cursor: pointer; min-height: 44px; }
.col.lit { background: var(--red-bg); }
.col.selected { background: var(--tip-bg); box-shadow: inset 0 0 0 2px var(--ink); }
.plot { width: 100%; display: flex; flex-direction: column; }
.half { flex: 1; display: flex; justify-content: center; }
.half.up { align-items: flex-end; }
.bar { width: 70%; display: block; }
.bar.pos { border-radius: 4px 4px 0 0; background: var(--bar-up); }
.bar.neg { border-radius: 0 0 4px 4px; background: var(--bar-down); }
.axis { height: 1.5px; background: var(--ink); }
.letter { font-size: 9px; font-weight: 700; color: var(--muted); }
</style>
