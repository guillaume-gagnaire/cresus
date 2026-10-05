<script setup lang="ts">
/**
 * Charges, desktop (Charges.dc.html l. 57 à 120), dans l’ordre de la maquette : « Ta rémunération », les deux chiffres, puis le
 * tableau des charges avec le formulaire d’ajout à côté. Les calculs viennent du moteur via `useExpensesView` ; ici, la mise en page.
 */
const {
  statuses, status, setStatus, statusHelp, net, setNet, previewNet, cost, comparison, microAlert, assumptions, kpis, rows, note,
  addCharge, updateAmount, removeCharge, deleting,
} = useExpensesView();
</script>

<template>
  <div class="page">
    <header class="head">
      <div class="intro">
        <span class="lbl">Tout ce qui sort, au même endroit</span>
        <h1>Tes charges</h1>
      </div>
    </header>

    <RemunerationCard
      :statuses="statuses"
      :status="status"
      :status-help="statusHelp"
      :net="net"
      :cost="cost"
      :comparison="comparison"
      :micro-alert="microAlert"
      :assumptions="assumptions"
      @update:status="setStatus"
      @preview="previewNet"
      @commit="setNet"
    />

    <div class="kpis">
      <div class="card kpi is-sun" data-testid="kpi-average">
        <span class="lbl label">Par mois, en moyenne</span>
        <span class="num value">{{ kpis.average }}</span>
        <span class="sub">annuelles lissées sur 12 mois</span>
      </div>
      <div class="card kpi is-indigo" data-testid="kpi-year">
        <span class="lbl label">Sur un an</span>
        <span class="num value">{{ kpis.yearly }}</span>
        <span class="sub">{{ kpis.count }}</span>
      </div>
    </div>

    <div class="cols">
      <ChargesTable class="table" :rows="rows" :busy="deleting" :note="note" @update="updateAmount" @remove="removeCharge" />
      <section class="card side" aria-label="Ajouter une charge">
        <ChargeForm @submit="addCharge" />
        <TipBubble title="Quoi mettre&#160;?">
          Ton salaire et tes cotisations sont calculés plus haut. Ajoute ici le reste : abonnements, véhicule, une provision pour les impôts si tu veux. Pas besoin de calendrier fiscal : un montant par mois suffit.
        </TipBubble>
      </section>
    </div>
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: var(--gap-block); }
.head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 20px; }
.intro { display: flex; flex-direction: column; gap: 8px; }
h1 { margin: 0; font-size: 46px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
.kpi { padding: 22px; display: flex; flex-direction: column; gap: 8px; border-color: transparent; }
.kpi.is-sun { background: var(--tip-bg); }
.kpi.is-indigo { background: #ECEBFF; }
.label { color: var(--ink-3); }
.value { font-size: 40px; line-height: 1; overflow-wrap: anywhere; }
.sub { font-size: 14px; color: var(--ink-2); }
.cols { display: flex; flex-wrap: wrap; gap: 18px; align-items: flex-start; }
.table { flex: 2 1 560px; }
.side { flex: 1 1 320px; min-width: 0; padding: 26px; display: flex; flex-direction: column; gap: 14px; }
</style>
