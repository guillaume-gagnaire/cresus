<script setup lang="ts">
const { isDesktop } = useBreakpoint();
</script>

<template>
  <div class="shell" :class="{ desktop: isDesktop }">
    <AppSidebar v-if="isDesktop" />
    <main class="content">
      <div class="inner"><slot /></div>
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
</style>
