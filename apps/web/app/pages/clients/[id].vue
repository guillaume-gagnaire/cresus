<script setup lang="ts">
/** `/clients/:id` : sur desktop, la page des clients avec cette mission choisie ; sur mobile, la fiche poussée « Ta mission ». */
const route = useRoute();
const treso = useTresoStore();
const { isDesktop } = useBreakpoint();
const id = computed(() => String(route.params.id));

// Mission supprimée, archivée ou inconnue : retour à la liste plutôt qu’une page vide.
if (!treso.clients.some((c) => c.id === id.value)) await navigateTo('/clients', { replace: true });
</script>

<template>
  <ClientsDesktop v-if="isDesktop" :client-id="id" />
  <MissionDetailMobile v-else :key="id" :client-id="id" />
</template>
