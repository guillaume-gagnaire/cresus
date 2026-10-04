<script setup lang="ts">
/**
 * Carte verdict du mois (Main.dc.html l. 66 à 85, Mobile-Accueil.dc.html l. 58 à 74). Le fond et l’encre viennent de l’état
 * du mois ; le titre d’état est toujours écrit, la couleur ne porte jamais seule le sens.
 * `lg` : chiffre de 72 px et trois tuiles. `sm` : chiffre de 52 px, deux tuiles et un bandeau pour le solde.
 */
withDefaults(defineProps<{ verdict: CompanyVerdict; size?: 'lg' | 'sm'; canPrev: boolean; canNext: boolean }>(), { size: 'lg' });
const emit = defineEmits<{ prev: []; next: [] }>();
</script>

<template>
  <section class="verdict" :class="`size-${size}`" :style="{ background: verdict.style.bg, color: verdict.style.ink }">
    <MonthStepper :label="verdict.monthLabel" :can-prev="canPrev" :can-next="canNext" :size="size" @prev="emit('prev')" @next="emit('next')" />
    <div class="answer">
      <span class="title">{{ verdict.title }}</span>
      <span class="num result">{{ verdict.result }}</span>
      <span class="sentence">{{ verdict.sentence }}</span>
    </div>
    <div class="tiles">
      <div class="tile">
        <span class="tile-label">Rentrées</span>
        <span class="num tile-value income">{{ verdict.income }}</span>
      </div>
      <div class="tile">
        <span class="tile-label">Charges</span>
        <span class="num tile-value">{{ verdict.charges }}</span>
      </div>
      <div class="tile night">
        <span class="tile-label">Sur le compte fin de mois</span>
        <span class="num tile-value">{{ verdict.balance }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.verdict { border-radius: var(--radius-verdict); padding: 30px; display: flex; flex-direction: column; gap: 22px; }
.answer { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
.title { font-size: 20px; font-weight: 700; }
.result { font-size: 72px; letter-spacing: -0.03em; line-height: 1; overflow-wrap: anywhere; }
.sentence { font-size: 17px; max-width: 620px; line-height: 1.5; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.tile { padding: 16px 18px; border-radius: 20px; background: rgba(255, 255, 255, .75); display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.tile-label { font-size: 15px; font-weight: 600; }
.tile-value { font-size: 28px; overflow-wrap: anywhere; }
.tile-value.income { color: var(--income-ink); }
.tile.night { background: var(--ink); color: #fff; }
.tile.night .tile-label { color: #CFC8E6; }

/* Version mobile : carte de 28 px de rayon, deux tuiles côte à côte puis le solde en bandeau. */
.size-sm { border-radius: 28px; padding: 20px; gap: 14px; }
.size-sm .answer { gap: 4px; }
.size-sm .title { font-size: 16px; }
.size-sm .result { font-size: 52px; }
.size-sm .sentence { font-size: 14px; line-height: 1.45; }
.size-sm .tiles { grid-template-columns: 1fr 1fr; gap: 8px; }
.size-sm .tile { padding: 10px 12px; border-radius: 16px; gap: 0; }
.size-sm .tile-label { font-size: 13px; }
.size-sm .tile-value { font-size: 20px; }
.size-sm .tile.night { grid-column: 1 / -1; flex-direction: row; justify-content: space-between; align-items: center; padding: 12px 14px; }
.size-sm .tile.night .tile-label { font-size: 14px; }
</style>
