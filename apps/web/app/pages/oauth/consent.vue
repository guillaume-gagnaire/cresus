<script setup lang="ts">
/**
 * Écran de consentement OAuth : `/authorize` (API) y envoie l’utilisateur avec `?request=<id>`. Il a besoin d’une session
 * (le middleware renvoie sur /login?redirect=… sinon). L’hôte de redirection est affiché en évidence : c’est ce qui distingue
 * le vrai client du premier venu qui s’est enregistré sous le nom « Claude Code ».
 */
definePageMeta({ layout: 'auth' });

interface ConsentRequest {
  clientName: string;
  redirectHost: string;
  scope: string;
}

const EXPIRED = 'Cette demande d’autorisation a expiré. Relance la connexion depuis Claude Code.';
const GENERIC_ERROR = 'Une erreur est survenue. Réessaie dans un instant.';

const route = useRoute();
const auth = useAuthStore();
const { isDesktop } = useBreakpoint();

const requestId = typeof route.query.request === 'string' ? route.query.request : '';
const consent = ref<ConsentRequest | null>(null);
// Demande introuvable ou périmée : plus rien à décider, l’écran se réduit au message et au lien de retour.
const failure = ref('');
// Échec d’un clic (réseau, serveur) : la demande reste valable, les boutons permettent de réessayer.
const error = ref('');
const pending = ref<'approve' | 'deny' | null>(null);

const path = `/oauth/requests/${encodeURIComponent(requestId)}`;

/** La session a disparu pendant l’écran : retour à la connexion, puis à cette demande. */
async function sessionLost(): Promise<void> {
  auth.reset();
  await navigateTo({ path: '/login', query: { redirect: route.fullPath } });
}

/** Renvoie true quand l’erreur a été traitée (session perdue ou demande périmée), false pour un échec à réessayer. */
async function settle(e: unknown): Promise<boolean> {
  if (!(e instanceof ApiError)) return false;
  if (e.status === 401) {
    await sessionLost();
    return true;
  }
  if (e.status === 404) {
    consent.value = null;
    failure.value = e.message;
    return true;
  }
  return false;
}

async function load(): Promise<void> {
  if (!requestId) {
    failure.value = EXPIRED;
    return;
  }
  try {
    consent.value = await api<ConsentRequest>(path);
  } catch (e) {
    if (!(await settle(e))) failure.value = e instanceof ApiError ? e.message : GENERIC_ERROR;
  }
}
await load();

async function decide(decision: 'approve' | 'deny'): Promise<void> {
  if (pending.value) return;
  error.value = '';
  pending.value = decision;
  try {
    const { redirectUrl } = await api<{ redirectUrl: string }>(`${path}/${decision}`, { method: 'POST' });
    // L’API ne renvoie que des adresses http(s) enregistrées par le client ; on ne suit rien d’autre, quoi qu’il arrive.
    if (!/^https?:\/\//i.test(redirectUrl)) throw new Error('Unexpected redirect target');
    window.location.assign(redirectUrl);
    return; // la page part : les boutons restent bloqués pour éviter un second clic
  } catch (e) {
    if (!(await settle(e))) error.value = e instanceof ApiError ? e.message : GENERIC_ERROR;
  }
  pending.value = null;
}
</script>

<template>
  <div class="consent" :class="{ card: isDesktop }">
    <header class="head">
      <ProfileBadge size="xl" />
      <h1 v-if="consent"><strong class="client">{{ consent.clientName }}</strong> veut accéder à ton compte Ma Tréso</h1>
      <h1 v-else>Demande d’autorisation</h1>
    </header>

    <template v-if="consent">
      <p class="lead">Il pourra consulter ta trésorerie et modifier tes clients, congés et charges en ton nom.</p>
      <p class="redirect">Après validation, tu seras renvoyé vers <strong class="host">{{ consent.redirectHost }}</strong>.</p>

      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div class="actions">
        <AppButton variant="primary" block :disabled="pending !== null" @click="decide('approve')">Autoriser</AppButton>
        <AppButton block :disabled="pending !== null" @click="decide('deny')">Refuser</AppButton>
      </div>
      <p class="sm note">Tu pourras révoquer l’accès en te déconnectant de l’app MCP.</p>
    </template>

    <template v-else>
      <p class="error" role="alert">{{ failure }}</p>
      <NuxtLink class="home" to="/">Retour à Ma Tréso</NuxtLink>
    </template>
  </div>
</template>

<style scoped>
/* Même colonne que la connexion (layout `auth`, 440 px max) ; sur desktop elle devient une carte. */
.consent { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
.consent.card { padding: 32px 28px 28px; }

.head { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 14px 0 0; text-align: center; }
h1 { margin: 0; font-size: 28px; font-weight: 600; line-height: 1.2; letter-spacing: -0.01em; text-wrap: balance; overflow-wrap: anywhere; }
.client { font-weight: 800; }
.lead { margin: 0; text-align: center; font-size: 16px; line-height: 1.5; color: var(--ink-2); }

/* Bandeau jaune des astuces de l’app : l’hôte vers lequel part le code d’autorisation, à vérifier avant de cliquer. */
.redirect { margin: 0; padding: 16px 18px; border-radius: 20px; background: var(--tip-bg); color: var(--tip-ink); text-align: center; font-size: 15px; line-height: 1.5; }
/* En ligne (le point final reste collé à l’hôte, même coupé sur plusieurs lignes), précédé d’un retour à la ligne. */
.host { font-family: var(--font-display); font-size: 22px; font-weight: 800; letter-spacing: -0.01em; line-height: 1.3; overflow-wrap: anywhere; }
.host::before { content: "\A"; white-space: pre; }

.error { margin: 0; padding: 12px 16px; border-radius: 16px; background: var(--danger-bg); color: var(--danger-ink); font-size: 15px; font-weight: 600; line-height: 1.4; }
.actions { display: flex; flex-direction: column; gap: 12px; }
.note { margin: 0; text-align: center; text-wrap: balance; }
.home { align-self: center; display: inline-flex; align-items: center; min-height: 44px; padding: 0 12px; }
</style>
