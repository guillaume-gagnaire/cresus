<script setup lang="ts">
/** Pastille d’état : le sens est porté par le texte du slot, la couleur ne fait que l’accompagner. */
defineProps<{ bg: string; fg: string }>();
</script>

<template>
  <span class="badge" :style="{ background: bg, color: fg }"><slot /></span>
</template>

<style scoped>
.badge { display: inline-flex; align-items: center; padding: 5px 12px; border-radius: 999px; font-size: 13px; font-weight: 700; line-height: 1.3; }
@media (min-width: 1024px) { .badge { font-size: 14px; } }
</style>
