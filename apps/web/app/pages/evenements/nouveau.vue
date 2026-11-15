<script setup lang="ts">
import { type EventDetailDto, type EventDto, LIMITS } from '@cresus/shared';
import { api, errorMessage } from '~/utils/api';
import { todayIso } from '~/utils/format';

useHead({ title: 'Nouvel évènement — Cresus' });

const name = ref('');
const date = ref(todayIso());
const copyFrom = ref('');
const previous = ref<EventDto[]>([]);
const copied = ref<EventDetailDto | null>(null);
const error = ref('');
const busy = ref(false);

onMounted(async () => {
  try {
    previous.value = await api.get<EventDto[]>('/events');
  } catch {
    // hors ligne : pas de reprise possible, la création elle-même demandera le réseau
  }
});

watch(copyFrom, async (id) => {
  copied.value = null;
  if (!id) return;
  try {
    copied.value = await api.get<EventDetailDto>(`/events/${id}`);
  } catch {
    copied.value = null;
  }
});

const copiedArticles = computed(() => (copied.value?.articles ?? []).filter((a) => !a.archived));

async function create(): Promise<void> {
  error.value = '';
  busy.value = true;
  try {
    const event = await api.post<EventDto>('/events', { name: name.value, date: date.value, ...(copyFrom.value ? { copyFromEventId: copyFrom.value } : {}) });
    await navigateTo(`/evenements/${event.id}`);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="new">
    <NuxtLink to="/" class="back"><AppIcon name="back" :size="20" /> Évènements</NuxtLink>
    <h1>Nouvel évènement</h1>

    <form class="card form" novalidate @submit.prevent="create">
      <label class="field">
        Nom
        <input v-model="name" type="text" :maxlength="LIMITS.eventName" placeholder="Kermesse 2027" required>
      </label>
      <label class="field">
        Date
        <input v-model="date" type="date" required>
      </label>
      <label v-if="previous.length > 0" class="field">
        Reprendre les articles de…
        <select v-model="copyFrom">
          <option value="">Aucun : je pars de zéro</option>
          <option v-for="event in previous" :key="event.id" :value="event.id">{{ event.name }}</option>
        </select>
        <span class="hint">Noms, prix et pictos sont recopiés. Vous pourrez tout modifier ensuite.</span>
      </label>

      <div v-if="copiedArticles.length > 0" class="copied">
        <span class="copied-title">{{ copiedArticles.length }} article{{ copiedArticles.length > 1 ? 's' : '' }} repris</span>
        <ul class="chips">
          <li v-for="article in copiedArticles" :key="article.id" class="chip">
            <PictoImg :name="article.name" :picto="article.picto" :size="22" />
            {{ article.name }}
          </li>
        </ul>
      </div>

      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <button type="submit" class="btn btn-primary btn-big btn-block" :disabled="busy || !name.trim()">Créer l’évènement</button>
    </form>
  </div>
</template>

<style scoped>
.new {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
h1 {
  margin: 0 4px;
  font-size: 28px;
  letter-spacing: -0.01em;
}
.form {
  padding: 20px 18px 22px;
  border-radius: var(--radius-big);
  box-shadow: var(--shadow-raised);
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.copied {
  padding: 14px;
  border-radius: 18px;
  background: var(--ground);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.copied-title {
  font-size: 14px;
  font-weight: 800;
  color: var(--muted);
}
.chips {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px 5px 6px;
  border-radius: 999px;
  background: var(--card);
  font-size: 14px;
  font-weight: 800;
  color: var(--ink);
}
.error {
  font-weight: 800;
  color: #8f2410;
}
</style>
