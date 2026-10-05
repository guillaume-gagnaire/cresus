<script setup lang="ts">
/**
 * Profil (Mobile-Profil.dc.html l. 51 à 67, logique l. 68 à 79). La maquette est mobile : sur desktop, le même contenu tient
 * dans une colonne de 640 px. Les lignes de la maquette deviennent des réglages réels : société et solde sont modifiables sur
 * place, les interrupteurs enregistrent tout de suite, les lignes à chevron ouvrent un formulaire ou une confirmation.
 */
const auth = useAuthStore();
const treso = useTresoStore();
const toast = useToast();
const { isDesktop } = useBreakpoint();

const user = computed(() => auth.me?.user ?? null);
const isAdmin = computed(() => user.value?.role === 'ADMIN');

/** Barre latérale et pastilles lisent l’identité dans `auth.me` : on l’aligne sur le profil que le serveur vient de confirmer. */
function syncIdentity(): void {
  if (auth.me && treso.profile) auth.me = { ...auth.me, user: { ...treso.profile } };
}

// --- Mon compte ---------------------------------------------------------------------------------------------------

const company = ref(treso.profile?.companyName ?? '');
watch(() => treso.profile?.companyName, (name) => { company.value = name ?? ''; });

async function saveCompany(): Promise<void> {
  const next = company.value.trim();
  company.value = next;
  if (next === (treso.profile?.companyName ?? '')) return;
  if (await treso.updateProfile({ companyName: next || null })) syncIdentity();
}

const balance = computed(() => treso.balance?.amount ?? null);
/** Un champ vidé ne supprime pas le solde : on remonte le champ pour qu’il reprenne la valeur enregistrée. */
const balanceKey = ref(0);

function saveBalance(cents: number | null): void {
  if (cents === null) {
    balanceKey.value += 1;
    return;
  }
  void treso.setBalance(cents);
}

// --- Sécurité -----------------------------------------------------------------------------------------------------

// L’interrupteur n’a de sens que si le navigateur sait gérer les passkeys (l’app est une SPA : `window` existe toujours ici).
const faceSupported = import.meta.client && !!window.PublicKeyCredential;
const faceBusy = ref(false);

async function setFaceId(on: boolean): Promise<void> {
  if (faceBusy.value) return;
  faceBusy.value = true;
  try {
    if (on) await auth.enablePasskey();
    else await auth.disablePasskey();
  } catch (e) {
    // Côté activation, tout ce qui échoue (annulation, authentificateur absent, réponse de l’API) mène au même message simple.
    toast.error(on ? 'Impossible d’activer Face ID sur cet appareil.' : e instanceof ApiError ? e.message : 'Impossible de désactiver Face ID.');
  } finally {
    faceBusy.value = false;
  }
}

const passwordFormId = useId();
const passwordHintId = useId();
const passwordOpen = ref(false);
const currentPassword = ref('');
const newPassword = ref('');
const passwordBusy = ref(false);
const passwordError = ref('');
const passwordToggle = ref<HTMLButtonElement | null>(null);
const currentInput = ref<HTMLInputElement | null>(null);

async function togglePassword(): Promise<void> {
  if (passwordOpen.value) return closePassword();
  passwordOpen.value = true;
  await nextTick();
  currentInput.value?.focus();
}

async function closePassword(): Promise<void> {
  passwordOpen.value = false;
  currentPassword.value = '';
  newPassword.value = '';
  passwordError.value = '';
  await nextTick();
  passwordToggle.value?.focus(); // le formulaire disparaît : le focus revient sur la ligne qui l’ouvrait
}

async function submitPassword(): Promise<void> {
  if (passwordBusy.value) return;
  passwordError.value = '';
  passwordBusy.value = true;
  try {
    await auth.changePassword(currentPassword.value, newPassword.value);
    await closePassword();
    toast.show('Mot de passe modifié.');
  } catch (e) {
    passwordError.value = e instanceof ApiError ? e.message : 'Une erreur est survenue. Réessaie dans un instant.';
  } finally {
    passwordBusy.value = false;
  }
}

