<script setup lang="ts">
import { shortDate } from '@matreso/engine';

/** Accueil société, mobile (Mobile-Accueil.dc.html l. 51 à 96), dans l’ordre de la maquette ; le solde du compte clôt la page. */
const treso = useTresoStore();
const auth = useAuthStore();
const { select, prev, next, canPrev, canNext, verdict, incomeRows, chargeRows, bars, summary } = useCompanyDashboard();

const badge = computed(() => initials(auth.me?.user.companyName ?? null, auth.me?.user.firstName ?? treso.profile?.firstName ?? ''));
/** Les colonnes des 15 mois tiennent en 350 px : une lettre par mois, le pas-à-pas du verdict reste la commande de référence. */
const letterBars = computed(() => bars.value.map((b) => ({ ...b, label: b.letter })));
</script>

<template>
  <div class="dash">
    <header class="head">
      <div class="intro">
        <span class="lbl">Aujourd’hui, {{ shortDate(treso.today) }}</span>
        <h1>Ce mois-ci, ça passe&#160;?</h1>
      </div>
      <NuxtLink to="/profile" class="avatar" aria-label="Ton profil">{{ badge }}</NuxtLink>
    </header>

    <StatusSwitch />

    <template v-if="verdict">
      <VerdictCard :verdict="verdict" size="sm" :can-prev="canPrev" :can-next="canNext" @prev="prev" @next="next" />

      <section class="card months">
        <div class="months-head">
          <h2>Les 15 prochains mois</h2>
          <span class="sm">{{ summary.short }}</span>
        </div>
        <MiniBars :bars="letterBars" @select="select" />
      </section>

      <IncomeList :rows="incomeRows" :total="verdict.income" compact />
      <ChargeList :rows="chargeRows" :total="verdict.charges" compact />
    </template>

    <TipBubble title="Pourquoi un mois dans le rouge ?" compact>
      Tes clients paient avec un décalage. Un mois peut être dans le rouge alors que tu as bien travaillé : ton solde sert d’amortisseur.
    </TipBubble>

    <BalanceField variant="card" />
  </div>
</template>

<style scoped>
.dash { display: flex; flex-direction: column; gap: var(--gap-block); }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding-top: 6px; }
.intro { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.lbl { font-size: 14px; }
h1 { margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; }
.avatar {
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 15px;
  background: var(--sun);
  color: var(--ink);
  text-decoration: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-weight: 800;
  transform: rotate(-6deg);
}
.avatar:hover { color: var(--ink); }
.months { padding: 14px; display: flex; flex-direction: column; gap: 8px; }
.months-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 2px 8px; }
h2 { margin: 0; font-size: 18px; font-weight: 800; }
</style>
