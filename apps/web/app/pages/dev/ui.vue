<script setup lang="ts">
import { euros } from '@matreso/engine';

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