// Accès accordés à des applications (Claude Code…) : une boîte de confirmation, puis l’API révoque tous les jetons du compte.
const appsOpen = ref(false);
const appsBusy = ref(false);

async function revokeApps(): Promise<void> {
  if (appsBusy.value) return;
  appsBusy.value = true;
  try {
    await auth.revokeAppAccess();
    toast.show('Applications déconnectées.');
  } catch (e) {
    toast.error(e instanceof ApiError ? e.message : 'Déconnexion impossible. Réessaie dans un instant.');
  } finally {
    appsBusy.value = false;
    appsOpen.value = false; // le message s’affiche sur la page, pas sous la boîte
  }
}

// --- Alertes ------------------------------------------------------------------------------------------------------

const ALERTS = [
  { key: 'alertRedMonth', label: 'Mois dans le rouge', hint: 'Prévenir 15 jours avant' },
  { key: 'alertLatePayment', label: 'Paiement en retard', hint: 'Quand une facture est en retard' },
] as const;

const alertOn = (key: (typeof ALERTS)[number]['key']): boolean => treso.profile?.[key] ?? false;

function setAlert(key: (typeof ALERTS)[number]['key'], on: boolean): void {
  void treso.updateProfile(key === 'alertRedMonth' ? { alertRedMonth: on } : { alertLatePayment: on });
}

// --- Mes données --------------------------------------------------------------------------------------------------

const exporting = ref(false);

async function exportData(): Promise<void> {
  if (exporting.value) return;
  exporting.value = true;
  try {
    await treso.exportData();
  } finally {
    exporting.value = false;
  }
}

const fileInput = ref<HTMLInputElement | null>(null);
/** Fichier choisi, en attente de confirmation : tant qu’il est là, la boîte « Remplacer mes données » est ouverte. */
const pendingFile = ref<File | null>(null);
const importing = ref(false);

function pickFile(event: Event): void {
  pendingFile.value = (event.target as HTMLInputElement).files?.[0] ?? null;
}

function closeImport(): void {
  pendingFile.value = null;
  if (fileInput.value) fileInput.value.value = ''; // choisir de nouveau le même fichier doit rouvrir la boîte
}

async function confirmImport(): Promise<void> {
  const file = pendingFile.value;
  if (!file || importing.value) return;
  importing.value = true;
  const imported = await treso.importData(file);
  importing.value = false;
  closeImport(); // fermée dans tous les cas : le message (succès ou erreur) s’affiche sur la page, pas sous la boîte
  if (imported) syncIdentity();
}

// --- Session ------------------------------------------------------------------------------------------------------

const leaving = ref(false);

async function logout(): Promise<void> {
  if (leaving.value) return;
  leaving.value = true;
  try {
    await auth.logout();
    await navigateTo('/login');
  } finally {
    leaving.value = false;
  }
}

const deleteOpen = ref(false);
const deleting = ref(false);

