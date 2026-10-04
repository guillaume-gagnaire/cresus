<script setup lang="ts">
defineProps<{ label: string; min?: string; max?: string }>();
/** Date ISO `YYYY-MM-DD`, `null` quand le champ est vide. */
const model = defineModel<string | null>({ required: true });

function onChange(event: Event): void {
  model.value = (event.target as HTMLInputElement).value || null;
}
</script>

<template>
  <label class="field">
    <span>{{ label }}</span>
    <input type="date" :value="model ?? ''" :min="min" :max="max" @change="onChange">
  </label>
</template>

<style scoped>
.field input { min-width: 0; }
</style>
