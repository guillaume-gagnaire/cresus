<script setup lang="ts">
/**
 * Périodes de vacances posées (Calendrier.dc.html l. 98 à 110, Mobile-Conges.dc.html l. 88 à 91) : dates, nombre de jours et
 * client, ce que ça coûte, et les mois où ça se voit. La corbeille supprime toute la période ; elle attend (désactivée) tant
 * qu’un congé de la période n’est pas confirmé par le serveur (R26). `compact` (mobile) met le coût sur la ligne du client.
 */
defineProps<{ periods: PeriodView[]; compact?: boolean }>();
const emit = defineEmits<{ remove: [period: PeriodView] }>();
</script>

<template>
  <EmptyState
    v-if="periods.length === 0"
    title="Aucune période posée"
    text="Touche un jour dans le calendrier, ou pose une période avec le formulaire : tu vois tout de suite ce que ça change à ta tréso."
  />
  <ul v-else class="periods" :class="{ compact }" aria-label="Périodes de vacances">
    <li v-for="p in periods" :key="p.key" class="period">
      <span v-if="!compact" class="ico" aria-hidden="true"><AppIcon name="sun" :size="20" /></span>
      <div class="body">
        <div class="top">
          <span class="title">{{ p.title }}</span>
          <span v-if="!compact" class="num cost">{{ p.cost }}</span>
        </div>
        <span class="sub">{{ p.sub }}<template v-if="compact"> · <b class="cost">{{ p.cost }}</b></template></span>
        <span class="impact">{{ p.impact }}</span>
      </div>
      <button type="button" class="del" :aria-label="p.ariaLabel" :disabled="p.pending" @click="emit('remove', p)">
        <AppIcon name="trash" :size="18" />
      </button>
    </li>
  </ul>
</template>

<style scoped>
.periods { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.period { display: flex; gap: 12px; align-items: flex-start; padding: 14px 0; border-bottom: 1px solid var(--border-soft); }
.period:last-child { border-bottom: 0; }
.ico { flex: none; width: 40px; height: 40px; border-radius: 13px; background: var(--sun); color: var(--ink); display: flex; align-items: center; justify-content: center; }
.body { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.top { display: flex; justify-content: space-between; gap: 10px; }
.title { font-weight: 700; }
.cost { color: #9A3F08; }
.sub { font-size: 14px; color: var(--muted); }
.impact { font-size: 14px; color: var(--ink-3); font-weight: 600; }
/* Cible de 44 px, sans agrandir la ligne. */
.del { flex: none; width: 44px; height: 44px; border: 0; border-radius: 12px; background: transparent; color: var(--muted); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.del:hover:not(:disabled) { background: var(--border-soft); color: var(--danger); }
.del:disabled { opacity: .5; cursor: not-allowed; }

/* Mobile (Mobile-Conges.dc.html l. 90) : pas de tuile, le coût en gras sur la ligne du client. */
.compact .period { gap: 4px; padding: 12px 0; }
.compact .body { gap: 2px; }
.compact .sub, .compact .impact { font-size: 13px; }
</style>
