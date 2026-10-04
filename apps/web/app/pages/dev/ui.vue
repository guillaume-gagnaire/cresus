<script setup lang="ts">
import {
  billedVsCashed, ceilingGauge, demoInput, euros, kEuros, longDate, microMonths, missionTimeline, monthLabel, monthLetter,
  monthResults, monthShort, shortDate, smoothedIncome, type MonthKey,
} from '@matreso/engine';

// Page de démonstration du kit UI : n’existe qu’en développement (et sert de support aux tests e2e).
definePageMeta({ middleware: [() => { if (!import.meta.dev) return navigateTo('/'); }] });

const status = ref<'company' | 'micro'>('company');
const statusOptions = [
  { value: 'company', label: 'Société' },
  { value: 'micro', label: 'Micro-entreprise' },
] as const;

const days = ref<number[]>([]);
const dayOptions = WEEKDAY_SHORT.map((label, value) => ({ value, label, ariaLabel: WEEKDAY_LONG[value] }));

const delay = ref(30);
const delayOptions = [30, 45, 60].map((value) => ({ value, label: `${value} jours` }));

const color = ref('indigo');
const colorOptions = Object.entries(PALETTE).map(([value, p]) => ({ value, label: p.label, color: { bg: p.base, fg: p.fg } }));

const switchOn = ref(false);
const money = ref<number | null>(null);
const date = ref<string | null>(null);

const MONTHS = ['octobre 2026', 'novembre 2026', 'décembre 2026'];
const monthLg = ref(0);
const monthSm = ref(0);

const clicks = ref(0);

const dialogOpen = ref<'plain' | 'password' | null>(null);
const dialogResult = ref('aucun');
function closeDialog(result: string): void {
  dialogResult.value = result;
  dialogOpen.value = null;
}

// --- Graphiques : jeux de démo tirés du moteur (demoInput) et des fonctions de format ---
const demo = demoInput();
const results = monthResults(demo);
const micro = microMonths(demo);
/** « oct. 26 » pour le premier mois et chaque janvier, « nov. » sinon (libellés des maquettes). */
const monthTag = (month: MonthKey, i: number): string => monthShort(month) + (i === 0 || month.endsWith('-01') ? ` ${month.slice(2, 4)}` : '');

const chartMonth = ref(1);
const resultBars = computed(() =>
  results.map((r, i) => ({
    key: r.month,
    label: monthTag(r.month, i),
    valueLabel: kEuros(r.result),
    value: r.result,
    aria: `${monthLabel(r.month)} : ${euros(r.result, { sign: true })}`,
    selected: i === chartMonth.value,
  })),
);
const miniBars = computed(() => resultBars.value.map((b, i) => ({ ...b, label: monthLetter(results[i]!.month) })));
const litMonths = results.filter((r) => r.state === 'RED_DUE_TO_LEAVES').map((r) => r.month);

const withProspects = ref(false);
const selectedMission = ref('client-a');
const timeline = computed(() => missionTimeline(demo, { includeProspects: withProspects.value }));
const timelineRows = computed(() =>
  timeline.value.bars.map((bar) => {
    const c = demo.clients.find((x) => x.id === bar.clientId)!;
    return {
      id: c.id,
      name: c.name,
      sub: c.isProspect ? 'Piste' : c.billingMode === 'FORFAIT' ? `Forfait · ${c.subtitle ?? ''}` : (c.subtitle ?? ''),
      leftPct: bar.leftPct,
      widthPct: bar.widthPct,
      openEnd: bar.openEnd,
      prospect: c.isProspect,
      dimmed: c.isProspect && !withProspects.value,
      selected: c.id === selectedMission.value,
      color: PALETTE[c.color],
      label: `${shortDate(c.startDate)} → ${c.endDate ? shortDate(c.endDate) : '…'}`,
      aria: `Ouvrir ${c.name} : Du ${longDate(c.startDate)}${c.endDate ? ` au ${longDate(c.endDate)}` : ', sans fin'}`,
    };
  }),
);
const timelineGaps = computed(() =>
  timeline.value.months.map((m, i) => ({ label: `${monthShort(m)} : ${euros(timeline.value.billed[i]!)} facturés`, low: timeline.value.lowMonths.includes(m) })),
);
const timelineMessage = computed(() => {
  const low = timeline.value.lowMonths;
  return low.length
    ? { text: `Creux repéré : ${low.map(monthLabel).join(', ')}.`, tone: 'warn' as const }
    : { text: 'Aucun creux sur 12 mois : tes jours sont remplis.', tone: 'ok' as const };
});

