<script setup lang="ts">
import type { IconName } from '~/components/ui/AppIcon.vue';

const props = defineProps<{ eventId: string }>();
const route = useRoute();

const tabs = computed<Array<{ to: string; label: string; icon: IconName }>>(() => [
  { to: `/evenements/${props.eventId}`, label: 'Caisse', icon: 'grid' },
  { to: `/evenements/${props.eventId}/articles`, label: 'Articles', icon: 'list' },
  { to: `/evenements/${props.eventId}/bilan`, label: 'Bilan', icon: 'chart' },
]);
</script>

<template>
  <nav class="tabs" aria-label="Navigation de l’évènement">
    <NuxtLink v-for="tab in tabs" :key="tab.to" :to="tab.to" class="tab" :aria-current="route.path === tab.to ? 'page' : undefined">
      <AppIcon :name="tab.icon" />
      {{ tab.label }}
    </NuxtLink>
  </nav>
</template>

<style scoped>
.tabs {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  height: calc(var(--tabbar-h) + env(safe-area-inset-bottom));
  padding: 8px 18px calc(18px + env(safe-area-inset-bottom));
  background: var(--card);
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  box-shadow: 0 -6px 18px rgba(59, 42, 38, 0.08);
}
.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-radius: 16px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 800;
  color: var(--text);
}
.tab[aria-current='page'] {
  background: var(--coral);
  color: #fff;
}
@media (min-width: 900px) {
  .tabs {
    position: static;
    height: auto;
    padding: 5px;
    border-radius: 18px;
    display: flex;
    gap: 6px;
    box-shadow: none;
  }
  .tab {
    min-height: 44px;
    padding: 0 20px;
    flex-direction: row;
    gap: 8px;
    border-radius: 14px;
    font-size: 15px;
  }
}
</style>
