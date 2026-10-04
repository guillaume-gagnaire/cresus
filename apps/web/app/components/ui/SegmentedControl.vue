<script setup lang="ts" generic="T extends string | number">
defineProps<{
  options: readonly { value: T; label: string }[];
  ariaLabel: string;
}>();
const model = defineModel<T>({ required: true });
</script>

<template>
  <div class="seg" role="group" :aria-label="ariaLabel">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :aria-pressed="option.value === model"
      @click="model = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.seg button { padding: 0 18px; }
</style>