const gauge = ceilingGauge(demo, 2026);
const gaugeScale = Math.max(gauge.ceiling * 1.1, gauge.total);
const gaugeTone = { OK: { color: '#2E9E6A', soft: '#CDEBD8' }, WARN: { color: '#E0A800', soft: '#FFF1B8' }, OVER: { color: '#E5484D', soft: '#FBD2CE' } }[gauge.level];
const gaugePct = { actual: (gauge.actual / gaugeScale) * 100, planned: (gauge.planned / gaugeScale) * 100, vat: (gauge.vatThreshold / gaugeScale) * 100 };
const gaugeLabel = `Plafond de chiffre d’affaires ${gauge.year} : ${euros(gauge.total)} sur ${euros(gauge.ceiling)} autorisés (${gauge.pct} %), seuil de TVA à ${euros(gauge.vatThreshold)}`;

const cash = billedVsCashed(demo);
const stackedColumns = (label: (m: MonthKey) => string) =>
  cash.map((m) => ({
    label: label(m.month),
    totalLabel: m.cashedTotal ? kEuros(m.cashedTotal, { sign: false }) : '0',
    segments: [...demo.clients]
      .reverse()
      .filter((c) => m.cashed[c.id])
      .map((c) => ({ value: m.cashed[c.id]!, color: PALETTE[c.color].base, faded: c.isProspect })),
  }));
const stackedFull = stackedColumns(monthShort);
const stackedMini = stackedColumns(monthLetter);
const stackedAria = cash.map((m) => `${monthLabel(m.month)} : ${euros(m.cashedTotal)} encaissés`);

const leaveColumns = results.map((r, i) => ({
  label: monthTag(r.month, i),
  without: r.resultWithoutLeaves,
  with: r.result,
  highlight: r.state === 'RED_DUE_TO_LEAVES',
  aria: `${monthLabel(r.month)} : ${euros(r.resultWithoutLeaves, { sign: true })} sans vacances, ${euros(r.result, { sign: true })} avec vacances`,
  valueLabel: kEuros(r.result),
}));

const split = micro[1]!.breakdown;
const splitSegments = [
  { label: 'Cotisations', value: split.contributions, color: '#FF8A3D', display: euros(split.contributions) },
  { label: 'Impôt', value: split.tax, color: '#9B6BFF', display: euros(split.tax) },
  { label: 'Frais pro', value: split.proExpenses, color: '#B9B2CC', display: euros(split.proExpenses) },
  { label: 'Pour toi', value: Math.max(0, split.forYou), color: '#2E9E6A', display: euros(split.forYou) },
];
const splitTotal = Math.max(split.income, split.proExpenses);

const smoothedMonth = ref(1);
const smoothing = smoothedIncome(micro);
const smoothedBars = (label: (m: MonthKey, i: number) => string) =>
  micro.map((m, i) => ({
    key: m.month,
    label: label(m.month, i),
    value: m.breakdown.forYou,
    low: smoothing.lowMonths.includes(m.month),
    aria: `${monthLabel(m.month)} : ${euros(m.breakdown.forYou)} pour toi`,
    selected: i === smoothedMonth.value,
  }));
const smoothedFull = computed(() => smoothedBars(monthTag));
const smoothedMini = computed(() => smoothedBars((m) => monthLetter(m)));
const smoothedAverage = `Moyenne lissée : ${euros(smoothing.average)} par mois`;

// Valeurs minuscules : une valeur non nulle garde au moins 2 px, zéro n’a pas de barre.
const tinyBars = [1_000_000, 4_000, -4_000, 0].map((value, i) => ({
  key: `tiny-${i}`,
  label: ['A', 'B', 'C', 'D'][i]!,
  valueLabel: kEuros(value),
  value,
  aria: `Mois ${['A', 'B', 'C', 'D'][i]} : ${euros(value, { sign: true })}`,
  selected: false,
}));
</script>

