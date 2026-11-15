<script setup lang="ts">
import type { ArticleDto, EventDto, SummaryDto } from '@cresus/shared';
import { formatDateLong, formatEuros, salesLabel } from '~/utils/format';

const props = defineProps<{ event: EventDto; articles: ArticleDto[]; summary: SummaryDto; exportHref: string; subtitle?: string }>();

const lines = computed(() =>
  props.articles
    .map((article) => ({ article, totals: props.summary.articles.find((a) => a.articleId === article.id) ?? { count: 0, revenueCents: 0 } }))
    .filter(({ article, totals }) => !article.archived || totals.count > 0),
);
</script>

<template>
  <div class="bilan">
    <header class="head">
      <h1>Bilan</h1>
      <p class="sub">{{ subtitle ?? event.name }} · {{ formatDateLong(event.date) }}</p>
    </header>

    <section class="card total-card" aria-label="Total">
      <div class="totals">
        <span class="total num" data-testid="bilan-total">{{ formatEuros(summary.revenueCents) }}</span>
        <span class="count num" data-testid="bilan-count">{{ salesLabel(summary.salesCount) }}</span>
      </div>
      <a :href="exportHref" download class="btn btn-primary btn-big btn-block"><AppIcon name="download" /> Exporter en Excel</a>
      <span class="export-hint">Récapitulatif, détail des ventes et ventes par heure</span>
    </section>

    <section class="card block" aria-labelledby="by-article">
      <h2 id="by-article">Par article</h2>
      <table v-if="lines.length > 0">
        <thead>
          <tr>
            <th scope="col">Article</th>
            <th scope="col" class="right">Qté</th>
            <th scope="col" class="right">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="{ article, totals } in lines" :key="article.id">
            <td>
              <span class="who">
                <PictoImg :name="article.name" :picto="article.picto" :size="30" />
                <span class="who-text">
                  <span class="name">{{ article.name }}</span>
                  <span class="note num">{{ article.archived ? 'retiré de la caisse' : formatEuros(article.priceCents) }}</span>
                </span>
              </span>
            </td>
            <td class="right num qty">{{ totals.count }}</td>
            <td class="right num money">{{ formatEuros(totals.revenueCents) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">Pas encore d’article.</p>
    </section>

    <section v-if="summary.byHour.length > 0" class="card block" aria-labelledby="by-hour">
      <h2 id="by-hour">Par heure</h2>
      <HourBars :hours="summary.byHour" />
    </section>

    <slot />
  </div>
</template>

<style scoped>
.bilan {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 640px;
  width: 100%;
  margin: 0 auto;
}
.head {
  padding: 0 4px;
}
.sub {
  font-size: 15px;
  font-weight: 800;
  color: var(--muted);
}
.sub {
  margin-top: 2px;
}
h1 {
  font-size: 28px;
  letter-spacing: -0.01em;
}
h2 {
  font-size: 18px;
}
.total-card {
  padding: 20px 18px;
  border-radius: var(--radius-big);
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.totals {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.total {
  font-size: 48px;
  font-weight: 900;
  color: var(--ink);
  letter-spacing: -0.02em;
  line-height: 1;
}
.count {
  font-size: 17px;
  font-weight: 800;
  color: var(--muted);
}
.export-hint {
  font-size: 14px;
  font-weight: 600;
  color: var(--muted);
  text-align: center;
}
.block {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th {
  padding: 6px 0;
  font-size: 13px;
  font-weight: 800;
  color: var(--muted);
  text-align: left;
}
td {
  padding: 9px 0;
  border-top: 1px solid var(--rule);
}
.right {
  text-align: right;
}
.who {
  display: flex;
  align-items: center;
  gap: 10px;
}
.who-text {
  display: flex;
  flex-direction: column;
}
.name {
  font-size: 16px;
  font-weight: 800;
  color: var(--ink);
}
.note {
  font-size: 13px;
  font-weight: 700;
  color: var(--muted);
}
.qty {
  font-size: 16px;
  font-weight: 800;
}
.money {
  font-size: 16px;
  font-weight: 900;
  color: var(--ink);
  padding-left: 12px;
}
.empty {
  font-weight: 600;
}
</style>
