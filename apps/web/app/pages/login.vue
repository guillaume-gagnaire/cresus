<script setup lang="ts">
definePageMeta({ layout: 'auth' });

const auth = useAuthStore();
const route = useRoute();
const toast = useToast();
const { isDesktop } = useBreakpoint();

type Mode = 'in' | 'up';
const modeOptions = [
  { value: 'in', label: 'Se connecter' },
  { value: 'up', label: 'Créer un compte' },
] as const;

const mode = ref<Mode>('in');
const firstName = ref('');
const email = ref('');
const password = ref('');
const showPassword = ref(false);
const pending = ref<'password' | 'passkey' | null>(null);
const error = ref('');

const signup = computed(() => mode.value === 'up');
const busy = computed(() => pending.value !== null);
const title = computed(() => (signup.value ? 'Bienvenue !' : 'Content de te revoir'));
const sub = computed(() => (signup.value ? 'Crée ton compte pour piloter la tréso de ta société.' : 'Connecte-toi pour voir où en est ta tréso.'));
const cta = computed(() => (pending.value === 'password' ? 'Un instant…' : signup.value ? 'Créer mon compte' : 'Se connecter'));
// Le bouton Face ID n’a de sens que si le navigateur sait gérer les passkeys (l’app est une SPA : `window` existe toujours ici).
const passkeySupported = import.meta.client && !!window.PublicKeyCredential;

const passwordId = useId();
const hintId = useId();

// Une erreur affichée appartient au mode qui l’a produite.
watch(mode, () => { error.value = ''; });

const GENERIC_ERROR = 'Une erreur est survenue. Réessaie dans un instant.';

function messageFor(e: unknown, viaPasskey: boolean): string {
  if (e instanceof ApiError) return e.message;
  // Côté passkey, tout ce qui n’est pas une réponse de l’API vient de la feuille système (annulation, `NotAllowedError`,
  // authentificateur absent…) : le message invite à réessayer ou à utiliser le mot de passe, sans jargon.
  return viaPasskey ? 'Connexion par Face ID annulée.' : GENERIC_ERROR;
}

async function run(kind: 'password' | 'passkey', action: () => Promise<void>) {
  if (busy.value) return;
  error.value = '';
  pending.value = kind;
  try {
    await action();
    // Connexion ou inscription : retour à la page qui a demandé la session (ex. l’écran de consentement OAuth), sinon l’accueil.
    await navigateTo(safeRedirect(route.query.redirect) ?? '/');
  } catch (e) {
    error.value = messageFor(e, kind === 'passkey');
  } finally {
    pending.value = null;
  }
}

function submit() {
  return run('password', () => (signup.value ? auth.register(email.value, password.value, firstName.value) : auth.login(email.value, password.value)));
}

function loginWithPasskey() {
  return run('passkey', () => auth.loginWithPasskey());
}

function forgotPassword() {
  toast.show('Bientôt disponible : écris-nous en attendant.');
}
</script>

<template>
  <div class="login" :class="{ card: isDesktop }">
    <header class="head">
      <div class="logo" aria-hidden="true">GD</div>
      <h1>{{ title }}</h1>
      <p class="sub">{{ sub }}</p>
    </header>

    <SegmentedControl v-model="mode" ariaLabel="Mode" :options="modeOptions" />

    <form class="form" novalidate @submit.prevent="submit">
      <label v-if="signup" class="field">Prénom<input v-model="firstName" name="given-name" type="text" autocomplete="given-name" placeholder="Guillaume" required></label>
      <label class="field">E-mail<input v-model="email" name="email" type="email" autocomplete="email" inputmode="email" placeholder="toi@exemple.fr" required></label>
      <div class="field">
        <label :for="passwordId">Mot de passe</label>
        <div class="pw">
          <input
            :id="passwordId"
            v-model="password"
            name="password"
            :type="showPassword ? 'text' : 'password'"
            :autocomplete="signup ? 'new-password' : 'current-password'"
            :aria-describedby="signup ? hintId : undefined"
            placeholder="••••••••"
            required
          >
          <button class="eye" type="button" :aria-label="showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'" @click="showPassword = !showPassword">
            <AppIcon :name="showPassword ? 'eye-off' : 'eye'" />
          </button>
        </div>
        <span v-if="signup" :id="hintId" class="sm hint">8 caractères minimum.</span>
      </div>
      <button v-if="!signup" class="forgot" type="button" @click="forgotPassword">Mot de passe oublié&#160;?</button>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <AppButton class="cta" variant="primary" type="submit" block :disabled="busy">{{ cta }}</AppButton>
    </form>

    <template v-if="passkeySupported">
      <div class="or"><span class="rule" />ou<span class="rule" /></div>
      <AppButton class="passkey" block :disabled="busy" @click="loginWithPasskey">
        <AppIcon name="face-id" :size="22" />
        Se connecter avec Face ID
      </AppButton>
    </template>

    <p class="sm privacy">Tes données financières restent chiffrées. On ne les partage avec personne.</p>
  </div>
</template>

<style scoped>
/* Maquette Mobile-Connexion.dc.html : la colonne de 440 px max est fournie par le layout `auth` ; sur desktop elle devient une carte. */
.login { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
.login.card { padding: 32px 28px 28px; }

.head { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 18px 0 6px; text-align: center; }
.logo {
  width: 76px;
  height: 76px;
  border-radius: 24px;
  background: var(--sun);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 28px;
  transform: rotate(-6deg);
  box-shadow: 0 6px 0 var(--ink);
}
h1 { margin: 6px 0 0; font-size: 34px; font-weight: 800; letter-spacing: -0.02em; }
.sub { margin: 0; font-size: 16px; color: var(--muted); max-width: 300px; }

.form { display: flex; flex-direction: column; gap: 14px; }
.pw { position: relative; }
.pw input { width: 100%; padding-right: 56px; }
.eye {
  position: absolute;
  right: 4px;
  top: 3px;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.eye:hover { color: var(--ink); }
.hint { font-weight: 500; }

/* « Mot de passe oublié ? » est un bouton (pas de page de réinitialisation) rendu comme le lien de la maquette. */
.forgot {
  align-self: flex-end;
  min-height: 44px;
  padding: 0 4px;
  border: 0;
  background: transparent;
  color: var(--link);
  font: 600 15px var(--font-text);
  cursor: pointer;
}
.forgot:hover { color: var(--link-hover); }

.error { margin: 0; padding: 12px 16px; border-radius: 16px; background: var(--danger-bg); color: var(--danger-ink); font-size: 15px; font-weight: 600; line-height: 1.4; }
.cta { min-height: 56px; }

.or { display: flex; align-items: center; gap: 12px; color: var(--muted); font-size: 14px; }
.rule { flex: 1; height: 1.5px; background: var(--border); }
.passkey { min-height: 54px; gap: 10px; }

.privacy { margin: 0; text-align: center; }
</style>
