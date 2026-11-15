<script setup lang="ts">
import type { EventDto } from '@cresus/shared';
import { useAuthStore } from '~/stores/auth';
import { api, errorMessage } from '~/utils/api';
import { formatDateLong, formatEuros, salesLabel } from '~/utils/format';
import { readJson, writeJson } from '~/utils/storage';

useHead({ title: 'Vos évènements — Cresus' });

const auth = useAuthStore();
const cacheKey = computed(() => `cresus:events:${auth.account?.id ?? ''}`);
const events = ref<EventDto[] | null>(readJson<EventDto[] | null>(cacheKey.value, null));
const error = ref('');

onMounted(async () => {
  try {
    events.value = await api.get<EventDto[]>('/events');
    writeJson(cacheKey.value, events.value);
  } catch (e) {
    if (!events.value) error.value = errorMessage(e);
  }
});
</script>

<template>
  <div class="events">
    <header class="head">
      <div class="title">
        <span class="mark" aria-hidden="true">+1</span>
        <div>
          <h1>Vos évènements</h1>
          <p class="asso">{{ auth.account?.name }}</p>
        </div>
      </div>
      <div class="head-actions">
        <NuxtLink v-if="auth.account?.isAdmin" to="/admin" class="icon-button white" aria-label="Panneau d’admin"><AppIcon name="shield" /></NuxtLink>
        <NuxtLink to="/reglages" class="icon-button white" aria-label="Réglages de l’asso"><AppIcon name="gear" /></NuxtLink>
      </div>
    </header>

    <NuxtLink to="/evenements/nouveau" class="btn btn-primary btn-big btn-block new"><AppIcon name="plus" /> Nouvel évènement</NuxtLink>

    <p v-if="error" role="alert" class="empty">{{ error }}</p>
    <div v-else-if="events && events.length === 0" class="card empty-card">
      <h2>Première kermesse ?</h2>
      <p>Créez un évènement, ajoutez vos articles (crêpes, boissons, tickets…), puis ouvrez la caisse sur les téléphones des bénévoles.</p>
    </div>

    <ul v-else class="list">
      <li v-for="event in events ?? []" :key="event.id">
        <NuxtLink :to="`/evenements/${event.id}`" class="card event">
          <span class="what">
            <span class="name">{{ event.name }}</span>
            <span class="date">{{ formatDateLong(event.date) }}</span>
          </span>
          <span class="figures">
            <span class="total num">{{ formatEuros(event.revenueCents) }}</span>
            <span class="count">{{ salesLabel(event.salesCount) }}</span>
          </span>
          <AppIcon name="next" :size="20" class="chev" />
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.events {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 4px;
}
.title {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.mark {
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: 14px;
  background: var(--coral);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 900;
  letter-spacing: -0.02em;
}
.asso {
  font-size: 15px;
  font-weight: 800;
  color: var(--muted);
}
h1 {
  font-size: 28px;
  letter-spacing: -0.01em;
}
.head-actions {
  display: flex;
  gap: 8px;
}
.icon-button.white {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: var(--card);
}
.new {
  box-shadow: 0 8px 18px rgba(207, 53, 25, 0.22);
}
.list {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.event {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 16px 16px 18px;
  text-decoration: none;
  color: var(--ink);
  transition: transform 220ms var(--spring);
}
.event:active {
  transform: scale(0.98);
  transition-duration: 90ms;
}
.what {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.name {
  font-size: 19px;
  font-weight: 900;
  line-height: 1.2;
}
.date,
.count {
  font-size: 15px;
  font-weight: 700;
  color: var(--muted);
}
.date::first-letter {
  text-transform: uppercase;
}
.figures {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.total {
  font-size: 20px;
  font-weight: 900;
}
.chev {
  color: var(--muted);
  flex: none;
}
.empty-card {
  padding: 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.empty-card h2 {
  font-size: 20px;
}
.empty-card p,
.empty {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.45;
}
</style>
