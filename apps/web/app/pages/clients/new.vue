<script setup lang="ts">
/** `/clients/new` : sur desktop, la page des clients avec la fiche en création. Le mobile (Task 29) n’a ici que la fiche seule. */
const { isDesktop } = useBreakpoint();
</script>

<template>
  <ClientsDesktop v-if="isDesktop" creating />
  <div v-else class="pushed">
    <NuxtLink to="/clients" class="back"><AppIcon name="arrow-left" :size="20" />Missions</NuxtLink>
    <MissionPanel client-id="new" />
  </div>
</template>

<style scoped>
.pushed { display: flex; flex-direction: column; gap: 12px; }
.back { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; }
</style>
