<script setup lang="ts">
import { LIMITS } from '@cresus/shared';
import { useAuthStore } from '~/stores/auth';
import { errorMessage } from '~/utils/api';

useHead({ title: 'Connexion — Cresus' });

const auth = useAuthStore();
const route = useRoute();
const { installed, dismissed, start } = useInstall();

const mode = ref<'login' | 'signup'>('login');
const name = ref('');
const email = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);

const title = computed(() => (mode.value === 'login' ? 'Se connecter' : 'Créer le compte'));

async function submit(): Promise<void> {
  error.value = '';
  busy.value = true;
  try {
    if (mode.value === 'login') await auth.login(email.value, password.value);
    else await auth.signup(name.value, email.value, password.value);
    await navigateTo(String(route.query.redirect ?? '/'));
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

function switchTo(next: 'login' | 'signup'): void {
  mode.value = next;
  error.value = '';
}
</script>

<template>
  <div class="login">
    <header class="intro">
      <BrandMark />
      <p class="tagline">La caisse de la buvette : un appui, une vente. Le bilan de la kermesse en un clic.</p>
    </header>

    <form class="card form" novalidate @submit.prevent="submit">
      <div role="tablist" aria-label="Connexion ou inscription" class="tabs">
        <button type="button" role="tab" :aria-selected="mode === 'login'" @click="switchTo('login')">Se connecter</button>
        <button type="button" role="tab" :aria-selected="mode === 'signup'" @click="switchTo('signup')">Créer le compte</button>
      </div>

      <label v-if="mode === 'signup'" class="field">
        Nom de l’asso
        <input v-model="name" type="text" autocomplete="organization" :maxlength="LIMITS.accountName" placeholder="APE de l’école Jules Ferry" required>
      </label>
      <label class="field">
        Email de l’asso
        <input v-model="email" type="email" autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" required>
      </label>
      <label class="field">
        Mot de passe
        <input v-model="password" type="password" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" required>
        <span v-if="mode === 'signup'" class="hint">Au moins {{ LIMITS.passwordMin }} caractères. Les bénévoles l’utiliseront aussi.</span>
      </label>

      <p v-if="error" role="alert" class="error">{{ error }}</p>

      <button type="submit" class="btn btn-primary btn-big btn-block" :disabled="busy">{{ title }}</button>
      <p v-if="mode === 'login'" class="forgot">Mot de passe oublié ? Demandez à l’administrateur de Cresus.</p>
    </form>

    <button v-if="!installed && dismissed" type="button" class="btn btn-secondary btn-block" @click="start">
      <AppIcon name="install" /> Installer l’appli
    </button>

    <p class="foot">Un compte par asso. Partagez l’email et le mot de passe avec les bénévoles : chacun vend depuis son téléphone, tout s’additionne en direct.</p>
  </div>
</template>

<style scoped>
.login {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding-top: 40px;
  flex: 1;
}
.intro {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 0 4px;
}
.tagline {
  font-size: 19px;
  font-weight: 700;
  line-height: 1.35;
}
.form {
  padding: 20px 18px 22px;
  border-radius: var(--radius-big);
  box-shadow: var(--shadow-raised);
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  padding: 4px;
  border-radius: 16px;
  background: var(--ground);
}
.tabs button {
  min-height: 44px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--muted);
  font-size: 15px;
  font-weight: 800;
}
.tabs button[aria-selected='true'] {
  background: var(--card);
  color: var(--ink);
  font-weight: 900;
  box-shadow: 0 2px 6px rgba(59, 42, 38, 0.1);
}
.error {
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--coral-tint);
  color: var(--error-ink);
  font-weight: 800;
}
.forgot {
  font-size: 14px;
  font-weight: 600;
  color: var(--muted);
  text-align: center;
}
.foot {
  margin-top: auto;
  padding: 0 4px;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.45;
  color: var(--muted);
}
</style>
