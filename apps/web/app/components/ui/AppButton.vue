<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost';
    type?: 'button' | 'submit';
    disabled?: boolean;
    block?: boolean;
    ariaLabel?: string;
  }>(),
  { variant: 'secondary', type: 'button' },
);
// Pas d’`emits` déclaré : le `click` natif traverse jusqu’au <button> (et ne part pas quand le bouton est désactivé).
</script>

<template>
  <button
    :type="type"
    class="btn"
    :class="{ pri: variant === 'primary', ghost: variant === 'ghost', block }"
    :disabled="disabled"
    :aria-label="ariaLabel"
  >
    <slot />
  </button>
</template>

<style scoped>
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-width: 44px; }
.btn:hover:not(:disabled) { background: var(--field-bg); }
.btn.pri:hover:not(:disabled) { background: var(--night-2); }
.btn.ghost { border-color: transparent; background: transparent; }
.btn.ghost:hover:not(:disabled) { background: var(--border-soft); }
.btn.block { display: flex; width: 100%; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
</style>
