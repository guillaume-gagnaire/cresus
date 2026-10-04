<script setup lang="ts">
const route = useRoute();

const TABS = [
  { to: '/', label: 'Accueil', icon: 'dashboard' },
  { to: '/clients', label: 'Missions', icon: 'clients' },
  { to: '/calendar', label: 'Congés', icon: 'calendar' },
  { to: '/expenses', label: 'Charges', icon: 'receipt' },
] as const satisfies ReadonlyArray<{ to: string; label: string; icon: IconName }>;

const isActive = (to: string): boolean => isRouteActive(route.path, to);
</script>

<template>
  <nav class="tabbar" aria-label="Navigation principale">
    <NuxtLink
      v-for="tab in TABS"
      :key="tab.to"
      :to="tab.to"
      class="m-tab"
      :class="{ on: isActive(tab.to) }"
      :aria-current="isActive(tab.to) ? 'page' : undefined"
    >
      <span class="i"><AppIcon :name="tab.icon" :size="22" /></span>{{ tab.label }}
    </NuxtLink>
  </nav>
</template>

<style scoped>
.tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  padding: 8px 8px calc(10px + env(safe-area-inset-bottom, 0px));
  background: var(--ink);
  border-radius: 26px 26px 0 0;
  /* Anneau de focus jaune : l’indigo n’atteint pas 3:1 sur le fond ink. */
  --focus: var(--sun);
}
</style>
