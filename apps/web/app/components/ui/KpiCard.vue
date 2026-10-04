<script setup lang="ts">
/**
 * Carte teintée sans bordure (KPI de Calendrier.dc.html l. 64 à 70).
 * Teintes : neutral = carte blanche, positive = #E7F6EC, warn = tip-bg (#FFF4C2, « Jours posés »),
 * danger = danger-bg (#FBD2CE), info = pêche #FFE1CC (« CA perdu »).
 */
withDefaults(
  defineProps<{
    label: string;
    value: string;
    sub?: string;
    tone?: 'neutral' | 'positive' | 'warn' | 'danger' | 'info';
    valueColor?: string;
  }>(),
  { tone: 'neutral' },
);
</script>

<template>
  <div class="card kpi" :class="tone">
    <span class="lbl label">{{ label }}</span>
    <span class="num value" :style="valueColor ? { color: valueColor } : undefined">{{ value }}</span>
    <span v-if="sub" class="sub">{{ sub }}</span>
  </div>
</template>

<style scoped>
.kpi { padding: 20px; display: flex; flex-direction: column; gap: 8px; min-width: 0; border-color: transparent; }
.kpi.neutral { border-color: var(--border); }
.kpi.positive { background: #E7F6EC; }
.kpi.warn { background: var(--tip-bg); }
.kpi.danger { background: var(--danger-bg); }
.kpi.info { background: #FFE1CC; }
.label { color: var(--ink-3); }
.value { font-size: 34px; line-height: 1; color: var(--ink); overflow-wrap: anywhere; }
.sub { font-size: 14px; color: var(--ink-2); }
/* Version mobile (Mobile-Conges.dc.html l. 58) */
@media (max-width: 1023.98px) {
  .kpi { padding: 12px 14px; gap: 2px; }
  .label { font-size: 13px; }
  .value { font-size: 22px; }
  .sub { font-size: 13px; color: var(--muted); }
}
</style>
