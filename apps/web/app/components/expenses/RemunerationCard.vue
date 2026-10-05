<script setup lang="ts">
/**
 * « Ta rémunération » (Charges.dc.html l. 67 à 94 ; Mobile-Charges.dc.html l. 57 à 71) : la forme juridique, la phrase qui
 * l’explique, le net voulu (curseur de 0 à 8 000 €, ou saisie exacte), l’équation Net + Cotisations = Coût, le même net selon
 * les trois régimes, l’alerte quand la micro est dépassée et l’estimation. `compact` : version mobile.
 * Le curseur n’écrit qu’au relâchement (`change`) ; pendant qu’il glisse, `preview` laisse la page suivre en direct.
 */
import type { LegalStatus } from '@matreso/engine';

const props = defineProps<{
  statuses: readonly { value: LegalStatus; label: string }[];
  status: LegalStatus;
  statusHelp: string;
  /** Net voulu par mois, en centimes. */
  net: number;
  cost: CostView;
  comparison: readonly ComparisonView[];
  microAlert: { text: string; short: string } | null;
  estimate: { long: string; short: string };
  compact?: boolean;
}>();
const emit = defineEmits<{ 'update:status': [value: LegalStatus | LegalStatus[]]; preview: [cents: number]; commit: [cents: number] }>();

const sliderId = useId();
const SLIDER_MAX = 8000;
/** Le curseur est en euros ; au-delà de 8 000 € (saisie exacte), il reste en butée. */
const sliderValue = computed(() => Math.min(SLIDER_MAX, Math.round(props.net / 100)));
const read = (e: Event): number => Math.round(Number((e.target as HTMLInputElement).value) * 100);
</script>

<template>
  <section class="card rem" :class="{ 'is-compact': compact }" aria-labelledby="rem-title">
    <div class="titles">
      <h2 id="rem-title">Ta rémunération</h2>
      <span v-if="!compact" class="sub">Ce que ton salaire coûte vraiment à la société</span>
    </div>

    <ChoiceChips :model-value="status" :options="statuses" ariaLabel="Forme juridique" @update:model-value="emit('update:status', $event)" />
    <span v-if="compact" class="sm">{{ statusHelp }}</span>

    <div class="net">
      <label :for="sliderId" class="net-head">
        <span>{{ compact ? cost.netLabelShort : cost.netLabel }}</span>
        <span class="num net-value">{{ cost.net }}</span>
      </label>
      <input
        :id="sliderId"
        type="range"
        min="0"
        :max="SLIDER_MAX"
        step="50"
        :value="sliderValue"
        @input="emit('preview', read($event))"
        @change="emit('commit', read($event))"
      >
      <MoneyInput class="exact" :model-value="net" label="Montant exact" :min="0" :max="100000" :step="50" @update:model-value="emit('commit', $event ?? 0)" />
      <span v-if="!compact" class="help">{{ statusHelp }}</span>
    </div>

    <template v-if="!compact">
      <div class="equation">
        <div class="cell">
          <span class="lbl">{{ cost.netShort }}</span>
          <span class="num big">{{ cost.net }}</span>
        </div>
        <span class="arr" aria-hidden="true">+</span>
        <div class="cell">
          <span class="lbl">Cotisations</span>
          <span class="num big">{{ cost.contributions }}</span>
          <span class="note">{{ cost.contributionsSub }}</span>
        </div>
        <span class="arr" aria-hidden="true">=</span>
        <div class="cell total">
          <span class="total-label">{{ cost.totalLabel }}</span>
          <span class="num total-value">{{ cost.total }}</span>
          <span class="total-note">soit {{ cost.yearly }} par an</span>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="row line"><span>{{ cost.netShort }}</span><span class="num">{{ cost.net }}</span></div>
      <div class="row line"><span>Cotisations <span class="sm">({{ cost.contributionsShort }})</span></span><span class="num">{{ cost.contributions }}</span></div>
      <div class="total-bar">
        <div class="total-text">
          <span class="total-label">{{ cost.totalLabel }}</span>
          <span class="total-note">{{ cost.yearly }} par an</span>
        </div>
        <span class="num total-value">{{ cost.total }}</span>
      </div>
    </template>

    <div v-if="microAlert" role="status" class="alert">{{ compact ? microAlert.short : microAlert.text }}</div>

    <div class="compare" role="group" aria-labelledby="compare-title">
      <span id="compare-title" class="compare-title">{{ compact ? 'Le même net selon le régime' : 'Le même net selon le régime social' }}</span>
      <div class="cards">
        <template v-if="!compact">
          <div v-for="c in comparison" :key="c.regime" class="option" :class="{ 'is-current': c.current }" :aria-current="c.current ? 'true' : undefined">
            <span class="option-name">{{ c.label }}</span>
            <span class="option-sub">{{ c.sub }}</span>
            <span class="num option-value">{{ c.value }}<span class="per"> / mois</span></span>
          </div>
        </template>
        <template v-else>
          <div v-for="c in comparison" :key="c.regime" class="row option-row" :class="{ 'is-current': c.current }" :aria-current="c.current ? 'true' : undefined">
            <span>{{ c.label }}</span>
            <span class="num">{{ c.value }}</span>
          </div>
        </template>
      </div>
    </div>

    <EstimateNote>{{ compact ? estimate.short : estimate.long }}</EstimateNote>
  </section>
