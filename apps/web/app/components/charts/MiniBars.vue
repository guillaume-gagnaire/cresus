<script setup lang="ts">
/**
 * Version compacte des barres du mois (Mobile-Accueil.dc.html l. 76 à 82, Mobile-Conges.dc.html l. 72 à 78) : une
 * colonne par mois (15), qui tiennent en 350 px, libellés d’une ou deux lettres (`monthLetter`). Les colonnes sont des
 * boutons (44 px de haut ; la largeur est bornée par le nombre de colonnes, le pas-à-pas de mois reste la commande de
 * référence). `readonly` donne l’image seule (écran des congés), `height` règle la hauteur de la zone des barres (100 px
 * par défaut, 120 px dans Mobile-Conges.dc.html).
 * `highlight` (clés de mois) surligne ces mois : teinte + contour en tirets (jamais la couleur seule) et le composant
 * ajoute « (à cause des vacances) » (`highlightLabel`) au nom accessible du mois, ou à la description de l’image en
 * lecture seule.
 */
const props = withDefaults(
  defineProps<{
    bars: { key: string; label: string; valueLabel: string; value: number; aria: string; selected: boolean }[];
    highlight?: string[];
    highlightLabel?: string;
    height?: number;
    ariaLabel?: string;
    readonly?: boolean;
  }>(),
  { highlight: () => [], highlightLabel: 'à cause des vacances', height: 100, ariaLabel: 'Résultat de chaque mois', readonly: false },
);
const emit = defineEmits<{ select: [index: number] }>();

/** Axe de 1,5 px au milieu ; 3 px de marge en bout de demi-hauteur (49 → 46). */
const reach = computed(() => Math.floor((props.height - 1.5) / 2) - 3);
const peak = computed(() => Math.max(1, ...props.bars.map((b) => Math.abs(b.value))));
/** Une valeur non nulle garde au moins 2 px : un petit mois ne disparaît pas. */
const px = (n: number): string => `${Math.max(2, Math.round((n / peak.value) * reach.value))}px`;

const isLit = (key: string): boolean => props.highlight.includes(key);
const nameOf = (bar: { key: string; aria: string }): string => (isLit(bar.key) ? `${bar.aria} (${props.highlightLabel})` : bar.aria);
/** Image seule : les mois surlignés sont nommés dans la description, puisque les colonnes ne sont pas accessibles une à une. */
const summary = computed(() => {
  const lit = props.bars.filter((b) => isLit(b.key));
  return lit.length ? `${props.ariaLabel}. Mois ${props.highlightLabel} : ${lit.map((b) => b.aria).join(', ')}.` : props.ariaLabel;
});
</script>

<template>
  <div
    class="grid"
    :role="readonly ? 'img' : 'group'"
    :aria-label="readonly ? summary : ariaLabel"
    :style="{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }"
  >
    <component
      :is="readonly ? 'span' : 'button'"
      v-for="(bar, i) in bars"
      :key="bar.key"
      class="col chart-col"
      :class="{ selected: bar.selected, lit: isLit(bar.key), tap: !readonly }"
      v-bind="readonly ? {} : { type: 'button', 'aria-label': nameOf(bar), 'aria-pressed': bar.selected }"
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
.grid { display: grid; gap: 2px; }
.col { position: relative; border: 0; background: transparent; padding: 4px 0; border-radius: 8px; display: flex; flex-direction: column; align-items: center; gap: 4px; font: inherit; color: var(--ink); min-width: 0; }
.col.tap { cursor: pointer; min-height: 44px; }
.col.lit { background: var(--red-bg); }
/* Contour en tirets : le mois surligné se distingue aussi sans la teinte (décoratif, le nom accessible le dit). */
.col.lit::after { content: ''; position: absolute; inset: 2px; border: 2px dashed var(--red-ink); border-radius: 6px; pointer-events: none; }
.col.selected { background: var(--tip-bg); box-shadow: inset 0 0 0 2px var(--ink); }
.col.selected.lit::after { inset: 4px; }
.plot { width: 100%; display: flex; flex-direction: column; }
.half { flex: 1; display: flex; justify-content: center; }
.half.up { align-items: flex-end; }
.bar { width: 70%; display: block; }
.bar.pos { border-radius: 4px 4px 0 0; background: var(--bar-up); }
.bar.neg { border-radius: 0 0 4px 4px; background: var(--bar-down); }
.axis { height: 1.5px; background: var(--ink); }
.letter { font-size: 9px; font-weight: 700; color: var(--muted); }
</style>
