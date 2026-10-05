<script setup lang="ts">
/**
 * Version compacte des barres du mois (Mobile-Accueil.dc.html l. 76 à 82, Mobile-Conges.dc.html l. 72 à 78) : une
 * colonne par mois (15), qui tiennent en 350 px, libellés d’une ou deux lettres (`monthLetter`). Les colonnes sont des
 * boutons (44 px de haut ; la largeur est bornée par le nombre de colonnes, le pas-à-pas de mois reste la commande de
 * référence). `readonly` donne l’image seule (écran des congés), `height` règle la hauteur de la zone des barres (100 px
 * par défaut, 120 px dans Mobile-Conges.dc.html).
 * `highlight` (clés de mois) surligne ces mois : teinte + contour en tirets (jamais la couleur seule) et le composant
 * ajoute « (à cause des vacances) » (`highlightLabel`) au nom accessible du mois, ou à la description de l’image en
 * lecture seule. Cette description nomme toujours chaque mois (« … — octobre 2026 : 5 590 € ; novembre 2026 : … ») : les enfants
 * d’une image ne sont pas exposés, la valeur de chaque barre doit donc tenir dans son nom.
 * `barColor` colore les barres positives (couleur d’un client, par exemple) ; `unipolar` est pour des valeurs toutes positives
 * (Mobile-Client.dc.html l. 94 à 96) : piste crème, barres arrondies qui partent du bas et se servent de toute la hauteur, ni
 * demi-hauteur négative ni axe. Une valeur négative n’y est pas tracée. Sans ces deux options, rien ne change.
 */
const props = withDefaults(
  defineProps<{
    bars: { key: string; label: string; valueLabel: string; value: number; aria: string; selected: boolean }[];
    highlight?: string[];
    highlightLabel?: string;
    height?: number;
    ariaLabel?: string;
    readonly?: boolean;
    barColor?: string;
    unipolar?: boolean;
  }>(),
  { highlight: () => [], highlightLabel: 'à cause des vacances', height: 100, ariaLabel: 'Résultat de chaque mois', readonly: false, barColor: undefined, unipolar: false },
);
const emit = defineEmits<{ select: [index: number] }>();

/** Axe de 1,5 px au milieu ; 3 px de marge en bout de demi-hauteur (49 → 46). Unipolaire : toute la hauteur, moins 4 px de marge. */
const reach = computed(() => (props.unipolar ? props.height - 4 : Math.floor((props.height - 1.5) / 2) - 3));
const peak = computed(() => Math.max(1, ...props.bars.map((b) => (props.unipolar ? b.value : Math.abs(b.value)))));
/** Une valeur non nulle garde au moins 2 px : un petit mois ne disparaît pas. */
const px = (n: number): string => `${Math.max(2, Math.round((n / peak.value) * reach.value))}px`;

const isLit = (key: string): boolean => props.highlight.includes(key);
const nameOf = (bar: { key: string; aria: string }): string => (isLit(bar.key) ? `${bar.aria} (${props.highlightLabel})` : bar.aria);
/**
 * Image seule : les colonnes ne sont pas accessibles une à une, la description nomme donc chaque mois, après les mois
 * surlignés s’il y en a.
 */
const summary = computed(() => {
  const lit = props.bars.filter((b) => isLit(b.key));
  const head = lit.length ? `${props.ariaLabel}. Mois ${props.highlightLabel} : ${lit.map((b) => b.aria).join(', ')}` : props.ariaLabel;
  return props.bars.length ? `${head} — ${props.bars.map(nameOf).join(' ; ')}` : head;
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
      <span class="plot" :class="{ unipolar }" :style="{ height: `${height}px` }" aria-hidden="true">
        <span class="half up"><span class="bar pos" :style="{ height: bar.value > 0 ? px(bar.value) : '0px', background: barColor }" /></span>
        <template v-if="!unipolar">
          <span class="axis" />
          <span class="half down"><span class="bar neg" :style="{ height: bar.value < 0 ? px(-bar.value) : '0px' }" /></span>
        </template>
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
.plot.unipolar { border-radius: 8px; background: #FBF5EC; }
.plot.unipolar .bar { width: 100%; border-radius: 8px; }
.letter { font-size: 9px; font-weight: 700; color: var(--muted); }
</style>
