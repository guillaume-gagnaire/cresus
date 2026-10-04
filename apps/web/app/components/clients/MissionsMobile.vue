<script setup lang="ts">
/**
 * « Qui te fait vivre ? », mobile (Mobile-Missions.dc.html l. 51 à 88) : la semaine type (un toucher change le client d’un
 * jour), le CA moyen par mois, une fiche par client, puis « Ajouter un client ».
 */
const treso = useTresoStore();
const { rows, kicker, week, averageMonthly } = useClientsView(computed(() => null));

// Un changement de jour touche deux clients, l’un après l’autre : on attend qu’il soit parti avant d’en accepter un autre.
// Un client pas encore confirmé par le serveur (identifiant `tmp-…`, R26) bloque aussi la semaine : on n’appelle pas l’API avec lui.
const cycling = ref(false);
const busy = computed(() => cycling.value || treso.clients.some((c) => c.id.startsWith('tmp-')));

async function cycle(weekday: number): Promise<void> {
  if (busy.value) return;
  cycling.value = true;
  try {
    await treso.cycleWeekday(weekday);
  } finally {
    cycling.value = false;
  }
}
</script>

<template>
  <div class="missions">
    <header class="head">
      <div class="intro">
        <span class="lbl">{{ kicker }}</span>
        <h1>Qui te fait vivre&#160;?</h1>
      </div>
      <ProfileBadge size="md" link />
    </header>

    <section class="card week-card" aria-labelledby="week-title">
      <div class="week-head">
        <h2 id="week-title">Ta semaine type</h2>
        <span class="sm">Touche un jour</span>
      </div>
      <WeekTemplate :days="week" :busy="busy" @cycle="cycle" />
      <div class="average">
        <span>CA moyen par mois</span>
        <span class="num total">{{ averageMonthly }}</span>
      </div>
    </section>

    <EmptyState v-if="rows.length === 0" title="Aucun client pour l’instant" text="Ajoute ta première mission pour voir ta tréso se remplir." />
    <ClientCard v-for="row in rows" :key="row.id" :row="row" />

    <TipBubble title="Comment on calcule&#160;?" compact>
      Jours de la semaine × 4,3 semaines × TJM. Les fériés et tes congés sont retirés dans l’onglet Congés.
    </TipBubble>

    <AppButton variant="primary" block class="add" @click="navigateTo('/clients/new')">
      <AppIcon name="plus" :size="20" />Ajouter un client
    </AppButton>
  </div>
</template>

<style scoped>
.missions { display: flex; flex-direction: column; gap: 18px; }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding-top: 6px; }
.intro { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.lbl { font-size: 14px; }
h1 { margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; }
/* Pas `.week` : ce nom est celui de la grille de `WeekTemplate`, dont la racine recevrait ces styles. */
.week-card { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
.week-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
h2 { margin: 0; font-size: 20px; font-weight: 800; }
.average { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 14px 16px; border-radius: 18px; background: var(--bg); font-weight: 600; }
.total { font-size: 24px; }
.add { min-height: 54px; }
</style>
