<script setup lang="ts">
/** `/clients` : sur desktop, la page complète avec la première mission choisie ; sur mobile, « Qui te fait vivre ? ». */
const { isDesktop } = useBreakpoint();
</script>

<template>
  <ClientsDesktop v-if="isDesktop" />
  <MissionsMobile v-else />
</template>
