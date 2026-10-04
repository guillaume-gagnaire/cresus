<script setup lang="ts">
/**
 * Carte « Pour toi ce mois-ci » (Main-Micro.dc.html l. 61 à 83, Mobile-Accueil-Micro.dc.html l. 53 à 67) : pas-à-pas de mois,
 * ce qu’il te reste, puis la répartition de l’encaissement. Teinte verte, ou orange pour un mois bas : la phrase « Mois bas »
 * le dit aussi en toutes lettres, la couleur ne porte jamais seule le sens.
 * `lg` : chiffre de 72 px. `sm` : chiffre de 52 px, répartition compacte (mobile).
 */
type Segment = { label: string; value: number; color: string; display: string };

withDefaults(
  defineProps<{
    tiles: { forYou: string; income: string; low: boolean; monthLabel: string };
    split: Segment[];
    splitTotal: number;
    canPrev: boolean;
    canNext: boolean;
    size?: 'lg' | 'sm';
  }>(),
  { size: 'lg' },
);
const emit = defineEmits<{ prev: []; next: [] }>();
</script>

<template>
  <section class="foryou" :class="[`is-${size}`, tiles.low ? 'low' : 'ok']">
    <MonthStepper :label="tiles.monthLabel" :can-prev="canPrev" :can-next="canNext" :size="size" @prev="emit('prev')" @next="emit('next')" />
    <div class="answer">
      <span class="title">Pour toi ce mois-ci</span>
      <span class="num amount">{{ tiles.forYou }}</span>
      <span class="income">{{ tiles.income }}</span>
      <span v-if="tiles.low" class="low-note">Mois bas : nettement sous ta moyenne lissée.</span>
    </div>
    <SplitBar :segments="split" :total="splitTotal" :compact="size === 'sm'" ariaLabel="Répartition de ce que tu encaisses ce mois-ci" />
  </section>
</template>

<style scoped>
.foryou { border-radius: var(--radius-verdict); padding: 28px; display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.ok { background: var(--positive-bg); color: var(--positive-ink); }
.low { background: var(--red-bg); color: var(--red-ink); }
.answer { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
.title { font-size: 20px; font-weight: 700; }
.amount { font-size: 72px; letter-spacing: -0.03em; line-height: 1; overflow-wrap: anywhere; }
.income { font-size: 16px; }
.low-note { font-size: 15px; font-weight: 700; }

/* Version mobile : carte de 28 px de rayon, chiffre de 52 px. */
.is-sm { border-radius: 28px; padding: 20px; gap: 14px; }
.is-sm .answer { gap: 4px; }
.is-sm .title { font-size: 16px; }
.is-sm .amount { font-size: 52px; }
.is-sm .income { font-size: 14px; }
.is-sm .low-note { font-size: 14px; }
</style>
