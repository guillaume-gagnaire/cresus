<script setup lang="ts">
import { LIMITS } from '@cresus/shared';
import { useAuthStore } from '~/stores/auth';
import { errorMessage } from '~/utils/api';

useHead({ title: 'Réglages — Cresus' });

const auth = useAuthStore();
const toast = useToast();

const name = ref(auth.account?.name ?? '');
const currentPassword = ref('');
const newPassword = ref('');
const deletePassword = ref('');
const busy = ref<'' | 'name' | 'password' | 'delete' | 'logout'>('');
const confirmDelete = ref<HTMLDialogElement | null>(null);
const deleteError = ref('');

async function saveName(): Promise<void> {
  busy.value = 'name';
  try {
    await auth.rename(name.value);
    toast.show('Nom enregistré');
  } catch (e) {
    toast.error(errorMessage(e));
  } finally {
    busy.value = '';
  }
}

async function savePassword(): Promise<void> {
  busy.value = 'password';
  try {
    await auth.changePassword(currentPassword.value, newPassword.value);
    currentPassword.value = '';
    newPassword.value = '';
    toast.show('Mot de passe changé. Les autres appareils devront se reconnecter.');
  } catch (e) {
    toast.error(errorMessage(e));
  } finally {
    busy.value = '';
  }
}

async function logout(): Promise<void> {
  busy.value = 'logout';
  try {
    await auth.logout();
  } finally {
    busy.value = '';
    await navigateTo('/login');
  }
}

async function removeAccount(): Promise<void> {
  deleteError.value = '';
  busy.value = 'delete';
  try {
    await auth.deleteAccount(deletePassword.value);
    confirmDelete.value?.close();
    await navigateTo('/login');
  } catch (e) {
    deleteError.value = errorMessage(e);
  } finally {
    busy.value = '';
  }
}
</script>

<template>
  <div class="settings">
    <NuxtLink to="/" class="back"><AppIcon name="back" :size="20" /> Évènements</NuxtLink>
    <h1>Réglages</h1>

    <form class="card block" @submit.prevent="saveName">
      <label class="field">
        Nom de l’asso
        <input v-model="name" type="text" :maxlength="LIMITS.accountName" required>
      </label>
      <p class="readonly"><span>Email</span> {{ auth.account?.email }}</p>
      <button type="submit" class="btn btn-primary" :disabled="busy === 'name' || !name.trim()">Enregistrer le nom</button>
    </form>

    <form class="card block" @submit.prevent="savePassword">
      <h2>Mot de passe</h2>
      <label class="field">
        Mot de passe actuel
        <input v-model="currentPassword" type="password" autocomplete="current-password" required>
      </label>
      <label class="field">
        Nouveau mot de passe
        <input v-model="newPassword" type="password" autocomplete="new-password" :minlength="LIMITS.passwordMin" required>
        <span class="hint">Les autres téléphones de l’asso seront déconnectés : donnez le nouveau mot de passe aux bénévoles.</span>
      </label>
      <button type="submit" class="btn btn-primary" :disabled="busy === 'password'">Changer le mot de passe</button>
    </form>

    <div class="card block">
      <NuxtLink v-if="auth.account?.isAdmin" to="/admin" class="btn btn-quiet"><AppIcon name="shield" /> Panneau d’admin</NuxtLink>
      <button type="button" class="btn btn-quiet" :disabled="busy === 'logout'" @click="logout">Se déconnecter</button>
      <button type="button" class="btn btn-text" @click="confirmDelete?.showModal()">Supprimer le compte de l’asso</button>
    </div>

    <p class="credits">Pictos : <a href="https://github.com/microsoft/fluentui-emoji" rel="noopener" target="_blank">Fluent Emoji</a> © Microsoft, licence MIT.</p>

    <dialog ref="confirmDelete" class="sheet" aria-labelledby="delete-title">
      <span class="sheet-grip" aria-hidden="true" />
      <form class="confirm" @submit.prevent="removeAccount">
        <h2 id="delete-title">Supprimer le compte ?</h2>
        <p>Tous les évènements, articles et ventes de l’asso seront effacés. C’est définitif.</p>
        <label class="field">
          Mot de passe
          <input v-model="deletePassword" type="password" autocomplete="current-password" required>
        </label>
        <p v-if="deleteError" role="alert" class="error">{{ deleteError }}</p>
        <button type="submit" class="btn btn-primary btn-block" :disabled="busy === 'delete'">Supprimer définitivement</button>
        <button type="button" class="btn btn-quiet btn-block" @click="confirmDelete?.close()">Annuler</button>
      </form>
    </dialog>
  </div>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
h1 {
  margin: 0 4px;
  font-size: 28px;
  letter-spacing: -0.01em;
}
h2 {
  font-size: 18px;
}
.block {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.readonly {
  font-size: 16px;
  font-weight: 700;
  color: var(--ink);
  overflow-wrap: anywhere;
}
.readonly span {
  display: block;
  font-size: 14px;
  font-weight: 800;
  color: var(--muted);
}
.credits {
  padding: 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--muted);
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
.error {
  color: var(--error-ink);
  font-weight: 800;
}
</style>
