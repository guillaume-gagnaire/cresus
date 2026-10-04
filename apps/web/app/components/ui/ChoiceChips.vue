<script setup lang="ts" generic="T extends string | number">
const props = defineProps<{
  options: readonly { value: T; label: string; ariaLabel?: string; color?: { bg: string; fg: string } }[];
  multiple?: boolean;
  ariaLabel: string;
}>();
/** Une valeur seule (`multiple` absent) ou un tableau (`multiple`), dans l’ordre des `options`. */
const model = defineModel<T | T[]>({ required: true });

const selected = computed<T[]>(() => (Array.isArray(model.value) ? model.value : [model.value]));
const isOn = (value: T): boolean => selected.value.includes(value);

function toggle(value: T): void {
  if (!props.multiple) {
    model.value = value;
    return;
  }
  const next = isOn(value) ? selected.value.filter((v) => v !== value) : [...selected.value, value];
  model.value = props.options.map((o) => o.value).filter((v) => next.includes(v));
}
</script>

<template>
  <div class="chips" role="group" :aria-label="ariaLabel">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="chip"
      :class="{ on: isOn(option.value) }"
      :aria-pressed="isOn(option.value)"
      :aria-label="option.ariaLabel"
      :style="isOn(option.value) && option.color ? { background: option.color.bg, borderColor: option.color.bg, color: option.color.fg } : undefined"
      @click="toggle(option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip.on { background: var(--ink); border-color: var(--ink); color: #fff; }
</style>
