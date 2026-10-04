<script setup lang="ts">
/**
 * Flèches et mois (Main.dc.html l. 68 à 72). Les flèches ont un fond blanc translucide, sans bordure, pour se poser sur
 * la carte verdict colorée ; sur une carte blanche, `--stepper-border` (ex. `var(--field-border)`) leur rend un contour.
 */
withDefaults(defineProps<{ label: string; canPrev: boolean; canNext: boolean; size?: 'lg' | 'sm' }>(), { size: 'lg' });
const emit = defineEmits<{ prev: []; next: [] }>();
</script>

<template>
  <div class="stepper" :class="size">
    <button type="button" class="arrow" aria-label="Mois précédent" :disabled="!canPrev" @click="emit('prev')">
      <AppIcon name="chevron-left" :size="size === 'lg' ? 20 : 18" />
    </button>
    <span class="month" aria-live="polite">{{ label }}</span>
    <button type="button" class="arrow" aria-label="Mois suivant" :disabled="!canNext" @click="emit('next')">
      <AppIcon name="chevron-right" :size="size === 'lg' ? 20 : 18" />
    </button>
  </div>
</template>

<style scoped>
.stepper { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.arrow {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  padding: 0;
  border-radius: var(--radius-pill);
  border: 2px solid var(--stepper-border, transparent);
  background: var(--stepper-bg, rgba(255, 255, 255, .7));
  color: var(--ink);
  cursor: pointer;
}
.arrow:hover:not(:disabled) { background: var(--stepper-bg-hover, rgba(255, 255, 255, .95)); }
.arrow:disabled { opacity: .4; cursor: not-allowed; }
.month { font-family: var(--font-display); font-size: 22px; font-weight: 800; text-transform: capitalize; text-align: center; }
.sm .arrow { width: 44px; height: 44px; }
.sm .month { font-size: 19px; }
</style>
