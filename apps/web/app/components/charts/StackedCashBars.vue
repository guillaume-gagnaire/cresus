<script setup lang="ts">
/**
 * Encaissements empilés par mission, 12 colonnes (Clients.dc.html l. 162 à 183) : hauteur proportionnelle au plus gros
 * mois (170 px au maximum), segments d’au moins 4 px, séparés de 3 px. `faded` estompe un segment (piste).
 * `compact` (Mobile-Client.dc.html l. 94) : sans défilement, colonnes de 90 px sur piste crème, sans total au-dessus ;
 * passer des libellés de 1 ou 2 lettres (`monthLetter`) pour tenir en 350 px.
 */
const props = defineProps<{
  columns: { label: string; totalLabel: string; segments: { value: number; color: string; faded: boolean }[] }[];
  ariaLabels: string[];
  ariaLabel?: string;
  compact?: boolean;
}>();

const reach = computed(() => (props.compact ? 90 : 170));
const peak = computed(() => Math.max(1, ...props.columns.map((c) => c.segments.reduce((sum, s) => sum + s.value, 0))));
const px = (value: number): string => `${Math.max(4, Math.round((value / peak.value) * reach.value))}px`;
</script>

<template>
  <div class="scroll" :class="{ compact }">
    <div class="grid" role="group" :aria-label="ariaLabel ?? 'Ce qui rentre vraiment, mois par mois'">
      <div v-for="(column, i) in columns" :key="i" class="col" role="img" :aria-label="ariaLabels[i]">
        <span v-if="!compact" class="num total">{{ column.totalLabel }}</span>
        <span class="stack" aria-hidden="true">
          <span
            v-for="(segment, j) in column.segments.filter((s) => s.value > 0)"
            :key="j"
            class="segment"
            :style="{ height: px(segment.value), background: segment.color, opacity: segment.faded ? 0.7 : 1 }"
          />
        </span>
        <span class="month" aria-hidden="true">{{ column.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scroll { overflow-x: auto; padding: 5px; margin: -5px; }
.grid { min-width: 640px; display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 12px; align-items: end; }
.col { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.total { font-size: 13px; color: var(--ink-3); }
.stack { height: 180px; width: 100%; max-width: 50px; display: flex; flex-direction: column; justify-content: flex-end; gap: 3px; }
.segment { display: block; border-radius: 8px; }
.month { font-size: 13px; color: var(--muted); font-weight: 600; }
.compact .grid { min-width: 0; gap: 4px; }
.compact .col { gap: 6px; }
.compact .stack { height: 90px; max-width: none; justify-content: flex-end; gap: 0; border-radius: 8px; background: #FBF5EC; overflow: hidden; }
.compact .segment { border-radius: 8px; }
.compact .month { font-size: 10px; font-weight: 700; }
</style>
