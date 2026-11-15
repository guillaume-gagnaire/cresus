<script setup lang="ts">
const route = useRoute();
const eventId = computed(() => String(route.params.id));
</script>

<template>
  <div class="event-layout">
    <div class="topbar">
      <NuxtLink to="/" class="back"><AppIcon name="back" :size="20" /> Évènements</NuxtLink>
      <slot name="status" />
      <EventTabs class="wide-tabs" :event-id="eventId" />
    </div>
    <slot />
    <EventTabs class="phone-tabs" :event-id="eventId" />
  </div>
</template>

<style scoped>
.event-layout {
  max-width: 1280px;
  margin: 0 auto;
  min-height: 100dvh;
  padding: max(10px, env(safe-area-inset-top)) 14px calc(var(--tabbar-h) + 28px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 4px;
}
.wide-tabs {
  display: none;
}
@media (min-width: 900px) {
  .event-layout {
    padding: 18px 20px 24px;
    gap: 14px;
  }
  .wide-tabs {
    display: flex;
  }
  .phone-tabs {
    display: none;
  }
}
</style>
