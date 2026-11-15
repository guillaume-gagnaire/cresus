<script setup lang="ts">
import type { EventDetailDto } from '@cresus/shared';
import { api, errorMessage } from '~/utils/api';

const route = useRoute();
const router = useRouter();
const eventId = computed(() => String(route.params.id));
const detail = ref<EventDetailDto | null>(null);
const error = ref('');

useHead(() => ({ title: `Bilan — ${detail.value?.event.name ?? 'Administration'}` }));

onMounted(async () => {
  try {
    detail.value = await api.get<EventDetailDto>(`/admin/events/${eventId.value}`);
  } catch (e) {
    error.value = errorMessage(e);
  }
});
</script>

<template>
  <div class="admin-event">
    <button type="button" class="back as-button" @click="router.back()"><AppIcon name="back" :size="20" /> Retour au compte</button>
    <p v-if="error" role="alert" class="card error">{{ error }}</p>
    <BilanView
      v-if="detail"
      :event="detail.event"
      :articles="detail.articles"
      :summary="detail.summary"
      :export-href="`/api/admin/events/${eventId}/export`"
      :subtitle="`Lecture seule · ${detail.event.name}`"
    />
  </div>
</template>

<style scoped>
.admin-event {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.as-button {
  border: 0;
  background: transparent;
  padding: 0;
}
.error {
  padding: 12px 14px;
  font-weight: 800;
  color: var(--error-ink);
}
</style>
