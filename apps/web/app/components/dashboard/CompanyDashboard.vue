<script setup lang="ts">
/** Tableau de bord société, desktop (Main.dc.html l. 57 à 117). Les calculs viennent du moteur via le store ; ici, la mise en page. */
const { select, prev, next, canPrev, canNext, verdict, incomeRows, chargeRows, bars, summary, greeting, todayLabel } = useCompanyDashboard();

const SUMMARY_TONES = {
  positive: { bg: 'var(--positive-bg)', ink: 'var(--positive-ink)' },
  warn: { bg: 'var(--red-bg)', ink: 'var(--red-ink)' },
  danger: { bg: 'var(--danger-bg)', ink: 'var(--danger-ink)' },
} as const;
</script>

<template>
  <div class="dash">
    <header class="head">
      <div class="intro">
        <span class="lbl">{{ todayLabel }}</span>
        <h1>{{ greeting }}<br><span class="question">Ce mois-ci, ça passe&#160;?</span></h1>
      </div>
      <div class="controls">
        <StatusSwitch />
        <BalanceField />
      </div>
    </header>

    <template v-if="verdict">
      <VerdictCard :verdict="verdict" size="lg" :can-prev="canPrev" :can-next="canNext" @prev="prev" @next="next" />

      <div class="lists">
        <IncomeList :rows="incomeRows" :total="verdict.income" />
        <ChargeList :rows="chargeRows" :total="verdict.charges" />
      </div>
    </template>

    <section class="card months">
      <div class="months-head">
        <div class="months-title">
          <h2>Mois par mois</h2>
          <span class="hint">Rentrées moins charges. Touche un mois pour le voir en détail.</span>
        </div>
        <span class="summary" :style="{ background: SUMMARY_TONES[summary.tone].bg, color: SUMMARY_TONES[summary.tone].ink }">{{ summary.text }}</span>
      </div>
      <ResultBars :bars="bars" @select="select" />
      <TipBubble title="Pourquoi certains mois sont dans le rouge&#160;?">
        Tes clients ne paient pas le mois où tu travailles : entre ta facture et le virement, il s’écoule souvent 30 à 45 jours, parfois plus. Un mois peut donc être dans le rouge alors que tu as bien travaillé : ton solde sert d’amortisseur. Tes vacances posées sont déjà déduites.
      </TipBubble>
    </section>
  </div>
</template>

<style scoped>
.dash { display: flex; flex-direction: column; gap: var(--gap-block); }
.head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 20px; }
.intro { display: flex; flex-direction: column; gap: 8px; }
h1 { margin: 0; font-size: 46px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; }
.question { color: var(--muted); font-weight: 500; font-size: 26px; }
.controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-start; }
.lists { display: flex; flex-wrap: wrap; gap: 18px; align-items: flex-start; }
.months { padding: 28px; display: flex; flex-direction: column; gap: 18px; }
.months-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; align-items: flex-end; }
.months-title { display: flex; flex-direction: column; gap: 6px; }
h2 { margin: 0; font-size: 26px; font-weight: 800; }
.hint { font-size: 16px; color: var(--muted); }
.summary { padding: 8px 16px; border-radius: var(--radius-pill); font-size: 15px; font-weight: 700; }
</style>
