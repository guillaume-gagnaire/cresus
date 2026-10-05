<script setup lang="ts">
const { isDesktop } = useBreakpoint();
const treso = useTresoStore();
const exposeStore = import.meta.dev || useRuntimeConfig().public.e2e;

/**
 * PWA reprise après une veille (ou onglet qui retrouve le focus) : « aujourd’hui » et les données peuvent avoir vieilli.
 * Le store décide s’il faut recharger (jour changé ou données de plus de 5 minutes) ; le rafraîchissement est discret.
 */
function onResume(): void {
  if (document.visibilityState === 'visible') void treso.refreshIfStale();
}

onMounted(() => {
  if (exposeStore) (window as unknown as { __treso: typeof treso }).__treso = treso;
  void treso.ensureLoaded();
  document.addEventListener('visibilitychange', onResume);
  window.addEventListener('focus', onResume);
});

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onResume);
  window.removeEventListener('focus', onResume);
});
</script>

<template>
  <div class="shell" :class="{ desktop: isDesktop }">
    <AppSidebar v-if="isDesktop" />
    <main class="content">
      <div class="inner">
        <slot v-if="treso.status === 'ready'" />
        <div v-else-if="treso.status === 'error'" class="state">
          <p>Impossible de charger tes données.</p>
          <AppButton variant="primary" @click="treso.load()">Réessayer</AppButton>
        </div>
        <div v-else class="state" aria-busy="true">
          <p>Chargement de ta tréso…</p>
        </div>
      </div>
    </main>
    <AppTabBar v-if="!isDesktop" />
  </div>
</template>

<style scoped>
.shell { min-height: 100vh; }
.shell.desktop { display: flex; }
.content { flex: 1; min-width: 0; padding: 40px var(--page-pad) 64px; }
.inner { max-width: 1180px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--gap-block); }
.shell:not(.desktop) .content { padding: calc(16px + env(safe-area-inset-top)) var(--page-pad) calc(96px + env(safe-area-inset-bottom)); }
.state { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; padding: 48px 0; color: var(--ink-2); font-size: 16px; }
.state p { margin: 0; }
</style>
