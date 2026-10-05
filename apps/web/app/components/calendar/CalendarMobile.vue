<script setup lang="ts">
/**
 * Congés, mobile (Mobile-Conges.dc.html l. 51 à 96), dans l’ordre de la maquette : le bandeau, les quatre chiffres, le calendrier,
 * « Mois par mois », « Tes périodes ». Le formulaire de pose d’une période, absent de la maquette, se déplie derrière le bouton
 * « Poser des vacances ». Les barres des 15 mois sont étroites : le pas-à-pas de mois du calendrier (44 px) reste la commande.
 */
const {
  months, monthLabel, canPrev, canNext, prev, next, selectedTarget, setTarget, targetOptions, targetShortOptions, days, holidayCaption, toggleDay,
  kpis, alert, miniBars, litMonths, impactedMonths, periods, deletePeriod, addPeriod, adding, lastMessage,
} = useCalendarView();

const formOpen = ref(false);
</script>

<template>
  <div class="page">
    <header class="head">
      <div class="intro">
        <span class="lbl">Simulation sur {{ months.length }} mois</span>
        <h1>Tes vacances</h1>
      </div>
      <ProfileBadge size="md" link />
    </header>

    <div role="status" class="alert" :style="{ background: alert.style.bg, color: alert.style.ink }">{{ alert.text }}</div>

    <div class="kpis">
      <KpiCard data-testid="kpi-days" label="Jours posés" :value="kpis.days.value" :sub="kpis.days.sub" :tone="kpis.days.tone" />
      <KpiCard data-testid="kpi-lost" label="CA perdu" :value="kpis.lost.value" sub="encaissé plus tard" :tone="kpis.lost.tone" />
      <KpiCard data-testid="kpi-low" label="Point bas" :value="kpis.low.value" :sub="kpis.low.sub" :tone="kpis.low.tone" :value-color="kpis.low.valueColor" />
      <KpiCard data-testid="kpi-risk" label="Mois dans le rouge" :value="kpis.risk.value" :sub="kpis.risk.sub" :tone="kpis.risk.tone" :value-color="kpis.risk.valueColor" />
    </div>

    <section class="card cal-card" aria-label="Calendrier">
      <MonthStepper size="sm" :label="monthLabel" :can-prev="canPrev" :can-next="canNext" @prev="prev" @next="next" />
      <SegmentedControl :model-value="selectedTarget" :options="targetShortOptions" ariaLabel="Poser le congé chez" @update:model-value="setTarget" />
      <MonthCalendar compact :days="days" :label="monthLabel" @toggle="toggleDay" />
      <span class="sm">Touche un jour travaillé pour poser ou retirer un congé.</span>
      <span v-if="holidayCaption" class="sm">{{ holidayCaption }}</span>
    </section>

    <section class="card months-card" aria-labelledby="months-title">
      <div class="months-head">
        <h2 id="months-title">Mois par mois</h2>
        <span class="sm">rentrées − charges</span>
      </div>
      <MiniBars :bars="miniBars" :highlight="litMonths" :height="120" readonly ariaLabel="Résultat de chaque mois, avec vacances" />
      <div class="legend">
        <span class="key"><span class="swatch pos" />Positif</span>
        <span class="key"><span class="swatch neg" />Dans le rouge</span>
        <span class="key"><span class="swatch lit" />À cause des vacances</span>
      </div>
      <ul class="impacted" aria-label="Mois à surveiller">
        <li v-for="m in impactedMonths" :key="m.key" class="row">
          <div class="what">
            <span class="month">{{ m.month }}</span>
            <span class="sm">{{ m.sub }}</span>
          </div>
          <div class="state">
            <span class="num amount" :class="m.negative ? 'neg' : 'pos'">{{ m.amount }}</span>
            <AppBadge class="tag" :bg="m.badge.bg" :fg="m.badge.fg">{{ m.badge.label }}</AppBadge>
          </div>
        </li>
      </ul>
    </section>

    <section class="card periods-card" aria-labelledby="periods-title">
      <h2 id="periods-title">Tes périodes</h2>
      <LeavePeriods compact :periods="periods" @remove="deletePeriod" />
    </section>

    <AppButton variant="primary" block class="open" :aria-controls="formOpen ? 'leave-form' : undefined" :aria-expanded="formOpen" @click="formOpen = !formOpen">
      <AppIcon name="plus" :size="20" />Poser des vacances
    </AppButton>
    <section v-if="formOpen" id="leave-form" class="card form-card" aria-label="Poser des vacances">
      <LeaveForm compact :options="targetOptions" :target="selectedTarget" :message="lastMessage" :busy="adding" @update:target="setTarget" @submit="(from, to) => addPeriod(from, to)" />
    </section>

    <TipBubble title="Pourquoi plus tard&#160;?" compact>
      Un congé coûte le TJM du jour, mais l’argent manque quand le client aurait payé : souvent un mois plus tard, parfois près de deux, selon son délai de paiement.
    </TipBubble>
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 18px; }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding-top: 6px; }
.intro { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.lbl { font-size: 14px; }
h1 { margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; }
.alert { padding: 14px 16px; border-radius: 18px; font-size: 15px; font-weight: 600; line-height: 1.45; }
.kpis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
/* 12 px de marge et 2 px entre les cases : les sept colonnes gardent 44 px de large à 390 px. */
/* Pas `.cal`, `.periods` ni `.form` : ce sont les noms des racines de `MonthCalendar`, `LeavePeriods` et `LeaveForm`, qui recevraient ces styles. */
.cal-card { padding: 12px; display: flex; flex-direction: column; gap: 10px; --stepper-border: var(--field-border); --stepper-bg: var(--surface); --stepper-bg-hover: var(--field-bg); }
.months-card { padding: 16px; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.months-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
h2 { margin: 0; font-size: 19px; font-weight: 800; }
.legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; font-weight: 600; color: var(--ink-3); }
.key { display: flex; align-items: center; gap: 5px; }
.swatch { flex: none; width: 10px; height: 10px; border-radius: 3px; }
.swatch.pos { background: var(--bar-up); }
.swatch.neg { background: var(--bar-down); }
.swatch.lit { background: var(--red-bg); border: 1.5px dashed var(--red-ink); }
.impacted { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.what { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.month { font-weight: 600; text-transform: capitalize; }
.state { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.amount { font-size: 16px; }
.amount.pos { color: #1E6B3A; }
.amount.neg { color: #C2272D; }
.row .tag { padding: 2px 8px; font-size: 11px; }
.periods-card { padding: 4px 16px; }
.periods-card h2 { margin: 12px 0 0; }
.open { min-height: 54px; }
.form-card { padding: 16px; }
</style>