</template>

<style scoped>
.rem { padding: 28px; display: flex; flex-direction: column; gap: 20px; }
.titles { display: flex; flex-direction: column; gap: 6px; }
h2 { margin: 0; font-size: 26px; font-weight: 800; }
.sub { font-size: 16px; color: var(--muted); }

/* Bloc du net : fond indigo clair, libellé et montant sur une ligne, curseur, saisie exacte, puis la phrase d’aide. */
.net { display: flex; flex-direction: column; gap: 6px; padding: 18px; border-radius: 20px; background: #ECEBFF; }
.net-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-weight: 700; color: #23237A; }
.net-value { font-size: 26px; }
.exact { align-self: flex-start; width: 100%; max-width: 220px; font-size: 14px; color: var(--ink-3); }
.exact :deep(input) { min-height: 44px; background: var(--surface); }
.help { font-size: 14px; color: var(--ink-3); }

.equation { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.cell { flex: 1 1 120px; padding: 16px; border-radius: 18px; background: var(--bg); display: flex; flex-direction: column; gap: 2px; }
.big { font-size: 24px; }
.note { font-size: 13px; color: var(--muted); }
.cell.total { flex: 1.3 1 160px; background: var(--ink); color: #fff; }
.total-label { font-size: 15px; font-weight: 600; color: #CFC8E6; }
.total-value { font-size: 28px; }
.total-note { font-size: 13px; color: #CFC8E6; }

.alert { padding: 14px 18px; border-radius: 16px; background: var(--danger-bg); color: var(--danger-ink); font-weight: 600; }

.compare { display: flex; flex-direction: column; gap: 8px; }
.compare-title { font-weight: 700; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
.option { padding: 14px 16px; border-radius: 16px; border: 2px solid var(--border); background: var(--surface); display: flex; flex-direction: column; gap: 2px; }
.option.is-current { border-color: var(--ink); background: var(--tip-bg); }
.option-name { font-weight: 700; }
.option-sub { font-size: 13px; color: var(--muted); }
.option-value { margin-top: 4px; font-size: 22px; }
.per { font-size: 13px; font-weight: 600; }

/* Mobile (Mobile-Charges.dc.html l. 57 à 71) */
.is-compact { padding: 16px; gap: 12px; }
.is-compact h2 { font-size: 19px; }
.is-compact .net { gap: 4px; padding: 12px 14px; border-radius: 16px; }
.is-compact .net-value { font-size: 20px; }
.is-compact .exact { max-width: none; }
.line { padding: 6px 0; }
.total-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 16px; background: var(--ink); color: #fff; }
.total-text { display: flex; flex-direction: column; }
.total-bar .total-label { font-size: 14px; }
.total-bar .total-note { font-size: 12px; }
.total-bar .total-value { font-size: 22px; }
.is-compact .alert { padding: 12px 14px; border-radius: 14px; font-size: 14px; }
.is-compact .compare { gap: 0; }
.is-compact .compare-title { font-size: 15px; }
.is-compact .cards { display: flex; flex-direction: column; gap: 0; }
.option-row { padding: 8px 0; color: var(--muted); }
.option-row.is-current { color: var(--ink); font-weight: 800; }
</style>
