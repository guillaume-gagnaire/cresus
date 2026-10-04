<script setup lang="ts">
/** Tableau de bord micro-entreprise, desktop (Main-Micro.dc.html l. 56 à 133). Les calculs viennent du moteur via le store ; ici, la mise en page. */
const treso = useTresoStore();
const {
  select, prev, next, canPrev, canNext, tiles, split, splitTotal, setAside, years, year, setYear, gauge,
  testMission, testMissionLabel, toggleTestMission, smoothed, bars, notes,
} = useMicroDashboard();
</script>

<template>
  <div class="dash">
    <header class="head">
      <div class="intro">
        <span class="lbl">Mode micro-entreprise</span>
        <h1>Salut {{ treso.profile?.firstName }}&#160;!<br><span class="question">Ce mois-ci, combien il te reste&#160;?</span></h1>
      </div>
      <div class="controls">
        <StatusSwitch />
        <BalanceField />
      </div>
    </header>

    <template v-if="tiles && setAside && gauge">
      <div class="top">
        <ForYouCard class="main-col" :tiles="tiles" :split="split" :split-total="splitTotal" :can-prev="canPrev" :can-next="canNext" @prev="prev" @next="next" />
        <SetAsideCard class="side-col" :set-aside="setAside" />
      </div>

      <div class="bottom">
        <CeilingCard
          class="ceiling-col"
          :gauge="gauge"
          :years="years"
          :year="year"
          :test-mission="testMission"
          :test-mission-label="testMissionLabel"
          @pick-year="setYear"
          @toggle-test="toggleTestMission"
        />

        <section class="card smooth">
          <div class="smooth-title">
            <h2>Combien te verser chaque mois</h2>
            <span class="hint">Ce qui te reste, mois par mois, et la moyenne pour lisser les trous</span>
          </div>
          <div class="band">
            <span class="band-label">Revenu lissé sur 12 mois</span>
            <span class="num band-amount">{{ smoothed.amount }} / mois</span>
          </div>
          <SmoothedBars :bars="bars" :average="smoothed.average" :average-label="smoothed.label" @select="select" />
          <TipBubble title="Pourquoi lisser&#160;?">
            Tes encaissements varient selon les délais de paiement et tes vacances. Te verser chaque mois la moyenne, plutôt que ce qui tombe, t’évite les mois à zéro.
          </TipBubble>
        </section>
      </div>
    </template>

    <div class="notes">
      <p class="sm">{{ notes.long }}</p>
      <EstimateNote />
    </div>
  </div>
</template>

<style scoped>
.dash { display: flex; flex-direction: column; gap: var(--gap-block); }
.head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 20px; }
.intro { display: flex; flex-direction: column; gap: 8px; }
h1 { margin: 0; font-size: 46px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; }
.question { color: var(--muted); font-weight: 500; font-size: 26px; }
.controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-start; }
.top { display: flex; flex-wrap: wrap; gap: 18px; align-items: stretch; }
.main-col { flex: 3 1 560px; }
.side-col { flex: 2 1 340px; }
.bottom { display: flex; flex-wrap: wrap; gap: 18px; align-items: flex-start; }
.ceiling-col { flex: 1 1 520px; }
.smooth { flex: 1 1 520px; min-width: 0; padding: 28px; display: flex; flex-direction: column; gap: 18px; }
.smooth-title { display: flex; flex-direction: column; gap: 6px; }
h2 { margin: 0; font-size: 26px; font-weight: 800; }
.hint { font-size: 16px; color: var(--muted); }
.band { padding: 18px; border-radius: 20px; background: var(--positive-bg); color: var(--positive-ink); display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.band-label { font-weight: 700; font-size: 17px; }
.band-amount { font-size: 30px; }
.notes { display: flex; flex-direction: column; gap: 4px; }
.notes p { margin: 0; font-size: 14px; }
</style>
