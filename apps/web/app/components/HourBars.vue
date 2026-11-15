<script setup lang="ts">
import type { HourBucket } from '@cresus/shared';
import { formatEuros, formatHour, salesLabel } from '~/utils/format';

const props = defineProps<{ hours: HourBucket[] }>();
const max = computed(() => Math.max(1, ...props.hours.map((h) => h.revenueCents)));
const severalDays = computed(() => new Set(props.hours.map((h) => h.hour.slice(0, 10))).size > 1);
const label = (h: HourBucket) => (severalDays.value ? `${h.hour.slice(8, 10)}/${h.hour.slice(5, 7)} ${formatHour(h.hour)}` : formatHour(h.hour));
</script>

<template>
  <ul class="bars">
    <li v-for="h in hours" :key="h.hour" class="bar-row">
      <span class="label">{{ label(h) }}</span>
      <span class="track" role="img" :aria-label="`${label(h)} : ${formatEuros(h.revenueCents)}, ${salesLabel(h.count)}`">
        <span class="fill" :style="{ width: `${Math.max(3, Math.round((h.revenueCents / max) * 100))}%` }" />
      </span>
      <span class="value">
        <span class="money num">{{ formatEuros(h.revenueCents) }}</span>
        <span class="count num">{{ salesLabel(h.count) }}</span>
      </span>
    </li>
  </ul>
</template>

<style scoped>
.bars {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.bar-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 96px;
  align-items: center;
  gap: 10px;
}
.label {
  min-width: 44px;
  font-size: 15px;
  font-weight: 800;
  color: var(--muted);
}
.track {
  height: 22px;
  border-radius: 8px;
  background: var(--ground-deep);
  overflow: hidden;
}
.fill {
  display: block;
  height: 100%;
  border-radius: 8px;
  background: var(--bar);
}
.value {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.15;
}
.money {
  font-size: 15px;
  font-weight: 900;
  color: var(--ink);
}
.count {
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
}
</style>
