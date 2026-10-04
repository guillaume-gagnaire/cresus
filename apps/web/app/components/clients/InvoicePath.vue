<script setup lang="ts">
/**
 * « Le chemin d’une facture » (Clients.dc.html l. 148 à 156) : on facture, l’échéance tombe, l’argent arrive. Les trois étapes
 * (`.step`) sont reliées par des flèches (`.arr`) et empilées, car le panneau de la fiche est trop étroit pour les poser
 * côte à côte. La phrase d’attente dit combien de jours séparent le travail de l’argent.
 */
defineProps<{ steps: PathStep[]; wait: string }>();
</script>

<template>
  <div class="path">
    <span class="title">Le chemin d’une facture</span>
    <div class="steps">
      <template v-for="(step, i) in steps" :key="step.label">
        <div class="step" :class="{ cash: i === steps.length - 1 }">
          <span>{{ step.label }}</span>
          <b>{{ step.date }}</b>
        </div>
        <span v-if="i < steps.length - 1" class="arr" aria-hidden="true">↓</span>
      </template>
    </div>
    <span class="wait">{{ wait }}</span>
  </div>
</template>

<style scoped>
.path { padding: 18px; border-radius: 20px; background: var(--bg); display: flex; flex-direction: column; gap: 12px; }
.title { font-family: var(--font-display); font-size: 18px; font-weight: 700; }
.steps { display: flex; flex-direction: column; align-items: stretch; }
.steps .step { flex: none; min-width: 0; flex-direction: row; align-items: baseline; justify-content: space-between; gap: 10px; padding: 10px 14px; }
.steps .step span { font-size: 15px; color: var(--ink-2); }
.steps .step.cash b { color: var(--income-ink); font-weight: 800; }
/* Couleur explicite : la couleur de `.arr` (base.css) est celle des surfaces nuit, trop pâle sur ce fond crème. */
.steps .arr { font-size: 18px; line-height: 1.2; color: var(--muted); }
.wait { font-size: 14px; color: var(--muted); }
</style>
