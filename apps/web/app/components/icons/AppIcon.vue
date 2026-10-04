<script setup lang="ts">
const props = withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 20 });
</script>

<template>
  <svg
    :width="props.size"
    :height="props.size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <g v-html="ICONS[props.name]" />
  </svg>
</template>
