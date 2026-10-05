<script setup lang="ts">
/** `/calendar` : sur desktop, la page complète ; sur mobile, « Tes vacances ». */
const { isDesktop } = useBreakpoint();
</script>

<template>
  <CalendarDesktop v-if="isDesktop" />
  <CalendarMobile v-else />
</template>
