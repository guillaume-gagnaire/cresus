<script setup lang="ts">
/**
 * Répartition d’un encaissement (Main-Micro.dc.html l. 70 à 82, Mobile-Accueil-Micro.dc.html l. 64 à 66) : barre
 * horizontale découpée et légende (une tuile par part, montant déjà formaté dans `display`). Chaque part vaut
 * `value / total` de la largeur ; `total` est la base de 100 % choisie par l’écran. Pensé pour se poser sur une carte
 * teintée (tuiles blanc translucide). `compact` : barre de 20 px, légende sur deux colonnes.
 */
const props = withDefaults(
  defineProps<{
    segments: { label: string; value: number; color: string; display: string }[];
    total: number;
    ariaLabel?: string;
    compact?: boolean;
  }>(),
  { ariaLabel: 'Répartition' },
);

const width = (value: number): string => `${props.total > 0 ? Math.max(0, (value / props.total) * 100) : 0}%`;
const summary = computed(() => `${props.ariaLabel} : ${props.segments.map((s) => `${s.label} ${s.display}`).join(', ')}`);
</script>

<template>
  <div class="split" :class="{ compact }" role="img" :aria-label="summary">
    <span class="bar">
      <span v-for="segment in segments" :key="segment.label" :title="segment.label" :style="{ width: width(segment.value), background: segment.color }" />
    </span>
    <div class="legend">
      <div v-for="segment in segments" :key="segment.label" class="tile">
        <span class="name"><span class="swatch" :style="{ background: segment.color }" />{{ segment.label }}</span>
        <span class="num amount">{{ segment.display }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.split { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.bar { display: flex; height: 26px; border-radius: 999px; overflow: hidden; background: rgba(255, 255, 255, .6); }
.legend { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
.tile { padding: 12px 14px; border-radius: 16px; background: rgba(255, 255, 255, .75); display: flex; flex-direction: column; gap: 2px; }
.name { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; }
.swatch { width: 12px; height: 12px; border-radius: 4px; flex: none; }
.amount { font-size: 20px; }
.compact { gap: 14px; }
.compact .bar { height: 20px; }
.compact .legend { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
/* Le montant passe sous le libellé quand la tuile est trop étroite (montants avec espaces insécables). */
.compact .tile { padding: 8px 10px; border-radius: 14px; flex-direction: row; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 2px 6px; }
.compact .name { gap: 6px; font-size: 13px; }
.compact .swatch { width: 10px; height: 10px; border-radius: 3px; }
.compact .amount { font-size: 15px; }
</style>
