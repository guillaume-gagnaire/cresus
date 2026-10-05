<script setup lang="ts">
/**
 * Tableau des charges (Charges.dc.html l. 100 à 109) : d’abord les deux lignes de rémunération calculées par le moteur (lecture
 * seule, « calculé »), puis les charges saisies, dont on change le montant sur place et que l’on supprime. Une charge pas encore
 * confirmée par le serveur (`tmp-…`) reste figée : ni saisie ni suppression (R26). Le tableau défile dans sa carte quand l’écran
 * est étroit.
 */
defineProps<{
  rows: readonly ChargeRowView[];
  /** Les corbeilles attendent la fin d’une suppression en cours (R33). */
  busy?: boolean;
  /** Phrase sous le tableau (ex. en micro, les cotisations n’y figurent pas). */
  note?: string;
}>();
const emit = defineEmits<{ update: [row: ChargeRowView, cents: number]; remove: [row: ChargeRowView] }>();
</script>

<template>
  <section class="card charges" aria-label="Tes charges">
    <EmptyState
      v-if="rows.length === 0"
      class="empty"
      title="Aucune charge pour le moment"
      text="Ajoute ton loyer, ton assurance ou tes abonnements pour voir ce qui sort chaque mois."
    />
    <div v-else class="scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">Charge</th>
            <th scope="col">Fréquence</th>
            <th scope="col" class="right">Montant</th>
            <th scope="col" class="right">Par mois</th>
            <th scope="col"><span class="visually-hidden">Supprimer</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td>
              <div class="name">
                <span class="tile" aria-hidden="true"><AppIcon :name="row.icon" :size="18" /></span>
                <span>{{ row.name }}</span>
              </div>
            </td>
            <td class="frequency">{{ row.frequency }}</td>
            <td class="right">
              <span v-if="row.computed" class="num value">{{ row.amount }}</span>
              <MoneyInput
                v-else
                class="amount"
                :model-value="row.amountCents"
                :label="row.editLabel"
                hide-label
                :min="0"
                :step="10"
                :disabled="row.pending"
                @update:model-value="emit('update', row, $event ?? 0)"
              />
            </td>
            <td class="num right month">{{ row.monthly }}</td>
            <td class="right">
              <button v-if="!row.computed" type="button" class="del" :aria-label="row.deleteLabel" :disabled="row.pending || busy" @click="emit('remove', row)">
                <AppIcon name="trash" :size="18" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="note" class="sm note">{{ note }}</p>
  </section>
</template>

<style scoped>
.charges { min-width: 0; overflow: hidden; }
.scroll { overflow-x: auto; }
.empty { margin: 24px; }
/* Colonnes resserrées, nom et fréquence qui passent à la ligne : à 1440 px la carte ne fait que ~690 px, et « Par mois » ne doit jamais se retrouver caché par le défilement. */
th, td { padding-left: 12px; padding-right: 12px; }
th:first-child, td:first-child { padding-left: 20px; }
th:last-child, td:last-child { padding-right: 16px; }
.name, .frequency { white-space: normal; }
.right { text-align: right; }
.name { display: flex; align-items: center; gap: 10px; font-weight: 600; }
/* Pastille de catégorie : même tuile que les lignes de liste, 32 px pour tenir dans la hauteur de la ligne. */
.tile { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 10px; background: var(--tip-bg); color: var(--ink); }
.frequency { color: var(--ink-2); }
.value { font-size: 17px; }
.month { color: var(--muted); }
/* Saisie du montant : 44 px de haut, chiffres en Bricolage, alignés à droite (maquette l. 105). */
.amount { display: inline-flex; width: 128px; }
.charges .amount :deep(input) { min-height: 44px; padding-left: 12px; border-radius: 12px; font: 700 16px var(--font-display); text-align: right; }
.del { width: 44px; height: 44px; border: 0; border-radius: 999px; background: transparent; color: var(--muted-2); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.del:hover:not(:disabled) { background: var(--border-soft); color: var(--danger); }
.del:disabled { opacity: .5; cursor: not-allowed; }
.note { margin: 0; padding: 14px 18px; border-top: 1px solid var(--border-soft); }
</style>
