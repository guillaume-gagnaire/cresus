<script setup lang="ts">
/** « Ce qui rentre » (Main.dc.html l. 86 à 92, Mobile-Accueil.dc.html l. 83 à 87) : un paiement client par ligne, daté. */
defineProps<{
  rows: { key: string; name: string; color: string; sub: string; amount: string; lost: string | null }[];
  total: string;
  compact?: boolean;
}>();
</script>

<template>
  <section class="card list" :class="{ compact }">
    <div class="head">
      <h2>Ce qui rentre</h2>
      <span class="num total">{{ total }}</span>
    </div>
    <ListRow v-for="row in rows" :key="row.key" :title="row.name" :subtitle="row.sub" :amount="row.amount" amount-tone="income" :bar-color="row.color">
      <template v-if="row.lost" #extra><span class="lost">{{ row.lost }}</span></template>
    </ListRow>
    <p v-if="rows.length === 0" class="empty">Aucun paiement client attendu ce mois-ci.</p>
  </section>
</template>

<style scoped>
.list { flex: 1 1 420px; min-width: 0; padding: 26px; display: flex; flex-direction: column; gap: 6px; }
.head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
h2 { margin: 0; font-size: 24px; font-weight: 800; }
.total { color: var(--income-ink); }
.lost { font-size: 13px; color: #9A3F08; font-weight: 600; }
.empty { margin: 8px 0 0; color: var(--muted); }

/* Mobile : carte plus serrée, titre de 18 px. */
.compact { flex: none; padding: 4px 16px; gap: 0; }
.compact .head { margin-top: 12px; }
.compact h2 { font-size: 18px; }
.compact .empty { margin: 8px 0 14px; font-size: 13px; }
</style>
