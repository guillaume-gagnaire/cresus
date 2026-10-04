<script setup lang="ts">
definePageMeta({ layout: 'auth' });

const auth = useAuthStore();
const toast = useToast();

const email = ref('');
const password = ref('');
const busy = ref(false);

async function submit() {
  busy.value = true;
  try {
    await auth.login(email.value, password.value);
    await navigateTo('/');
  } catch (e) {
    toast.error(e instanceof ApiError ? e.message : 'Une erreur est survenue. Réessaie dans un instant.');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <h1>Ma Tréso</h1>
  <form class="form" @submit.prevent="submit">
    <label class="field">E-mail<input v-model="email" type="email" autocomplete="email" inputmode="email" required></label>
    <label class="field">Mot de passe<input v-model="password" type="password" autocomplete="current-password" required></label>
    <button class="btn pri" type="submit" :disabled="busy">Se connecter</button>
  </form>
</template>

<style scoped>
h1 { margin: 0; font-size: 34px; font-weight: 800; letter-spacing: -0.02em; }
.form { display: flex; flex-direction: column; gap: 14px; }
.btn { min-height: 56px; }
</style>
