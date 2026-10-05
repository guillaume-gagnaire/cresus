<script setup lang="ts">
/**
 * Grille du mois, lundi à dimanche (Calendrier.dc.html l. 77 à 86, Mobile-Conges.dc.html l. 66 à 69). Chaque case est un
 * bouton nommé « mercredi 14 octobre 2026 : Client B » et désactivé hors jours ouvrés du mois ; `aria-pressed` dit si un
 * congé est posé chez la cible choisie. Le sens d’une case ne tient jamais à sa seule couleur : « Vacances », le nom du
 * férié ou du client sont écrits dedans (version large) et dans son nom accessible. `compact` (mobile) ne garde que le
 * numéro : des cases carrées de 44 px, sans légende.
 */
defineProps<{
  days: DayView[];
  /** Mois affiché (« octobre 2026 »), nom du groupe. */
  label: string;
  legend?: { key: string; label: string; color: { base: string; soft: string }; prospect: boolean }[];
  compact?: boolean;
}>();
const emit = defineEmits<{ toggle: [day: DayView] }>();

const WEEKDAYS = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'] as const;
const WEEKDAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;
</script>

<template>
  <div class="cal" :class="{ compact }" role="group" :aria-label="label">
    <div class="weekdays" aria-hidden="true">
      <span v-for="(w, i) in (compact ? WEEKDAY_INITIALS : WEEKDAYS)" :key="i">{{ w }}</span>
    </div>
    <div class="grid">
      <button
        v-for="d in days"
        :key="d.date"
        type="button"
        class="cell"
        :class="[`is-${d.kind}`, { 'is-out': !d.inMonth, 'is-prospect': d.prospect, 'is-pending': d.pending }]"
        :style="d.color ? { '--base': d.color.base, '--soft': d.color.soft } : undefined"
        :aria-label="d.ariaLabel"
        :aria-pressed="d.pressed"
        :aria-busy="d.pending || undefined"
        :disabled="!d.clickable"
        @click="emit('toggle', d)"
      >
        <span class="n">{{ d.day }}</span>
        <span v-if="!compact && d.inMonth && d.tag" class="tag">{{ d.tag }}</span>
      </button>
    </div>
    <div v-if="!compact && legend" class="legend">
      <span v-for="item in legend" :key="item.key" class="key">
        <span class="swatch" :class="{ prospect: item.prospect }" :style="{ background: item.color.soft, borderColor: item.color.base }" />{{ item.label }}
      </span>
      <span class="key"><span class="swatch leave" />Vacances</span>
    </div>
  </div>
</template>

<style scoped>
.cal { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.weekdays { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; font-size: 13px; font-weight: 700; color: var(--muted); text-align: center; }
.grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
.cell {
  min-width: 0;
  min-height: 64px;
  padding: 8px;
  border-radius: 16px;
  border: 2px solid transparent;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  font: 700 16px var(--font-text);
  text-align: left;
  color: var(--ink);
  cursor: pointer;
}
.tag { max-width: 100%; font-size: 11px; font-weight: 700; opacity: .85; overflow-wrap: anywhere; }
.is-weekend { background: #F3EDE3; border-color: #F3EDE3; color: var(--muted-2); cursor: default; }
.is-holiday { background: #EDE6DA; border-color: #EDE6DA; color: var(--ink-3); cursor: default; }
.is-leave { background: var(--sun); border-color: var(--sun); }
.is-client { background: var(--soft); border-color: var(--base); }
.is-client.is-prospect { border-style: dashed; }
/* Jour sans client : se pose aussi (un jour off reste un jour off), texte en --muted pour tenir le contraste AA. */
.is-free { background: var(--surface); border: 2px dashed var(--field-border); color: var(--muted); }
.is-out { opacity: .35; }
.is-pending { opacity: .7; cursor: progress; }
.cell:disabled { cursor: default; }

.legend { display: flex; flex-wrap: wrap; gap: 14px; font-size: 14px; font-weight: 600; color: var(--ink-3); }
.key { display: flex; align-items: center; gap: 6px; }
.swatch { flex: none; width: 14px; height: 14px; border-radius: 5px; border: 2px solid transparent; }
.swatch.prospect { border-style: dashed; }
.swatch.leave { background: var(--sun); border-color: var(--sun); }

/* Mobile : cases carrées de 44 px au moins, numéro seul. 2 px entre les cases : 7 × 44 px + 6 × 2 px tiennent dans la carte à 390 px. */
.compact { gap: 6px; }
.compact .weekdays { gap: 2px; font-size: 13px; font-weight: 400; }
.compact .grid { gap: 2px; }
.compact .cell { aspect-ratio: 1; min-height: 44px; padding: 0; border-radius: 12px; align-items: center; justify-content: center; font-size: 15px; }
.compact .is-weekend { background: transparent; border: 0; color: var(--on-night-muted); }
.compact .is-holiday { background: #E9E3F7; border: 0; color: #6A3FC9; }
.compact .is-leave { border: 0; }
</style>
