<script setup lang="ts">
/**
 * Tableau « Missions » (Clients.dc.html l. 91 à 103). Une ligne par mission ; on la choisit au clic, ou au clavier
 * (Tab puis Entrée ou Espace). La ligne choisie est annoncée par `aria-selected`, et marquée par un liseré d’encre :
 * la couleur de fond seule ne suffirait pas.
 */
defineProps<{ rows: MissionRow[] }>();
const emit = defineEmits<{ select: [id: string] }>();
</script>

<template>
  <section class="card missions" aria-labelledby="missions-title">
    <div class="head"><h2 id="missions-title">Missions</h2></div>
    <div v-if="rows.length === 0" class="empty">
      <EmptyState title="Aucun client pour l’instant" text="Ajoute ta première mission pour voir ta tréso se remplir." />
    </div>
    <div v-else class="scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">Client</th>
            <th scope="col">Période</th>
            <th scope="col">Tarif</th>
            <th scope="col">Paie à</th>
            <th scope="col" class="right">Par mois</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.id"
            tabindex="0"
            :aria-selected="row.selected"
            :class="{ selected: row.selected }"
            :style="row.selected ? { background: row.color.soft } : undefined"
            @click="emit('select', row.id)"
            @keydown.enter.prevent="emit('select', row.id)"
            @keydown.space.prevent="emit('select', row.id)"
          >
            <td>
              <div class="client">
                <span class="bar" :style="{ background: row.color.base, opacity: row.prospect ? 0.6 : 1 }" aria-hidden="true" />
                <div class="stack">
                  <span class="name">{{ row.name }}</span>
                  <span class="sub">{{ row.days }}</span>
                </div>
              </div>
            </td>
            <td class="period">{{ row.period }}</td>
            <td>
              <div class="stack">
                <span class="num">{{ row.rate }}</span>
                <span v-if="row.rateSub" class="sub">{{ row.rateSub }}</span>
              </div>
            </td>
            <td class="term">
              <div class="stack">
                <span>{{ row.term }}</span>
                <span class="sub">{{ row.delay }}</span>
              </div>
            </td>
            <td class="num right month">{{ row.monthly }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.missions { min-width: 0; overflow: hidden; }
.head { padding: 24px 28px 10px; }
h2 { margin: 0; font-size: 26px; font-weight: 800; }
.empty { padding: 8px 28px 28px; }
.scroll { overflow-x: auto; }
tbody tr { cursor: pointer; }
tbody tr:hover:not(.selected) { background: var(--field-bg); }
/* Le contour reste à l’intérieur de la ligne : la carte coupe (`overflow: hidden`) tout ce qui déborde. */
tbody tr:focus-visible { outline-offset: -3px; }
tbody tr.selected td:first-child { box-shadow: inset 4px 0 0 var(--ink); }
/* Colonnes resserrées et textes secondaires qui peuvent passer à la ligne : à 1440 px la carte ne fait que ~660 px, et « Par mois » ne doit jamais se retrouver caché par le défilement. */
th, td { padding-left: 14px; padding-right: 14px; }
.sub, .period { white-space: normal; }
.right { text-align: right; }
.client { display: flex; align-items: center; gap: 12px; }
.bar { flex: none; width: 14px; height: 40px; border-radius: 6px; }
.stack { display: flex; flex-direction: column; gap: 2px; }
.name { font-weight: 700; font-size: 17px; }
.sub { font-size: 13px; color: var(--muted); }
.period, .term { font-size: 15px; }
.month { font-size: 18px; }
</style>
