<script setup lang="ts">
const treso = useTresoStore();
const { isDesktop } = useBreakpoint();
</script>

<template>
  <template v-if="treso.status === 'ready'">
    <template v-if="treso.isMicro">
      <MicroDashboard v-if="isDesktop" />
      <MicroDashboardMobile v-else />
    </template>
    <template v-else>
      <CompanyDashboard v-if="isDesktop" />
      <CompanyDashboardMobile v-else />
    </template>
  </template>
</template>
