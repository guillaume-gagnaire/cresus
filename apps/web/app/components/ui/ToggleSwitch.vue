<script setup lang="ts">
defineProps<{ label: string; hideLabel?: boolean }>();
const model = defineModel<boolean>({ required: true });
</script>

<template>
  <label class="switch-row">
    <span :class="{ 'visually-hidden': hideLabel }">{{ label }}</span>
    <button type="button" role="switch" :aria-checked="model" :aria-label="label" class="switch" :class="{ on: model }" @click="model = !model">
      <span class="track"><span class="knob" /></span>
    </button>
  </label>
</template>

<style scoped>
.switch-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; font-weight: 600; }
/* Zone tactile 56 × 44, piste visuelle 56 × 34 (SPEC §7.4) */
.switch { display: flex; align-items: center; width: 56px; min-width: 56px; height: 44px; padding: 0; border: 0; background: transparent; cursor: pointer; }
/* Piste éteinte : le fond de la maquette (#E8DDCB) ne fait que 1,26:1 face à la page, d’où un filet intérieur --muted (5,3:1, WCAG 1.4.11) sans changer la taille. */
.track { position: relative; width: 56px; height: 34px; border-radius: 999px; background: var(--field-border); box-shadow: inset 0 0 0 2px var(--muted); transition: background .15s; }
.switch.on .track { background: var(--client-indigo); box-shadow: none; }
.knob { position: absolute; top: 4px; left: 4px; width: 26px; height: 26px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.2); transition: transform .15s; }
.switch.on .knob { transform: translateX(22px); }
/* Le contour de focus suit la piste (la zone tactile, plus haute, est invisible). */
.switch:focus-visible { outline: none; }
.switch:focus-visible .track { outline: 3px solid var(--focus, var(--client-indigo)); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .track, .knob { transition: none; } }
</style>