async function deleteAccount(password?: string): Promise<void> {
  if (deleting.value) return;
  deleting.value = true;
  try {
    await auth.deleteAccount(password ?? '');
    deleteOpen.value = false;
    await navigateTo('/login');
  } catch (e) {
    deleteOpen.value = false; // le message s’affiche sur la page, pas sous la boîte
    toast.error(e instanceof ApiError ? e.message : 'Suppression impossible. Réessaie dans un instant.');
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div class="profile">
    <header v-if="!isDesktop" class="back">
      <NuxtLink to="/" class="back-link" aria-label="Retour à l’accueil"><AppIcon name="arrow-left" :size="22" /></NuxtLink>
      <span class="back-label">Accueil</span>
    </header>

    <section class="identity">
      <ProfileBadge size="xl" />
      <div class="who">
        <h1>{{ user?.firstName }}</h1>
        <span class="sm email">{{ user?.email }}</span>
        <AppBadge v-if="isAdmin" class="role" bg="var(--tip-bg)" fg="var(--tip-ink)">Administrateur</AppBadge>
      </div>
    </section>

    <section class="group">
      <h2>Mon compte</h2>
      <div class="card list">
        <label class="row">
          <span class="text"><span class="title">Société</span><span class="sm">Nom affiché dans l’app</span></span>
          <input v-model="company" class="control company" type="text" name="company" autocomplete="organization" maxlength="120" @change="saveCompany">
        </label>
        <div class="row">
          <span class="text"><span class="title">Solde du compte</span><span class="sm">À mettre à jour de temps en temps</span></span>
          <MoneyInput :key="balanceKey" class="control balance" :model-value="balance" label="Solde du compte" hide-label :step="10" @update:model-value="saveBalance" />
        </div>
      </div>
    </section>

    <section class="group">
      <h2>Sécurité</h2>
      <div class="card list">
        <div v-if="faceSupported" class="row">
          <span class="text"><span class="title">Face ID</span><span class="sm">Pour ouvrir l’app</span></span>
          <ToggleSwitch :model-value="auth.me?.hasPasskey ?? false" label="Face ID" hide-label @update:model-value="setFaceId" />
        </div>
        <button
          ref="passwordToggle"
          type="button"
          class="row action"
          :aria-expanded="passwordOpen"
          :aria-controls="passwordOpen ? passwordFormId : undefined"
          @click="togglePassword"
        >
          <span class="title">Changer de mot de passe</span>
          <AppIcon class="chevron" :class="{ 'is-open': passwordOpen }" name="chevron-right" :size="18" />
        </button>
        <form v-if="passwordOpen" :id="passwordFormId" class="password-form" novalidate @submit.prevent="submitPassword">
          <label class="field">Mot de passe actuel<input ref="currentInput" v-model="currentPassword" name="current-password" type="password" autocomplete="current-password" required></label>
          <label class="field">Nouveau mot de passe<input v-model="newPassword" name="new-password" type="password" autocomplete="new-password" :aria-describedby="passwordHintId" required></label>
          <span :id="passwordHintId" class="sm">8 caractères minimum. Les applications connectées (Claude Code…) seront déconnectées.</span>
          <p v-if="passwordError" class="error" role="alert">{{ passwordError }}</p>
          <div class="actions">
            <AppButton type="submit" variant="primary" :disabled="passwordBusy">Enregistrer</AppButton>
            <AppButton @click="closePassword">Annuler</AppButton>
          </div>
        </form>
        <button type="button" class="row action" :disabled="appsBusy" @click="appsOpen = true">
          <span class="text"><span class="title">Déconnecter les applications (Claude Code…)</span><span class="sm">Coupe l’accès des applications connectées à ton compte</span></span>
          <AppIcon class="chevron" name="chevron-right" :size="18" />
        </button>
      </div>
    </section>

    <section class="group">
      <h2>Alertes</h2>
      <div class="card list">
        <div v-for="item in ALERTS" :key="item.key" class="row">
          <span class="text"><span class="title">{{ item.label }}</span><span class="sm">{{ item.hint }}</span></span>
          <ToggleSwitch :model-value="alertOn(item.key)" :label="item.label" hide-label @update:model-value="setAlert(item.key, $event)" />
        </div>
      </div>
      <p class="sm note">Les notifications arrivent bientôt : tes préférences sont gardées.</p>
    </section>

    <section class="group">
      <h2>Mes données</h2>
      <div class="card list">
        <button type="button" class="row action" :disabled="exporting" @click="exportData">
          <span class="text"><span class="title">Exporter mes données</span><span class="sm">Tout télécharger en JSON</span></span>
          <AppIcon class="chevron" name="chevron-right" :size="18" />
        </button>
        <label class="row action file">
          <span class="text"><span class="title">Importer une sauvegarde</span><span class="sm">Reprendre une sauvegarde</span></span>
          <AppIcon class="chevron" name="chevron-right" :size="18" />
          <input ref="fileInput" class="visually-hidden" type="file" accept="application/json" @change="pickFile">
        </label>
      </div>
    </section>

    <AppButton block class="logout" :disabled="leaving" @click="logout">Se déconnecter</AppButton>
    <button type="button" class="delete" @click="deleteOpen = true">Supprimer mon compte</button>
    <p class="sm version">Ma Tréso · version 1.0</p>

    <ConfirmDialog
      :open="appsOpen"
      title="Déconnecter les applications&#160;?"
      message="Claude Code et les autres applications connectées à ton compte perdront leur accès. Elles devront te redemander l’autorisation pour s’y reconnecter."
      confirm-label="Déconnecter les applications"
      @confirm="revokeApps"
      @cancel="appsOpen = false"
    />
    <ConfirmDialog
      :open="pendingFile !== null"
      title="Remplacer tes données&#160;?"
      message="L’import remplace toutes tes données actuelles."
      confirm-label="Remplacer mes données"
      danger
      @confirm="confirmImport"
      @cancel="closeImport"
    />
    <ConfirmDialog
      :open="deleteOpen"
      title="Supprimer ton compte&#160;?"
      message="Ton compte et toutes tes données seront supprimés définitivement. Cette action est irréversible."
      confirm-label="Supprimer définitivement"
      danger
      with-password
      @confirm="deleteAccount"
      @cancel="deleteOpen = false"
    />
  </div>
</template>

<style scoped>
/* Colonne de la maquette mobile ; sur desktop, la même, plafonnée à 640 px. */
.profile { display: flex; flex-direction: column; gap: 18px; width: 100%; max-width: 640px; min-width: 0; }

/* Retour à l’accueil (mobile seulement : le profil s’ouvre depuis la pastille de l’en-tête). */
.back { display: flex; align-items: center; gap: 8px; }
.back-link { width: 44px; height: 44px; border-radius: var(--radius-pill); background: var(--surface); border: 1.5px solid var(--border); color: var(--ink); display: flex; align-items: center; justify-content: center; }
.back-link:hover { color: var(--ink); }
.back-label { font-weight: 700; }

.identity { display: flex; align-items: center; gap: 16px; }
.who { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
h1 { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.02em; overflow-wrap: anywhere; }
.email { font-size: 15px; overflow-wrap: anywhere; }
.role { align-self: flex-start; margin-top: 4px; }

.group { display: flex; flex-direction: column; gap: 8px; }
h2 { margin: 0 4px; font: 700 14px var(--font-text); color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
.list { padding: 4px 18px; min-width: 0; }
.text { display: flex; flex-direction: column; gap: 1px; min-width: 0; padding-right: 8px; }
.title { font-weight: 600; }
.note { margin: 0 4px; }

/* Champs posés dans une ligne : même gabarit que `.field input` (base.css), alignés à droite comme les valeurs de la maquette. */
.control { flex: 0 1 200px; min-width: 0; }
.company { min-height: 50px; padding: 0 16px; border-radius: 16px; border: 2px solid var(--field-border); font: 500 16px var(--font-text); color: var(--ink); background: var(--field-bg); text-align: right; }
.balance :deep(.wrap input) { text-align: right; font: 700 16px var(--font-display); }

/* Lignes à chevron : boutons (ou étiquette du sélecteur de fichier) qui ont l’allure des lignes de la maquette. */
.action { position: relative; width: 100%; min-height: 56px; border: 0; border-bottom: 1px solid var(--border-soft); background: transparent; font: inherit; color: inherit; text-align: left; cursor: pointer; }
.action:last-child { border-bottom: 0; }
.action:disabled { cursor: progress; opacity: .6; }
.file:has(:focus-visible) { outline: 3px solid var(--focus, var(--client-indigo)); outline-offset: 2px; border-radius: 12px; }
.chevron { flex: none; margin-left: auto; color: var(--muted); transition: transform .15s; }
.chevron.is-open { transform: rotate(90deg); }
@media (prefers-reduced-motion: reduce) { .chevron { transition: none; } }

.password-form { display: flex; flex-direction: column; gap: 14px; padding: 8px 0 18px; }
.error { margin: 0; padding: 12px 16px; border-radius: 16px; background: var(--danger-bg); color: var(--danger-ink); font-size: 15px; font-weight: 600; line-height: 1.4; }
.actions { display: flex; flex-wrap: wrap; gap: 12px; }

.logout { min-height: 54px; }
.delete { align-self: center; min-height: 44px; padding: 0 12px; border: 0; background: transparent; color: var(--danger); font: 600 15px var(--font-text); text-decoration: underline; cursor: pointer; }
.delete:hover { color: var(--danger-ink); }
.version { margin: 0; text-align: center; }
</style>
