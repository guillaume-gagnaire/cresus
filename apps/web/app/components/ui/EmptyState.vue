<script setup lang="ts">
defineProps<{ title: string; text: string }>();
</script>

<template>
  <div class="empty">
    <p class="title">{{ title }}</p>
    <p class="text">{{ text }}</p>
    <div v-if="$slots.action" class="action"><slot name="action" /></div>
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 28px 22px;
  text-align: center;
  border-radius: var(--radius-card);
  background: var(--bg);
  border: 2px dashed var(--field-border);
}
.title { margin: 0; font-family: var(--font-display); font-size: 20px; font-weight: 800; color: var(--ink); }
.text { margin: 0; max-width: 460px; color: var(--muted); line-height: 1.5; }
.action { margin-top: 8px; }
</style>
