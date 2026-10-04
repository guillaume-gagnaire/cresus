<script setup lang="ts">
defineProps<{ title: string; compact?: boolean }>();
</script>

<template>
  <div :class="compact ? 'mtip' : 'tip'">
    <div class="ico" :class="{ compact }">
      <AppIcon name="bulb" :size="compact ? 18 : 22" />
    </div>
    <div class="body">
      <b class="title">{{ title }}</b>
      <span><slot /></span>
    </div>
  </div>
</template>

<style scoped>
/* Tuile jaune : 44 px sur desktop (Main.dc.html l. 117), 36 px en version mobile (Mobile-Accueil.dc.html l. 92). */
.ico { width: 44px; height: 44px; border-radius: 14px; background: var(--sun); color: var(--ink); }
.ico.compact { width: 36px; height: 36px; border-radius: 12px; }
.body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.mtip .body { gap: 2px; }
.title { font-family: var(--font-display); font-size: 18px; }
.mtip .title { font-size: 16px; }
</style>
