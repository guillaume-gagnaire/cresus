<script setup lang="ts">
/**
 * Clients & missions, desktop (Clients.dc.html l. 57 à 183) : la frise, le tableau avec la fiche de la mission choisie, et ce qui
 * rentre vraiment mois par mois. `clientId` (route `/clients/:id`) choisit la mission à l’arrivée, `creating` (route
 * `/clients/new`) ouvre la fiche en création ; sans l’un ni l’autre, c’est la première mission qui est choisie.
 */
const props = defineProps<{ clientId?: string | null; creating?: boolean }>();

const treso = useTresoStore();

// La sélection est locale : la changer ne recharge pas la page (pas de saut en haut, le graphique garde son mode).
const picked = ref<string | null>(props.clientId ?? null);
watch(() => props.clientId, (id) => { picked.value = id ?? null; });
const selectedId = computed<string | null>(() => {
  if (props.creating) return null;
  return treso.clients.some((c) => c.id === picked.value) ? picked.value : (treso.clients[0]?.id ?? null);
});
const panelId = computed(() => (props.creating ? 'new' : selectedId.value));

const { timeline, rows, cashBars, totals, kicker } = useClientsView(selectedId);

function select(id: string): void {
  if (props.creating) void navigateTo(`/clients/${id}`);
  else picked.value = id;
}

const includeProspects = computed({
  get: () => treso.profile?.includeProspects ?? false,
  set: (value: boolean) => { void treso.updateProfile({ includeProspects: value }); },
});

const cashMode = ref<'billed' | 'cashed'>('cashed');
const CASH_MODES = [
  { value: 'billed', label: 'Facturé' },
  { value: 'cashed', label: 'Encaissé' },
] as const;
const bars = computed(() => cashBars.value[cashMode.value]);
</script>

<template>
  <div class="clients">
    <header class="head">
      <div class="intro">
        <span class="lbl">{{ kicker }}</span>
        <h1>Tes clients</h1>
      </div>
      <AppButton variant="primary" @click="navigateTo('/clients/new')">Ajouter un client</AppButton>
    </header>

    <section class="card block" aria-labelledby="timeline-title">
      <div class="block-head">
        <div class="titles">
          <h2 id="timeline-title">Tes missions dans le temps</h2>
          <span class="hint">{{ timeline.range }}. Touche une mission pour l’ouvrir.</span>
        </div>
        <label class="pistes"><input v-model="includeProspects" type="checkbox">Compter les pistes</label>
      </div>
      <MissionTimeline :months="timeline.months" :rows="timeline.rows" :gaps="timeline.gaps" :gap-message="timeline.gapMessage" @select="select" />
    </section>

    <div class="cols">
      <MissionTable class="table" :rows="rows" @select="select" />
      <MissionPanel v-if="panelId" :key="panelId" class="side" :client-id="panelId" />
    </div>

    <section class="card block" aria-labelledby="cash-title">
      <div class="block-head">
        <div class="titles">
          <h2 id="cash-title">Ce qui rentre vraiment, mois par mois</h2>
          <span class="hint">{{ cashMode === 'cashed' ? 'Les encaissements, une fois les délais de paiement passés' : 'Ce que tu factures, le mois où tu travailles' }}</span>
        </div>
        <div class="controls">
          <SegmentedControl v-model="cashMode" :options="CASH_MODES" ariaLabel="Montants affichés" />
          <span class="total billed">{{ totals.billed }}</span>
          <span class="total cashed">{{ totals.cashed }}</span>
        </div>
      </div>
      <StackedCashBars :columns="bars.columns" :ariaLabels="bars.ariaLabels" />
      <TipBubble title="Pourquoi le facturé et l’encaissé diffèrent&#160;?">
        Tu travailles en octobre, tu factures le 31, et l’argent arrive selon le délai de ton client, plus son retard habituel. C’est pour ça qu’une nouvelle mission met un ou deux mois à remplir ta tréso, et qu’une mission terminée continue de payer après sa fin.
      </TipBubble>
      <p class="foot">Jours fériés et congés retirés. Les congés se posent dans l’onglet Calendrier.</p>
    </section>
  </div>
</template>

<style scoped>
.clients { display: flex; flex-direction: column; gap: var(--gap-block); }
.head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 20px; }
.intro { display: flex; flex-direction: column; gap: 8px; }
h1 { margin: 0; font-size: 46px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; }
.block { padding: 28px; display: flex; flex-direction: column; gap: 18px; }
.block-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; align-items: flex-end; }
.titles { display: flex; flex-direction: column; gap: 6px; }
h2 { margin: 0; font-size: 26px; font-weight: 800; }
.hint { font-size: 16px; color: var(--muted); }
.pistes { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 18px; border-radius: var(--radius-pill); background: #F1EAFE; font-weight: 600; cursor: pointer; }
.pistes input { width: 20px; height: 20px; accent-color: #6A3FC9; }
.cols { display: flex; flex-wrap: wrap; gap: 18px; align-items: flex-start; }
.table { flex: 2 1 600px; }
.side { flex: 1 1 380px; }
.controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.total { padding: 8px 16px; border-radius: var(--radius-pill); font-size: 15px; font-weight: 600; }
.total.billed { background: var(--border-soft); }
.total.cashed { background: #ECEBFF; color: #23237A; }
.foot { margin: 0; font-size: 14px; color: var(--muted); }
</style>
