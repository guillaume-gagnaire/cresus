<script setup lang="ts">
import type { AdminAccountDetailDto } from '@cresus/shared';
import { api, errorMessage } from '~/utils/api';
import { formatDateLong, formatEuros, salesLabel } from '~/utils/format';

const route = useRoute();
const toast = useToast();
const accountId = computed(() => String(route.params.id));
const detail = ref<AdminAccountDetailDto | null>(null);
const error = ref('');

useHead(() => ({ title: `${detail.value?.account.name ?? 'Compte'} — Administration` }));

onMounted(async () => {
  try {
    detail.value = await api.get<AdminAccountDetailDto>(`/admin/accounts/${accountId.value}`);
  } catch (e) {
    error.value = errorMessage(e);
  }
});

const resetDialog = ref<HTMLDialogElement | null>(null);
const newPassword = ref('');
async function reset(): Promise<void> {
  try {
    newPassword.value = (await api.post<{ password: string }>(`/admin/accounts/${accountId.value}/reset-password`)).password;
  } catch (e) {
    toast.error(errorMessage(e));
  }
}
function openReset(): void {
  newPassword.value = '';
  resetDialog.value?.showModal();
}

const deleteDialog = ref<HTMLDialogElement | null>(null);
const confirmEmail = ref('');
async function remove(): Promise<void> {
  try {
    await api.del(`/admin/accounts/${accountId.value}`);
    deleteDialog.value?.close();
    toast.show('Compte supprimé');
    await navigateTo('/admin');
  } catch (e) {
    toast.error(errorMessage(e));
  }
}
</script>

<template>
  <div class="account">
    <NuxtLink to="/admin" class="back"><AppIcon name="back" :size="20" /> Administration</NuxtLink>
    <p v-if="error" role="alert" class="card error">{{ error }}</p>

    <template v-if="detail">
      <header class="head">
        <h1>{{ detail.account.name }}</h1>
        <p class="email">{{ detail.account.email }}</p>
        <p class="figures num">{{ formatEuros(detail.account.revenueCents) }} · {{ salesLabel(detail.account.salesCount) }}</p>
      </header>

      <h2>Évènements</h2>
      <ul v-if="detail.events.length > 0" class="events">
        <li v-for="event in detail.events" :key="event.id" class="card event">
          <span class="what">
            <span class="name">{{ event.name }}</span>
            <span class="date">{{ formatDateLong(event.date) }}</span>
            <span class="date num">{{ formatEuros(event.revenueCents) }} · {{ salesLabel(event.salesCount) }}</span>
          </span>
          <span class="links">
            <NuxtLink :to="`/admin/evenements/${event.id}`" class="btn btn-quiet small">Bilan</NuxtLink>
            <a :href="`/api/admin/events/${event.id}/export`" download class="btn btn-quiet small">Exporter</a>
          </span>
        </li>
      </ul>
      <p v-else class="empty">Aucun évènement.</p>

      <div class="card actions">
        <button type="button" class="btn btn-quiet" @click="openReset">Réinitialiser le mot de passe</button>
        <button type="button" class="btn btn-text" @click="deleteDialog?.showModal()">Supprimer le compte</button>
      </div>
    </template>

    <dialog ref="resetDialog" class="sheet" aria-labelledby="reset-title">
      <span class="sheet-grip" aria-hidden="true" />
      <div class="confirm">
        <h2 id="reset-title">Nouveau mot de passe</h2>
        <template v-if="!newPassword">
          <p>Un mot de passe est tiré au hasard et toutes les sessions de l’asso sont fermées. Transmettez-le-lui ensuite.</p>
          <button type="button" class="btn btn-primary btn-block" @click="reset">Réinitialiser</button>
          <button type="button" class="btn btn-quiet btn-block" @click="resetDialog?.close()">Annuler</button>
        </template>
        <template v-else>
          <p>Notez-le maintenant : il ne sera plus affiché.</p>
          <p class="password num" data-testid="new-password">{{ newPassword }}</p>
          <button type="button" class="btn btn-quiet btn-block" @click="resetDialog?.close()">Fermer</button>
        </template>
      </div>
    </dialog>

    <dialog ref="deleteDialog" class="sheet" aria-labelledby="delete-title">
      <span class="sheet-grip" aria-hidden="true" />
      <form v-if="detail" class="confirm" @submit.prevent="remove">
        <h2 id="delete-title">Supprimer {{ detail.account.name }} ?</h2>
        <p>Ses évènements, articles et ventes seront effacés. Tapez son email pour confirmer.</p>
        <label class="field">
          Email du compte
          <input v-model="confirmEmail" type="email" autocomplete="off">
        </label>
        <button type="submit" class="btn btn-primary btn-block" :disabled="confirmEmail.trim().toLowerCase() !== detail.account.email">Supprimer définitivement</button>
        <button type="button" class="btn btn-quiet btn-block" @click="deleteDialog?.close()">Annuler</button>
      </form>
    </dialog>
  </div>
</template>

<style scoped>
.account {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.head {
  padding: 0 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
h1 {
  font-size: 28px;
  letter-spacing: -0.01em;
}
h2 {
  font-size: 18px;
  padding: 0 4px;
}
.email {
  font-weight: 700;
  overflow-wrap: anywhere;
}
.figures {
  font-weight: 800;
  color: var(--muted);
}
.error {
  padding: 12px 14px;
  font-weight: 800;
  color: #8f2410;
}
.events {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.event {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.what {
  flex: 1;
  min-width: 180px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.name {
  font-size: 17px;
  font-weight: 900;
  color: var(--ink);
}
.date {
  font-size: 14px;
  font-weight: 700;
  color: var(--muted);
}
.date::first-letter {
  text-transform: uppercase;
}
.links {
  display: flex;
  gap: 8px;
}
.btn.small {
  min-height: 44px;
  padding: 0 14px;
  font-size: 15px;
}
.actions {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.empty {
  padding: 0 4px;
  font-weight: 600;
}
.confirm {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.confirm p {
  font-size: 16px;
  font-weight: 600;
}
.password {
  padding: 14px;
  border-radius: 14px;
  background: var(--ground);
  font-size: 26px !important;
  font-weight: 900 !important;
  letter-spacing: 0.08em;
  text-align: center;
  color: var(--ink);
  user-select: all;
}
</style>