<template>
  <div class="demo">
    <h1>Kit UI</h1>

    <section class="card block">
      <h2>Boutons</h2>
      <div class="line">
        <AppButton variant="primary" @click="clicks++">Principal</AppButton>
        <AppButton @click="clicks++">Secondaire</AppButton>
        <AppButton variant="ghost" @click="clicks++">Discret</AppButton>
        <AppButton disabled @click="clicks++">Indisponible</AppButton>
      </div>
      <AppButton variant="primary" block @click="clicks++">Pleine largeur</AppButton>
      <p class="sm">Clics : <output data-testid="click-count">{{ clicks }}</output></p>
    </section>

    <section class="card block">
      <h2>Sélection</h2>
      <SegmentedControl v-model="status" ariaLabel="Démo segment" :options="statusOptions" />
      <p class="sm">Statut : <output data-testid="seg-value">{{ status }}</output></p>
      <ChoiceChips v-model="days" multiple ariaLabel="Démo jours" :options="dayOptions" />
      <p class="sm">Jours : <output data-testid="days-value">{{ days.join(',') }}</output></p>
      <ChoiceChips v-model="delay" ariaLabel="Démo délai" :options="delayOptions" />
      <p class="sm">Délai : <output data-testid="delay-value">{{ delay }}</output></p>
      <ChoiceChips v-model="color" ariaLabel="Démo couleur" :options="colorOptions" />
      <ToggleSwitch v-model="switchOn" label="Démo interrupteur" />
    </section>

    <section class="card block">
      <h2>Saisie</h2>
      <MoneyInput v-model="money" label="Démo montant" :min="0" :max="10000" :step="5" />
      <p class="sm">Centimes : <output data-testid="money-value">{{ String(money) }}</output></p>
      <DateInput v-model="date" label="Démo date" />
      <p class="sm">Date : <output data-testid="date-value">{{ date ?? '' }}</output></p>
    </section>

    <section class="card block">
      <h2>Navigation par mois</h2>
      <div data-testid="stepper-lg">
        <MonthStepper
          :label="MONTHS[monthLg]!"
          :can-prev="monthLg > 0"
          :can-next="monthLg < MONTHS.length - 1"
          @prev="monthLg--"
          @next="monthLg++"
        />
      </div>
      <div data-testid="stepper-sm">
        <MonthStepper
          size="sm"
          :label="MONTHS[monthSm]!"
          :can-prev="monthSm > 0"
          :can-next="monthSm < MONTHS.length - 1"
          @prev="monthSm--"
          @next="monthSm++"
        />
      </div>
    </section>

    <section class="card block">
      <h2>Cartes et pastilles</h2>
      <div class="kpis">
        <KpiCard label="Neutre" value="12 j" sub="sous-titre" />
        <KpiCard label="Positif" value="1 200 €" sub="aucun" tone="positive" />
        <KpiCard label="Jours posés" value="12 j" sub="3 périodes" tone="warn" />
        <KpiCard label="Découvert" value="−2 310 €" sub="en février" tone="danger" value-color="#B3261E" />
        <KpiCard label="CA perdu" value="4 800 €" sub="encaissé en moins, plus tard" tone="info" />
      </div>
      <div class="line">
        <AppBadge :bg="STATE_STYLE.POSITIVE.badgeBg" :fg="STATE_STYLE.POSITIVE.badgeInk">{{ STATE_STYLE.POSITIVE.label }}</AppBadge>
        <AppBadge :bg="STATE_STYLE.RED.badgeBg" :fg="STATE_STYLE.RED.badgeInk">{{ STATE_STYLE.RED.label }}</AppBadge>
        <AppBadge :bg="STATE_STYLE.OVERDRAFT.badgeBg" :fg="STATE_STYLE.OVERDRAFT.badgeInk">{{ STATE_STYLE.OVERDRAFT.label }}</AppBadge>
      </div>
    </section>

    <section class="card block">
      <h2>Lignes de liste</h2>
      <div>
        <ListRow title="Client A" subtitle="Paiement à 30 jours fin de mois" :amount="euros(120000, { sign: true })" amount-tone="income" :bar-color="PALETTE.indigo.base">
          <template #extra><span class="lost">1 jour de congé en moins</span></template>
        </ListRow>
        <ListRow title="Cotisations sociales" subtitle="Chaque mois" :amount="euros(-34000)" amount-tone="charge">
          <template #icon><span class="ico tile"><AppIcon :name="categoryIcon('Social')" :size="22" /></span></template>
        </ListRow>
        <ListRow title="Sans montant" subtitle="Titre et sous-titre seulement" />
      </div>
    </section>

    <section class="card block">
      <h2>Astuces, états vides et mention</h2>
      <TipBubble title="Pourquoi certains mois sont dans le rouge ?">Tes clients paient avec un décalage : un mois peut être dans le rouge alors que tu as bien travaillé.</TipBubble>
      <TipBubble compact title="Pourquoi un mois dans le rouge ?">Ton solde sert d’amortisseur.</TipBubble>
      <EmptyState title="Aucune charge pour le moment" text="Ajoute ton loyer, ton assurance ou tes abonnements pour voir ce qui sort chaque mois.">
        <template #action><AppButton variant="primary">Ajouter une charge</AppButton></template>
      </EmptyState>
      <EstimateNote />
    </section>

    <section class="card block">
      <h2>Confirmations</h2>
      <div class="line">
        <AppButton @click="dialogOpen = 'plain'">Ouvrir la confirmation</AppButton>
        <AppButton @click="dialogOpen = 'password'">Ouvrir avec mot de passe</AppButton>
      </div>
      <p class="sm">Résultat : <output data-testid="dialog-result">{{ dialogResult }}</output></p>
    </section>

    <section class="card block" data-testid="chart-bars">
      <h2>Barres du mois</h2>
      <p class="sm">Mois sélectionné : <output data-testid="chart-selected">{{ monthLabel(results[chartMonth]!.month) }}</output></p>
      <ResultBars ariaLabel="Démo barres" :bars="resultBars" @select="chartMonth = $event" />
      <MiniBars ariaLabel="Démo compacte des barres" :bars="miniBars" :highlight="litMonths" @select="chartMonth = $event" />
      <MiniBars readonly ariaLabel="Démo compacte des barres en lecture seule" :bars="miniBars" :highlight="litMonths" />
    </section>

    <section class="card block" data-testid="chart-timeline">
      <h2>Frise des missions</h2>
      <ToggleSwitch v-model="withProspects" label="Démo compter les pistes" />
      <p class="sm">Mission ouverte : <output data-testid="chart-selected-mission">{{ selectedMission }}</output></p>
      <MissionTimeline
        ariaLabel="Démo frise"
        :months="timeline.months.map(monthShort)"
        :rows="timelineRows"
        :gaps="timelineGaps"
        :gap-message="timelineMessage"
        @select="selectedMission = $event"
      />
    </section>

    <section class="card block" data-testid="chart-gauge">
      <h2>Jauge du plafond</h2>
      <CeilingGauge
        :actual-pct="gaugePct.actual"
        :planned-pct="gaugePct.planned"
        :vat-pct="gaugePct.vat"
        :color="gaugeTone.color"
        :soft="gaugeTone.soft"
        :ariaLabel="gaugeLabel"
      />
    </section>

    <section class="card block" data-testid="chart-gauge-compact">
      <h2>Jauge compacte</h2>
      <CeilingGauge
        compact
        :actual-pct="gaugePct.actual"
        :planned-pct="gaugePct.planned"
        :vat-pct="gaugePct.vat"
        :color="gaugeTone.color"
        :soft="gaugeTone.soft"
        :ariaLabel="`Jauge compacte : ${gauge.pct} % du CA autorisé`"
      />
    </section>

    <section class="card block" data-testid="chart-stacked">
      <h2>Encaissements empilés</h2>
      <StackedCashBars ariaLabel="Démo encaissements" :columns="stackedFull" :ariaLabels="stackedAria" />
      <StackedCashBars compact ariaLabel="Démo compacte des encaissements" :columns="stackedMini" :ariaLabels="stackedAria" />
    </section>

    <section class="card block" data-testid="chart-leave">
      <h2>Effet des congés</h2>
      <LeaveImpactBars ariaLabel="Démo congés" :columns="leaveColumns" />
    </section>

    <section class="card block" data-testid="chart-split">
      <h2>Répartition du mois</h2>
      <SplitBar ariaLabel="Démo répartition du mois" :segments="splitSegments" :total="splitTotal" />
      <SplitBar compact ariaLabel="Démo compacte de la répartition" :segments="splitSegments" :total="splitTotal" />
    </section>

    <section class="card block" data-testid="chart-smoothed">
      <h2>Revenu lissé</h2>
      <SmoothedBars ariaLabel="Démo lissage" :bars="smoothedFull" :average="smoothing.average" :average-label="smoothedAverage" @select="smoothedMonth = $event" />
      <SmoothedBars compact ariaLabel="Démo compacte du lissage" :bars="smoothedMini" :average="smoothing.average" :average-label="smoothedAverage" @select="smoothedMonth = $event" />
    </section>

    <section class="card block" data-testid="chart-tiny">
      <h2>Valeurs minuscules</h2>
      <ResultBars ariaLabel="Démo valeurs minuscules" :bars="tinyBars" />
      <MiniBars ariaLabel="Démo compacte des valeurs minuscules" :bars="tinyBars" />
    </section>

    <ConfirmDialog
      :open="dialogOpen === 'plain'"
      title="Supprimer ce client ?"
      message="Ses missions seront supprimées. Cette action est définitive."
      confirm-label="Supprimer"
      danger
      @confirm="closeDialog('confirmé')"
      @cancel="closeDialog('annulé')"
    />
    <ConfirmDialog
      :open="dialogOpen === 'password'"
      title="Supprimer mon compte ?"
      message="Toutes tes données seront effacées. Entre ton mot de passe pour confirmer."
      confirm-label="Supprimer mon compte"
      danger
      with-password
      @confirm="(pw) => closeDialog(`confirmé avec ${pw}`)"
      @cancel="closeDialog('annulé')"
    />
  </div>
</template>

<style scoped>
.demo { display: flex; flex-direction: column; gap: var(--gap-block); }
h1 { margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -0.02em; }
h2 { margin: 0; font-size: 22px; font-weight: 800; }
.block { padding: 22px; display: flex; flex-direction: column; gap: 14px; min-width: 0; --stepper-border: var(--field-border); }
.line { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.sm { margin: 0; }
.lost { font-size: 13px; color: #9A3F08; font-weight: 600; }
.tile { background: var(--tip-bg); color: var(--ink); }
</style>
