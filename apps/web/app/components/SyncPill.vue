<script setup lang="ts">
import type { SyncState } from '~/stores/caisse';

const props = defineProps<{ state: SyncState; pending: number; devices?: number }>();
const emit = defineEmits<{ reconnect: [] }>();

const label = computed(() => {
  if (props.state === 'auth') return 'Reconnexion nécessaire';
  if (props.state === 'offline') return props.pending > 0 ? `Hors ligne · ${props.pending} en attente` : 'Hors ligne';
  if (props.pending > 0) return `${props.pending} en attente`;
  return props.devices && props.devices > 1 ? `À jour · ${props.devices} appareils connectés` : 'À jour';
});
const tone = computed(() => (props.state === 'ok' && props.pending === 0 ? 'ok' : 'wait'));
const dot = computed(() => (props.state === 'offline' ? 'struck' : tone.value === 'ok' ? 'full' : 'hollow'));
</script>

<template>
  <button v-if="state === 'auth'" type="button" class="pill wait" data-testid="sync" @click="emit('reconnect')">
    <span class="dot hollow" aria-hidden="true" />{{ label }}
  </button>
  <span v-else role="status" class="pill" :class="tone" data-testid="sync">
    <span class="dot" :class="dot" aria-hidden="true" />{{ label }}
  </span>
</template>

<style scoped>
.pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 36px;
  padding: 6px 12px;
  border: 0;
  border-radius: 999px;
  background: var(--card);
  font-size: 14px;
  font-weight: 800;
  color: var(--text);
  white-space: nowrap;
}
button.pill {
  min-height: 44px;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.pill.wait {
  color: var(--wait);
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  position: relative;
}
.dot.full {
  background: var(--ok);
}
.dot.hollow,
.dot.struck {
  border: 2.5px solid currentColor;
}
.dot.struck::after {
  content: '';
  position: absolute;
  left: -3px;
  top: 2px;
  width: 12px;
  height: 2.5px;
  background: currentColor;
  transform: rotate(-45deg);
}
</style>
