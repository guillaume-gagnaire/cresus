<script setup lang="ts">
/**
 * « Ta semaine type » (Mobile-Missions.dc.html l. 59 à 63) : cinq grosses cases, du lundi au vendredi. Chacune montre la lettre du
 * client qui y travaille sur sa couleur, ou « Libre ». Un toucher la fait passer au client suivant, puis à « Libre » (`cycle`).
 * Pendant qu’un changement part (`busy`), les touchers sont ignorés : deux touchers rapprochés partiraient de l’état à moitié
 * appliqué. `aria-disabled` plutôt que `disabled`, pour que le focus reste sur la case.
 */
defineProps<{ days: WeekDayView[]; busy?: boolean }>();
const emit = defineEmits<{ cycle: [weekday: number] }>();
</script>

<template>
  <div class="week">
    <button
      v-for="day in days"
      :key="day.weekday"
      type="button"
      class="day"
      :class="{ 'is-free': !day.color }"
      :style="day.color ? { background: day.color.base, color: day.color.fg } : undefined"
      :aria-label="day.aria"
      :aria-disabled="busy ? 'true' : undefined"
      @click="!busy && emit('cycle', day.weekday)"
    >
      <span class="short">{{ day.short }}</span>
      <span class="who" :class="{ free: !day.color }">{{ day.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.week { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
/* 76 px de haut comme la maquette (Task 29 : au moins 56 px) ; la largeur, ≈ 56 px, vient de la grille. */
.day { min-height: 76px; min-width: 0; padding: 0; border: 0; border-radius: 18px; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-family: var(--font-text); }
.day.is-free { background: var(--border-soft); color: var(--muted); }
.day[aria-disabled='true'] { cursor: progress; }
.short { font-size: 13px; font-weight: 600; }
.who { font-family: var(--font-display); font-size: 20px; font-weight: 800; }
/* « Libre » est un mot, pas une lettre : plus petit pour tenir dans 56 px. */
.who.free { font-size: 15px; font-weight: 700; }
</style>
