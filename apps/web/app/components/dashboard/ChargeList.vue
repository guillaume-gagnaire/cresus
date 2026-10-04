<script setup lang="ts">
/** « Ce qui sort » (Main.dc.html l. 93 à 98, Mobile-Accueil.dc.html l. 88 à 91) : les charges du mois, la plus lourde d’abord. */
defineProps<{
  rows: { key: string; name: string; sub: string; amount: string }[];
  total: string;
  compact?: boolean;
}>();
</script>

<template>
  <section class="card list" :class="{ compact }">
    <div class="head">
      <h2>Ce qui sort</h2>
      <span class="num total">{{ total }}</span>
    </div>
    <ListRow v-for="row in rows" :key="row.key" :title="row.name" :subtitle="compact ? undefined : row.sub" :amount="row.amount" amount-tone="charge" />
    <NuxtLink v-if="!compact" to="/expenses" class="edit">Modifier mes charges</NuxtLink>
  </section>
</template>

<style scoped>
.list { flex: 1 1 420px; min-width: 0; padding: 26px; display: flex; flex-direction: column; gap: 6px; }
.head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
h2 { margin: 0; font-size: 24px; font-weight: 800; }
.edit { align-self: flex-start; margin-top: 10px; font-size: 15px; }
/* Maquette : lignes de 10 px de marge, sous-titre de 13 px. */
.list :deep(.row) { padding: 10px 0; }
.list :deep(.sub) { font-size: 13px; }

/* Mobile : une ligne par charge, sans sous-titre ni lien (la section Charges a son onglet). */
.compact { flex: none; padding: 4px 16px; gap: 0; }
.compact .head { margin-top: 12px; }
.compact h2 { font-size: 18px; }
.compact :deep(.row) { padding: 12px 0; }
</style>
