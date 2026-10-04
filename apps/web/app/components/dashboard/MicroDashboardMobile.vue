<script setup lang="ts">
/** Accueil micro-entreprise, mobile (Mobile-Accueil-Micro.dc.html l. 51 à 95), mêmes blocs que le desktop en version compacte. */
const treso = useTresoStore();
const auth = useAuthStore();
const {
  select, prev, next, canPrev, canNext, tiles, split, splitTotal, setAside, years, year, setYear, gauge,
  testMission, testMissionLabel, toggleTestMission, smoothed, bars, notes,
} = useMicroDashboard();

const badge = computed(() => initials(auth.me?.user.companyName ?? null, auth.me?.user.firstName ?? treso.profile?.firstName ?? ''));
/** Les 15 colonnes tiennent en 350 px : une lettre par mois, le pas-à-pas de la première carte reste la commande de référence. */
const letterBars = computed(() => bars.value.map((b) => ({ ...b, label: b.letter })));
</script>

<template>
  <div class="dash">
    <header class="head">
      <div class="intro">
        <span class="lbl">Mode micro-entreprise</span>
        <h1>Combien il te reste&#160;?</h1>
      </div>
      <NuxtLink to="/profile" class="avatar" aria-label="Ton profil">{{ badge }}</NuxtLink>
    </header>

    <StatusSwitch />

    <template v-if="tiles && setAside && gauge">
      <ForYouCard :tiles="tiles" :split="split" :split-total="splitTotal" :can-prev="canPrev" :can-next="canNext" size="sm" @prev="prev" @next="next" />
      <SetAsideCard :set-aside="setAside" compact />
      <CeilingCard
        :gauge="gauge"
        :years="years"
        :year="year"
        :test-mission="testMission"
        :test-mission-label="testMissionLabel"
        compact
        @pick-year="setYear"
        @toggle-test="toggleTestMission"
      />

      <section class="card smooth">
        <div class="smooth-head">
          <h2>Te verser chaque mois</h2>
          <span class="num average">{{ smoothed.amount }}</span>
        </div>
        <span class="sm">Moyenne de ce qui te reste sur 12 mois : verse-toi ça, même les mois creux.</span>
        <SmoothedBars :bars="letterBars" :average="smoothed.average" :average-label="smoothed.label" compact @select="select" />
      </section>
    </template>

    <div class="notes">
      <p class="sm">{{ notes.short }}</p>
      <EstimateNote />
    </div>
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
.smooth { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.smooth-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
h2 { margin: 0; font-size: 18px; font-weight: 800; }
.average { color: #1E6B3A; }
.notes { display: flex; flex-direction: column; gap: 4px; }
.notes p { margin: 0; }
</style>
