<script setup lang="ts">
/**
 * Charges, mobile (Mobile-Charges.dc.html l. 51 à 82), dans l’ordre de la maquette : « Ta rémunération », Par mois / Par an, le
 * total, la liste, « Ajouter une charge » (qui déplie le formulaire) et l’astuce. La maquette n’a pas de saisie sur la liste : un
 * toucher sur une charge saisie déplie sous elle son montant et sa corbeille ; les deux lignes calculées restent en lecture seule.
 */
import type { ChargeInput } from '@matreso/engine';

const {
  statuses, status, setStatus, statusHelp, net, setNet, previewNet, cost, comparison, microAlert, assumptions, rows, note,
  periodMode, periodOptions, setPeriodMode, total, addCharge, updateAmount, removeCharge, deleting,
} = useExpensesView();

const formOpen = ref(false);
/** Charge dont le montant et la corbeille sont dépliés (une seule à la fois). */
const openId = ref<string | null>(null);
const toggle = (id: string) => { openId.value = openId.value === id ? null : id; };

function onAdd(input: ChargeInput): void {
  formOpen.value = false;
  void addCharge(input);
}

async function onRemove(row: ChargeRowView): Promise<void> {
  openId.value = null;
  await removeCharge(row);
}
</script>

<template>
  <div class="page">
    <header class="head">
      <div class="intro">
        <span class="lbl">Tout ce qui sort</span>
        <h1>Tes charges</h1>
      </div>
      <ProfileBadge size="md" link />
    </header>

    <RemunerationCard
      compact
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

    <SegmentedControl :model-value="periodMode" :options="periodOptions" ariaLabel="Période" @update:model-value="setPeriodMode" />

    <section class="total" aria-label="Total des charges">
      <span class="total-label">{{ total.label }}</span>
      <span class="num total-value">{{ total.value }}</span>
      <span class="total-note">Les charges annuelles sont lissées sur 12 mois</span>
    </section>

    <section class="card list" aria-label="Tes charges">
      <EmptyState v-if="rows.length === 0" title="Aucune charge pour le moment" text="Ajoute ton loyer, ton assurance ou tes abonnements pour voir ce qui sort chaque mois." />
      <ul v-else class="items">
        <li v-for="row in rows" :key="row.id" class="item">
          <div v-if="row.computed" class="row">
            <span class="what">
              <span class="tile" aria-hidden="true"><AppIcon :name="row.icon" :size="18" /></span>
              <span class="text">
                <span class="title">{{ row.name }}</span>
                <span class="sm">{{ row.detail }}</span>
              </span>
            </span>
            <span class="num amount">{{ row.shown }}</span>
          </div>
          <template v-else>
            <button type="button" class="row open" :aria-expanded="openId === row.id" :aria-controls="openId === row.id ? `charge-${row.id}` : undefined" :disabled="row.pending" @click="toggle(row.id)">
              <span class="what">
                <span class="tile" aria-hidden="true"><AppIcon :name="row.icon" :size="18" /></span>
                <span class="text">
                  <span class="title">{{ row.name }}</span>
                  <span class="sm">{{ row.detail }}</span>
                </span>
              </span>
              <span class="num amount">{{ row.shown }}</span>
              <AppIcon class="chevron" :class="{ 'is-open': openId === row.id }" name="chevron-right" :size="16" />
            </button>
            <div v-if="openId === row.id" :id="`charge-${row.id}`" class="editor">
              <MoneyInput class="edit-amount" :model-value="row.amountCents" :label="row.editLabel" :min="0" :step="10" @update:model-value="updateAmount(row, $event ?? 0)" />
              <button type="button" class="del" :aria-label="row.deleteLabel" :disabled="deleting" @click="onRemove(row)">
                <AppIcon name="trash" :size="18" />Supprimer
              </button>
            </div>
          </template>
        </li>
      </ul>
      <p v-if="note" class="sm note">{{ note }}</p>
    </section>

    <AppButton variant="primary" block class="add" :aria-controls="formOpen ? 'charge-form' : undefined" :aria-expanded="formOpen" @click="formOpen = !formOpen">
      <AppIcon name="plus" :size="20" />Ajouter une charge
    </AppButton>
    <section v-if="formOpen" id="charge-form" class="card form-card" aria-label="Ajouter une charge">
      <ChargeForm compact @submit="onAdd" />
    </section>

    <TipBubble title="Quoi mettre ici&#160;?" compact>
      Le salaire et les cotisations sont calculés au-dessus. Le reste : abonnements, véhicule, une provision impôts si tu veux.
    </TipBubble>
  </div>
</template>

<style scoped>
.page { display: flex; flex-direction: column; gap: 18px; }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding-top: 6px; }
.intro { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.lbl { font-size: 14px; }
h1 { margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; }

.total { padding: 20px; border-radius: var(--radius-card); background: var(--tip-bg); display: flex; flex-direction: column; gap: 4px; }
.total-label { font-weight: 600; color: #5A4A00; }
.total-value { font-size: 42px; line-height: 1; overflow-wrap: anywhere; }
.total-note { font-size: 14px; color: #5A4A00; }

.list { padding: 4px 16px; min-width: 0; }
.items { list-style: none; margin: 0; padding: 0; }
.item { border-bottom: 1px solid var(--border-soft); }
.item:last-child { border-bottom: 0; }
/* La ligne de la maquette (`.row` : titre et sous-titre à gauche, montant à droite), sans sa propre bordure : c’est `.item` qui la porte. */
.item .row { border-bottom: 0; }
.row { width: 100%; text-align: left; }
.row.open { border: 0; background: transparent; font: inherit; color: inherit; cursor: pointer; }
.row.open:disabled { cursor: progress; opacity: .7; }
.what { flex: 1; display: flex; align-items: center; gap: 10px; min-width: 0; }
.tile { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 12px; background: var(--tip-bg); color: var(--ink); }
.text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.title { font-weight: 600; overflow-wrap: anywhere; }
.amount { flex: none; font-size: 17px; white-space: nowrap; }
.chevron { flex: none; color: var(--muted-2); transition: transform .15s; }
.chevron.is-open { transform: rotate(90deg); }
@media (prefers-reduced-motion: reduce) { .chevron { transition: none; } }
.editor { display: flex; align-items: flex-end; gap: 12px; padding: 0 0 14px; }
.edit-amount { flex: 1; min-width: 0; font-size: 13px; }
.del { flex: none; display: inline-flex; align-items: center; gap: 8px; min-height: 50px; padding: 0 18px; border-radius: var(--radius-pill); border: 2px solid var(--field-border); background: var(--surface); color: var(--danger); font: 700 15px var(--font-text); cursor: pointer; }
.del:disabled { opacity: .5; cursor: not-allowed; }
.note { margin: 0; padding: 0 0 12px; }

.add { min-height: 54px; }
.form-card { padding: 16px; }
</style>
