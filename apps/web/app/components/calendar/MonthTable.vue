<script setup lang="ts">
/**
 * « Mois par mois » (Calendrier.dc.html l. 141 à 156) : pour chaque mois, ce qui rentre sans et avec les vacances, ce qu’elles
 * coûtent, les charges, le résultat, le solde et l’état. Le tableau défile à l’intérieur de la carte quand l’écran est
 * étroit ; l’état est écrit dans la pastille, la teinte de la ligne n’est qu’un renfort.
 */
defineProps<{ rows: MonthRowView[] }>();
</script>

<template>
  <section class="card months" aria-labelledby="months-title">
    <div class="head"><h2 id="months-title">Mois par mois</h2></div>
    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">Mois</th>
            <th scope="col" class="right">Encaissé sans vacances</th>
            <th scope="col" class="right">Avec vacances</th>
            <th scope="col" class="right">Coût des vacances</th>
            <th scope="col" class="right">Charges</th>
            <th scope="col" class="right">Résultat du mois</th>
            <th scope="col" class="right">Solde fin de mois</th>
            <th scope="col">État</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key" :style="row.rowBg ? { background: row.rowBg } : undefined">
            <td class="month">{{ row.month }}</td>
            <td class="num right base">{{ row.base }}</td>
            <td class="num right">{{ row.withLeaves }}</td>
            <td class="num right cost">{{ row.cost }}</td>
            <td class="right">
              <div class="stack">
                <span class="num">{{ row.charges }}</span>
                <span v-if="row.chargeNote" class="note">{{ row.chargeNote }}</span>
              </div>
            </td>
            <td class="num right big" :class="row.resultNegative ? 'neg' : 'pos'">{{ row.result }}</td>
            <td class="num right big" :class="{ over: row.balanceNegative }">{{ row.balance }}</td>
            <td><AppBadge :bg="row.badge.bg" :fg="row.badge.fg">{{ row.badge.label }}</AppBadge></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.months { min-width: 0; overflow: hidden; }
.head { padding: 24px 28px 10px; }
h2 { margin: 0; font-size: 26px; font-weight: 800; }
.scroll { overflow-x: auto; }
/* Colonnes resserrées et titres sur deux lignes : à 1440 px, les huit colonnes tiennent sans défilement (en dessous, la carte défile seule). */
th, td { padding-left: 10px; padding-right: 10px; }
th { white-space: normal; vertical-align: bottom; }
th:first-child, td:first-child { padding-left: 28px; }
th:last-child, td:last-child { padding-right: 28px; }
.right { text-align: right; }
.month { font-weight: 700; text-transform: capitalize; }
.base { color: var(--muted); }
.cost { color: #9A3F08; }
.stack { display: flex; flex-direction: column; align-items: flex-end; }
.note { font-size: 12px; color: var(--muted); }
.big { font-size: 17px; }
.pos { color: #1E6B3A; }
.neg { color: #C2272D; }
.over { color: var(--danger); }
</style>
