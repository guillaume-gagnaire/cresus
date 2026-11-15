<script setup lang="ts">
/** Icônes au trait (2,2 px, bouts arrondis), dessinées pour Cresus. Décoratives : le texte voisin ou l'aria-label du bouton porte le sens. */
const props = withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 22 });

export type IconName =
  | 'back'
  | 'next'
  | 'grid'
  | 'list'
  | 'chart'
  | 'plus'
  | 'gear'
  | 'close'
  | 'search'
  | 'check'
  | 'pencil'
  | 'download'
  | 'dots'
  | 'up'
  | 'down'
  | 'offline'
  | 'shield'
  | 'install'
  | 'share'
  | 'trash';

const paths: Record<IconName, string[]> = {
  back: ['M15 18l-6-6 6-6'],
  next: ['M9 18l6-6-6-6'],
  grid: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  list: ['M4 6h16', 'M4 12h16', 'M4 18h10'],
  chart: ['M5 20V10', 'M12 20V4', 'M19 20v-7'],
  plus: ['M12 5v14', 'M5 12h14'],
  gear: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  ],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-3.5-3.5'],
  check: ['M5 12l5 5 9-10'],
  pencil: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'],
  download: ['M12 4v11', 'M7 10l5 5 5-5', 'M5 20h14'],
  dots: ['M12 5h.01', 'M12 12h.01', 'M12 19h.01'],
  up: ['M6 15l6-6 6 6'],
  down: ['M6 9l6 6 6-6'],
  offline: ['M2 8.8a15 15 0 0 1 20 0', 'M5.5 12.4a10 10 0 0 1 13 0', 'M9 16a5 5 0 0 1 6 0', 'M12 19.5h.01', 'M3 3l18 18'],
  shield: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z'],
  install: ['M12 3v12', 'M7 10l5 5 5-5', 'M6 21h12', 'M4 17v4', 'M20 17v4'],
  share: ['M12 3v12', 'M8 7l4-4 4 4', 'M5 12v8h14v-8'],
  trash: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M6 7l1 13h10l1-13', 'M9 7V4h6v3'],
};

const strokeWidth = computed(() => (props.name === 'dots' ? 3.6 : 2.2));
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path v-for="d in paths[name]" :key="d" :d="d" />
  </svg>
</template>
