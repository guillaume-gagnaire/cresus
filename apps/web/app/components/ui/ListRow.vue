<script setup lang="ts">
/**
 * Ligne de liste (Main.dc.html l. 89 à 91) : barre de couleur ou tuile d’icône, titre, sous-titre, montant à droite.
 * `amount` est affiché tel quel : l’appelant le formate, signe compris (`euros(cents, { sign: true })` donne « +1 200 € », « −340 € »).
 * `amountTone` n’agit que sur la couleur. Le slot `extra` s’insère sous le sous-titre (ex. « CA perdu »).
 */
defineProps<{
  title: string;
  subtitle?: string;
  amount?: string;
  amountTone?: 'income' | 'charge' | 'neutral';
  barColor?: string;
}>();
</script>

<template>
  <div class="row item">
    <div class="main">
      <span v-if="barColor" class="bar" :style="{ background: barColor }" aria-hidden="true" />
      <span v-if="$slots.icon" class="icon"><slot name="icon" /></span>
      <div class="text">
        <span class="title">{{ title }}</span>
        <span v-if="subtitle" class="sub">{{ subtitle }}</span>
        <slot name="extra" />
      </div>
    </div>
    <span v-if="amount" class="num amount" :class="amountTone ?? 'neutral'">{{ amount }}</span>
  </div>
</template>

<style scoped>
.main { display: flex; align-items: center; gap: 12px; min-width: 0; }
.bar { flex: none; width: 12px; height: 40px; border-radius: 6px; }
.icon { flex: none; display: flex; }
.text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.title { font-weight: 600; overflow-wrap: anywhere; }
.sub { font-size: 14px; color: var(--muted); }
.amount { font-size: 18px; white-space: nowrap; }
.amount.income { color: var(--income-ink); }
.amount.charge { font-size: 17px; }
/* Mobile (Mobile-Accueil.dc.html l. 85) : barre de 8 × 36, montant au corps du texte */
@media (max-width: 1023.98px) {
  .main { gap: 10px; }
  .bar { width: 8px; height: 36px; border-radius: 4px; }
  .sub { font-size: 13px; }
  .amount, .amount.charge { font-size: 16px; }
}
</style>
