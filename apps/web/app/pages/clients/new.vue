<script setup lang="ts">
/** `/clients/new` : sur desktop, la page des clients avec la fiche en création ; sur mobile, la fiche poussée en création. */
const { isDesktop } = useBreakpoint();
</script>

<template>
  <ClientsDesktop v-if="isDesktop" creating />
  <MissionDetailMobile v-else client-id="new" />
</template>
