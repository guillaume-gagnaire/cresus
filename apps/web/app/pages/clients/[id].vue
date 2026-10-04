<script setup lang="ts">
/** `/clients/:id` : sur desktop, la page des clients avec cette mission choisie. Le mobile (Task 29) n’a ici que la fiche seule. */
const route = useRoute();
const treso = useTresoStore();
const { isDesktop } = useBreakpoint();
const id = computed(() => String(route.params.id));

// Mission supprimée, archivée ou inconnue : retour à la liste plutôt qu’une page vide.
if (!treso.clients.some((c) => c.id === id.value)) await navigateTo('/clients', { replace: true });
</script>

<template>
  <ClientsDesktop v-if="isDesktop" :client-id="id" />
  <div v-else class="pushed">
    <NuxtLink to="/clients" class="back"><AppIcon name="arrow-left" :size="20" />Missions</NuxtLink>
    <MissionPanel :key="id" :client-id="id" />
  </div>
</template>

<style scoped>
.pushed { display: flex; flex-direction: column; gap: 12px; }
.back { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; }
</style>
