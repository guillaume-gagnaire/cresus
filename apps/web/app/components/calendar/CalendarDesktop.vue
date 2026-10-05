<script setup lang="ts">
/**
 * Calendrier & congés, desktop (Calendrier.dc.html l. 57 à 159), dans l’ordre de la maquette : les quatre chiffres, le calendrier
 * avec le formulaire et les périodes à côté, ce que les vacances font à chaque mois, puis le tableau. Les calculs viennent du
 * moteur via `useCalendarView` ; ici, la mise en page.
 */
const {
  monthLabel, range, canPrev, canNext, prev, next, selectedTarget, setTarget, targetOptions, days, legend, toggleDay, kpis, alert,
  impactColumns, tableRows, periods, deletePeriod, deleting, includeProspect, hasProspects, prospectLabel, toggleProspect, addPeriod, adding, lastMessage,
} = useCalendarView();
</script>

<template>
  <div class="page">
    <header class="head">
      <div class="intro">
        <span class="lbl">{{ range }}</span>
        <h1>Tes vacances, ta tréso</h1>
      </div>
    </header>

    <div class="kpis">
      <KpiCard data-testid="kpi-days" label="Jours posés" :value="kpis.days.value" :sub="kpis.days.sub" :tone="kpis.days.tone" />
      <KpiCard data-testid="kpi-lost" label="CA perdu" :value="kpis.lost.value" :sub="kpis.lost.sub" :tone="kpis.lost.tone" />
      <KpiCard data-testid="kpi-low" label="Point le plus bas" :value="kpis.low.value" :sub="kpis.low.sub" :tone="kpis.low.tone" :value-color="kpis.low.valueColor" />
      <KpiCard data-testid="kpi-risk" label="Mois dans le rouge" :value="kpis.risk.value" :sub="kpis.risk.sub" :tone="kpis.risk.tone" :value-color="kpis.risk.valueColor" />
    </div>

    <div class="cols">
      <section class="card cal-card" aria-label="Calendrier">
        <MonthStepper :label="monthLabel" :can-prev="canPrev" :can-next="canNext" @prev="prev" @next="next" />
        <div class="mode">
          <span class="hint">Touche un jour pour le poser chez&#160;:</span>
          <ChoiceChips :model-value="selectedTarget" :options="targetOptions" ariaLabel="Poser le congé chez" @update:model-value="setTarget" />
        </div>
        <MonthCalendar :days="days" :label="monthLabel" :legend="legend" @toggle="toggleDay" />
      </section>

      <section class="card side" aria-label="Poser des vacances et périodes posées">
        <LeaveForm
          :options="targetOptions"
          :target="selectedTarget"
          :message="lastMessage"
          :busy="adding"
          @update:target="setTarget"
          @submit="(from, to) => addPeriod(from, to)"
        />
        <LeavePeriods :periods="periods" :busy="deleting" @remove="deletePeriod" />
      </section>
    </div>

    <section class="card impact" aria-labelledby="impact-title">
      <div class="impact-head">
        <div class="titles">
          <h2 id="impact-title">Ce que tes vacances font à chaque mois</h2>
          <span class="sub">Rentrées moins charges. L’argent manque quand le client aurait payé, selon son délai.</span>
        </div>
        <label v-if="hasProspects" class="pistes"><input type="checkbox" :checked="includeProspect" @change="toggleProspect">{{ prospectLabel }}</label>
      </div>
      <div role="status" class="alert" :style="{ background: alert.style.bg, color: alert.style.ink }">{{ alert.text }}</div>
      <LeaveImpactBars :columns="impactColumns" />
    </section>

    <MonthTable :rows="tableRows" />

    <TipBubble title="Pourquoi l’impact arrive plus tard&#160;?">
      Un jour de vacances coûte le TJM du client que tu aurais vu ce jour-là. Mais l’argent ne manque qu’au moment où ce client t’aurait payé, selon son délai de paiement et son retard habituel : un mois après pour un paiement à 30 jours fin de mois, près de deux mois pour 45 jours. Des vacances d’août se sentent donc en septembre ou en octobre. Un forfait mensuel, lui, ne baisse pas pendant tes congés.
    </TipBubble>
    <p class="foot">Sorties : les charges de l’onglet Charges (salaire, cotisations, provision impôts…). Montants HT. Simulation indicative.</p>
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: var(--gap-block); }
.head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 20px; }
.intro { display: flex; flex-direction: column; gap: 8px; }
h1 { margin: 0; font-size: 46px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
.cols { display: flex; flex-wrap: wrap; gap: 18px; align-items: flex-start; }
/* Pas `.cal` : ce nom est celui de la racine de `MonthCalendar`, qui recevrait ces styles (padding, flex). */
.cal-card { flex: 1 1 520px; min-width: 0; padding: 26px; display: flex; flex-direction: column; gap: 16px; --stepper-border: var(--field-border); --stepper-bg: var(--surface); --stepper-bg-hover: var(--field-bg); }
.side { flex: 1 1 400px; min-width: 0; padding: 26px; display: flex; flex-direction: column; gap: 16px; }
.mode { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; }
.hint { font-size: 15px; color: var(--muted); font-weight: 600; }
.impact { min-width: 0; padding: 28px; display: flex; flex-direction: column; gap: 20px; }
.impact-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 14px; align-items: flex-end; }
.titles { display: flex; flex-direction: column; gap: 6px; }
h2 { margin: 0; font-size: 26px; font-weight: 800; }
.sub { font-size: 16px; color: var(--muted); }
.pistes { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 18px; border-radius: var(--radius-pill); background: #F1EAFE; font-weight: 600; cursor: pointer; }
.pistes input { width: 20px; height: 20px; accent-color: #6A3FC9; }
.alert { padding: 16px 20px; border-radius: 18px; font-size: 17px; font-weight: 600; line-height: 1.5; }
.foot { margin: 0; font-size: 14px; color: var(--muted); }
</style>
