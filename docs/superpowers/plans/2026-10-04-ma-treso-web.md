# Ma Tréso — Plan d'implémentation, Phases 3 et 4 : front (`apps/web`) et livraison

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Suite de `2026-10-04-ma-treso.md` et `2026-10-04-ma-treso-api.md`. Les sections **Global Constraints**, **Review Focus** et **Conventions de code** du premier fichier s'appliquent ici. Spec : `docs/superpowers/specs/2026-10-04-ma-treso-design.md` §5 et §6.

**Prérequis :** Phases 1 et 2 terminées. Aucun Docker : Playwright démarre l'API avec `apps/api/.env.e2e` (PGlite en mémoire, compte de démo semé) et Nuxt en dev.

## Comment porter une maquette

Les maquettes `design/ma-treso-design/ecrans/*.dc.html` sont la référence **visuelle et rédactionnelle**. Chaque fichier contient :
- un bloc `<style>` (lignes ~12 à 50) : les classes globales, reprises une fois pour toutes dans `base.css` (Task 21) ;
- le **balisage** (plages de lignes données dans chaque tâche), avec des styles en ligne et une syntaxe de template :
  - `{{x}}` est une interpolation ;
  - `<sc-for list="{{xs}}" as="x">` devient `v-for="x in xs"` ;
  - `<sc-if value="{{c}}">` devient `v-if="c"` ;
  - `onClick="{{fn}}"` devient `@click="fn"` ;
  - un fragment de style dynamique comme `style="…; {{v.st}}"` devient un `:style` ou une classe modificatrice ;
- un bloc `<script type="text/x-dc">` : logique de démo, données en dur et **textes dynamiques exacts**. Il sert de référence pour les libellés et les règles d'affichage. Les calculs, eux, viennent **toujours** du moteur via le store, jamais d'une recopie de ce script.

Règles de portage :
1. Mêmes textes, mêmes tailles, mêmes couleurs, mêmes rayons. Les styles en ligne statiques deviennent des classes en CSS `scoped`, avec les jetons de `tokens.css` (`var(--ink)`, etc.) à la place des hex quand un jeton existe.
2. Toute `font-family: 'Bricolage Grotesque'` devient `var(--font-display)`, et Figtree devient `var(--font-text)`.
3. Les liens `href="X.dc.html"` deviennent des `<NuxtLink>` vers les routes en anglais : Main → `/`, Clients → `/clients`, Calendrier → `/calendar`, Charges → `/expenses`, Profil → `/profile`.
4. Les SVG des maquettes vont dans `AppIcon` (Task 21), jamais dupliqués dans les pages.
5. Ne pas porter la fausse barre d'état de téléphone (heure, batterie) des maquettes mobiles.
6. Montants affichés via `format.ts` du moteur uniquement (`euros`, `eurosExact`, `kEuros`).

## Carte des fichiers (Phases 3 et 4)

```
apps/web/
  package.json · nuxt.config.ts · tsconfig.json · playwright.config.ts
  public/ favicon.svg · icons/ (icônes PWA)
  app/
    app.vue
    assets/css/ tokens.css · base.css
    utils/ palette.ts · labels.ts
    composables/ useApi.ts · useToast.ts · useBreakpoint.ts · useCompanyDashboard.ts · useMicroDashboard.ts
                 useClientsView.ts · useCalendarView.ts · useExpensesView.ts
    stores/ auth.ts · treso.ts
    middleware/ auth.global.ts
    layouts/ default.vue · auth.vue
    components/
      layout/ AppSidebar.vue · AppTabBar.vue · StatusSwitch.vue · BalanceField.vue
      icons/ AppIcon.vue
      ui/ AppButton.vue · SegmentedControl.vue · ChoiceChips.vue · ToggleSwitch.vue · TipBubble.vue · KpiCard.vue
          MoneyInput.vue · DateInput.vue · ListRow.vue · AppBadge.vue · MonthStepper.vue · ToastHost.vue
          ConfirmDialog.vue · EmptyState.vue · EstimateNote.vue
      charts/ ResultBars.vue · MiniBars.vue · MissionTimeline.vue · CeilingGauge.vue · StackedCashBars.vue
              LeaveImpactBars.vue · SplitBar.vue · SmoothedBars.vue
      dashboard/ CompanyDashboard.vue · CompanyDashboardMobile.vue · VerdictCard.vue · IncomeList.vue · ChargeList.vue
                 MicroDashboard.vue · MicroDashboardMobile.vue · SetAsideCard.vue · CeilingCard.vue
      clients/ ClientsDesktop.vue · MissionTable.vue · MissionPanel.vue · RateEditor.vue · InvoicePath.vue
               MissionsMobile.vue · WeekTemplate.vue · ClientCard.vue · MissionDetailMobile.vue
      calendar/ CalendarDesktop.vue · CalendarMobile.vue · MonthCalendar.vue · LeaveForm.vue · LeavePeriods.vue · MonthTable.vue
      expenses/ ExpensesDesktop.vue · ExpensesMobile.vue · RemunerationCard.vue · ChargesTable.vue · ChargeForm.vue
      profile/ ProfileView.vue
    pages/ index.vue · login.vue · clients/index.vue · clients/new.vue · clients/[id].vue · calendar.vue · expenses.vue · profile.vue
  e2e/ helpers.ts · auth.spec.ts · dashboard.spec.ts · micro.spec.ts · clients.spec.ts · calendar.spec.ts
       expenses.spec.ts · profile.spec.ts · mobile.spec.ts
Dockerfile · .dockerignore · docker-compose.yml (service app) · README.md
```

---

# Phase 3 — Front

### Task 21: Socle Nuxt (config, design tokens, `useApi`, auth store, middleware, layouts, Playwright)

**Files:**
- Create : `apps/web/{package.json,nuxt.config.ts,tsconfig.json,playwright.config.ts}`, `apps/web/app/app.vue`, `apps/web/app/assets/css/{tokens.css,base.css}`, `apps/web/app/utils/{palette.ts,labels.ts}`, `apps/web/app/composables/{useApi.ts,useToast.ts,useBreakpoint.ts}`, `apps/web/app/stores/auth.ts`, `apps/web/app/middleware/auth.global.ts`, `apps/web/app/layouts/{default.vue,auth.vue}`, `apps/web/app/components/layout/{AppSidebar.vue,AppTabBar.vue}`, `apps/web/app/components/icons/AppIcon.vue`, `apps/web/app/components/ui/ToastHost.vue`, pages provisoires `apps/web/app/pages/{index.vue,login.vue,clients/index.vue,calendar.vue,expenses.vue,profile.vue}`, `apps/web/e2e/{helpers.ts,shell.spec.ts}`, `apps/web/public/favicon.svg`

**Interfaces:**
- Consumes : `@matreso/engine` (types `MeDto`, `ApiErrorBody`, `ClientColor`, `MonthState`, `localToday`, `demoExportFile`).
- Produces :
  - `api<T>(path, { method?, body? }): Promise<T>` et `class ApiError { status; code; message }` (`useApi.ts`) ;
  - `useToast(): { toasts, show(message, tone?), error(message) }` ;
  - `useBreakpoint(): { isDesktop: Ref<boolean> }` (≥ 1024 px) ;
  - `useAuthStore()` : `me`, `ready`, `fetchMe()`, `login(email, password)`, `register(email, password, firstName)`, `logout()`, `loginWithPasskey()`, `enablePasskey()`, `disablePasskey()`, `changePassword(current, next)`, `deleteAccount(password)` ;
  - `PALETTE: Record<ClientColor, { base; fg; soft; label }>`, `STATE_STYLE: Record<MonthState, { bg; ink; badgeBg; badgeInk; label }>` ;
  - `<AppIcon name size? />` ;
  - layouts `default` (sidebar ou barre d'onglets) et `auth` ;
  - e2e : `freshAccount(page, opts?)`, `fr(text)`.

- [ ] **Step 1: Package et configuration**

`apps/web/package.json` :
```json
{
  "name": "@matreso/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "nuxt dev --port 3000",
    "build": "nuxt generate",
    "preview": "nuxt preview",
    "typecheck": "nuxt typecheck",
    "postinstall": "nuxt prepare",
    "test:e2e": "playwright test"
  }
}
```

Run :
```bash
export PATH="/c/Users/guill/AppData/Roaming/nvm/v24.14.0:$PATH"
npm i -w @matreso/web nuxt@^4 vue vue-router pinia @pinia/nuxt @fontsource-variable/bricolage-grotesque @fontsource-variable/figtree @simplewebauthn/browser @matreso/engine@*
npm i -D -w @matreso/web typescript@~5.9 vue-tsc @playwright/test
npx -w @matreso/web playwright install chromium
```

`apps/web/nuxt.config.ts` :
```ts
import { fileURLToPath } from 'node:url';

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  ssr: false,
  devtools: { enabled: false },
  modules: ['@pinia/nuxt'],
  components: [{ path: '~/components', pathPrefix: false }],
  alias: {
    '@matreso/engine': fileURLToPath(new URL('../../packages/engine/src/index.ts', import.meta.url)),
  },
  css: [
    '@fontsource-variable/bricolage-grotesque',
    '@fontsource-variable/figtree',
    '~/assets/css/tokens.css',
    '~/assets/css/base.css',
  ],
  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      title: 'Ma Tréso',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#1F1A2E' },
        { name: 'description', content: 'Ce mois-ci, avec tes rentrées et tes charges, est-ce que ça passe ?' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
  nitro: {
    devProxy: { '/api': { target: 'http://localhost:3001/api', changeOrigin: true } },
  },
  typescript: { strict: true },
});
```

`apps/web/tsconfig.json` :
```json
{ "extends": "./.nuxt/tsconfig.json" }
```

`apps/web/public/favicon.svg` : un carré arrondi jaune `#FFD84D` incliné de −6°, avec « GD » en `#1F1A2E` (repris du logo de la sidebar, `Main.dc.html` ligne 42).

- [ ] **Step 2: Design tokens et classes globales**

`app/assets/css/tokens.css` :
```css
:root {
  --bg: #FFF7EC;
  --surface: #FFFFFF;
  --border: #F0E6D6;
  --border-soft: #F5EEE3;
  --field-border: #E8DDCB;
  --field-bg: #FFFCF7;
  --ink: #1F1A2E;
  --ink-2: #4E4762;
  --ink-3: #3B3550;
  --muted: #6B6478;
  --muted-2: #9A93AC;
  --night-2: #2E2742;
  --night-hover: #342C4A;
  --on-night: #E9E5F5;
  --on-night-muted: #B9B2CC;
  --sun: #FFD84D;
  --tip-bg: #FFF4C2;
  --tip-ink: #4A3B00;
  --client-indigo: #4B4BE0;
  --client-orange: #FF8A3D;
  --client-violet: #9B6BFF;
  --client-green: #2E9E6A;
  --client-rose: #D9467A;
  --client-teal: #1F8FA6;
  --link: #4B4BE0;
  --link-hover: #3434B8;
  --income-ink: #3434B8;
  --positive-bg: #DDF3E5;
  --positive-ink: #12452A;
  --red-bg: #FFE6CF;
  --red-ink: #6E2E05;
  --danger-bg: #FBD2CE;
  --danger-ink: #7A1A13;
  --bar-up: #2E9E6A;
  --bar-down: #E5484D;
  --font-display: 'Bricolage Grotesque Variable', 'Bricolage Grotesque', Figtree, system-ui, sans-serif;
  --font-text: 'Figtree Variable', Figtree, 'Helvetica Neue', system-ui, sans-serif;
  --radius-card: 26px;
  --radius-verdict: 30px;
  --radius-pill: 999px;
  --shadow-card: 0 4px 0 rgba(31, 26, 46, .05);
  --page-pad: 44px;
  --gap-block: 28px;
}

@media (max-width: 1023.98px) {
  :root { --page-pad: 20px; --gap-block: 16px; }
}
```

`app/assets/css/base.css` : recopier **à l'identique** le bloc `<style>` de `Main.dc.html` (lignes 12 à 37), puis les règles propres au mobile de `Mobile-Accueil.dc.html` (lignes 39 à 49 : `.m-tab`, `.seg`, `.row`, `.sm`, `.mtip`, `.chip`), en remplaçant les hex par les jetons correspondants et les familles de polices par `var(--font-display)` / `var(--font-text)`. Ajouter :
```css
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--font-text); font-size: 16px; }
:focus-visible { outline: 3px solid var(--client-indigo); outline-offset: 2px; border-radius: 8px; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
button { font-family: inherit; }
```

`app/utils/palette.ts` :
```ts
import type { ClientColor, MonthState } from '@matreso/engine';

export const PALETTE: Readonly<Record<ClientColor, { base: string; fg: string; soft: string; label: string }>> = {
  indigo: { base: '#4B4BE0', fg: '#FFFFFF', soft: '#ECEBFF', label: 'Indigo' },
  orange: { base: '#FF8A3D', fg: '#1F1A2E', soft: '#FFEBDD', label: 'Orange' },
  violet: { base: '#9B6BFF', fg: '#FFFFFF', soft: '#F1EAFE', label: 'Violet' },
  green: { base: '#2E9E6A', fg: '#FFFFFF', soft: '#E3F5EA', label: 'Vert' },
  rose: { base: '#D9467A', fg: '#FFFFFF', soft: '#FCE4EE', label: 'Rose' },
  teal: { base: '#1F8FA6', fg: '#FFFFFF', soft: '#DDF1F5', label: 'Bleu canard' },
};

/** Couleurs des états d'un mois (SPEC §4.7, badges de Calendrier.dc.html). */
export const STATE_STYLE: Readonly<Record<MonthState, { bg: string; ink: string; badgeBg: string; badgeInk: string; label: string }>> = {
  POSITIVE: { bg: '#DDF3E5', ink: '#12452A', badgeBg: '#E7F6EC', badgeInk: '#1E6B3A', label: 'Positif' },
  RED: { bg: '#FFE6CF', ink: '#6E2E05', badgeBg: '#FFD0A8', badgeInk: '#6E2E05', label: 'Dans le rouge' },
  RED_DUE_TO_LEAVES: { bg: '#FFE6CF', ink: '#6E2E05', badgeBg: '#FFD0A8', badgeInk: '#6E2E05', label: 'Rouge à cause des vacances' },
  OVERDRAFT: { bg: '#FBD2CE', ink: '#7A1A13', badgeBg: '#B3261E', badgeInk: '#FFFFFF', label: 'Découvert' },
};

/** Couleur suivante libre pour un nouveau client. */
export function nextColor(used: readonly ClientColor[]): ClientColor {
  const order: ClientColor[] = ['indigo', 'orange', 'violet', 'green', 'rose', 'teal'];
  return order.find((c) => !used.includes(c)) ?? order[used.length % order.length]!;
}
```

`app/utils/labels.ts` :
```ts
export const WEEKDAY_LETTERS = ['L', 'M', 'M', 'J', 'V'] as const;
export const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'] as const;
export const WEEKDAY_LONG = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;

/** Initiales pour la pastille (« Gagnaire Développement » → « GD », sinon prénom → « G »). */
export function initials(companyName: string | null, firstName: string): string {
  const source = companyName?.trim() || firstName;
  return source.split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
}

export const ESTIMATE_NOTE = 'Estimation simplifiée, à affiner avec ton expert-comptable.';
```

- [ ] **Step 3: Composables**

`app/composables/useApi.ts` :
```ts
import type { ApiErrorBody } from '@matreso/engine';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const FALLBACK = 'Une erreur est survenue. Réessaie dans un instant.';

/** Appel JSON vers /api. Les mutations envoient toujours un corps JSON (protection CSRF côté API). */
export async function api<T>(path: string, init: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown } = {}): Promise<T> {
  const method = init.method ?? 'GET';
  const hasBody = method !== 'GET';
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: hasBody ? { 'Content-Type': 'application/json' } : {},
      body: hasBody ? JSON.stringify(init.body ?? {}) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Connexion impossible. Vérifie ton réseau.');
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as (ApiErrorBody & T) | null;
  if (!res.ok) throw new ApiError(res.status, data?.code ?? 'UNKNOWN', data?.message ?? FALLBACK);
  return data as T;
}
```

`app/composables/useToast.ts` :
```ts
export interface Toast { id: number; message: string; tone: 'info' | 'error' }

const toasts = ref<Toast[]>([]);
let seq = 0;

export function useToast() {
  const show = (message: string, tone: Toast['tone'] = 'info') => {
    const id = ++seq;
    toasts.value.push({ id, message, tone });
    setTimeout(() => { toasts.value = toasts.value.filter((t) => t.id !== id); }, 5000);
  };
  return { toasts, show, error: (message: string) => show(message, 'error') };
}
```

`app/composables/useBreakpoint.ts` :
```ts
const query = '(min-width: 1024px)';
const isDesktop = ref(typeof window !== 'undefined' ? window.matchMedia(query).matches : true);
let bound = false;

export function useBreakpoint() {
  if (!bound && typeof window !== 'undefined') {
    bound = true;
    window.matchMedia(query).addEventListener('change', (e) => { isDesktop.value = e.matches; });
  }
  return { isDesktop };
}
```

- [ ] **Step 4: Store d'auth et middleware**

`app/stores/auth.ts` :
```ts
import type { MeDto } from '@matreso/engine';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', () => {
  const me = ref<MeDto | null>(null);
  const ready = ref(false);

  async function fetchMe(): Promise<MeDto | null> {
    try {
      me.value = await api<MeDto>('/auth/me');
    } catch {
      me.value = null;
    }
    ready.value = true;
    return me.value;
  }

  async function login(email: string, password: string) {
    me.value = await api<MeDto>('/auth/login', { method: 'POST', body: { email, password } });
  }

  async function register(email: string, password: string, firstName: string) {
    me.value = await api<MeDto>('/auth/register', { method: 'POST', body: { email, password, firstName } });
  }

  async function loginWithPasskey() {
    const optionsJSON = await api<Parameters<typeof startAuthentication>[0]['optionsJSON']>('/auth/passkeys/login/options', { method: 'POST' });
    const response = await startAuthentication({ optionsJSON });
    me.value = await api<MeDto>('/auth/passkeys/login/verify', { method: 'POST', body: response });
  }

  async function enablePasskey() {
    const optionsJSON = await api<Parameters<typeof startRegistration>[0]['optionsJSON']>('/auth/passkeys/register/options', { method: 'POST' });
    const response = await startRegistration({ optionsJSON });
    me.value = await api<MeDto>('/auth/passkeys/register/verify', { method: 'POST', body: response });
  }

  async function disablePasskey() {
    await api('/auth/passkeys', { method: 'DELETE' });
    if (me.value) me.value = { ...me.value, hasPasskey: false };
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    await api('/auth/password', { method: 'PATCH', body: { currentPassword, newPassword } });
  }

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    me.value = null;
    useTresoStore().reset();
  }

  async function deleteAccount(password: string) {
    await api('/account', { method: 'DELETE', body: { password } });
    me.value = null;
    useTresoStore().reset();
  }

  return { me, ready, fetchMe, login, register, loginWithPasskey, enablePasskey, disablePasskey, changePassword, logout, deleteAccount };
});
```
(`useTresoStore` est créé en Task 24. D'ici là, créer `app/stores/treso.ts` avec un store minimal `defineStore('treso', () => ({ reset: () => {} }))`, que la Task 24 remplacera.)

`app/middleware/auth.global.ts` :
```ts
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore();
  if (!auth.ready) await auth.fetchMe();
  const isLogin = to.path === '/login';
  if (!auth.me && !isLogin) return navigateTo('/login');
  if (auth.me && isLogin) return navigateTo('/');
});
```

- [ ] **Step 5: Coquille (icônes, layouts, toasts, pages provisoires)**

`app/components/icons/AppIcon.vue` : composant `props: { name: IconName; size?: number }` qui rend un `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` dont les éléments enfants viennent d'une table `ICONS: Record<IconName, string>` (contenu SVG brut, rendu via `v-html` sur un `<g>`). Les icônes sont copiées des maquettes :

| Nom | Où la trouver |
| --- | --- |
| `dashboard`, `clients`, `calendar`, `receipt` | `Main.dc.html` lignes 46 à 49 (liens de la sidebar) |
| `chevron-left`, `chevron-right` | `Main.dc.html` lignes 69 et 71 (flèches de mois) |
| `bulb` | `Main.dc.html` ligne 117 (bulle « Pourquoi… ») |
| `home`, `briefcase`, `sun`, `wallet` | onglets de `Mobile-Accueil.dc.html` ligne 94 |
| `trash`, `plus`, `eye`, `eye-off`, `face-id`, `lock`, `bell`, `download`, `upload`, `logout`, `arrow-left` | `Clients.dc.html`, `Mobile-Connexion.dc.html`, `Mobile-Profil.dc.html`, `Mobile-Client.dc.html` (chercher `<svg` dans chaque fichier) |
| icônes de catégories de charges (`Toi`, `Social`, `Impôts`, `Véhicule`, `Services`, `Outils`, `Banque`, `Assurance`, `Autre`) | `Charges.dc.html` et `Mobile-Charges.dc.html` (tuiles d'icônes des lignes du tableau) |

Une icône absente des maquettes se dessine dans le même style : trait de 2 px, bouts arrondis, grille de 24.

`app/components/layout/AppSidebar.vue` : porter l'`<aside>` de `Main.dc.html` (lignes 40 à 56).
- Logo : la pastille porte `initials(companyName, firstName)`, avec sous le nom « Ma Tréso » le `companyName` (ou le prénom s'il n'y en a pas).
- Navigation : 4 `<NuxtLink>` avec la classe `on` et `aria-current="page"` sur la route active (`/` exacte, `/clients*`, `/calendar`, `/expenses`).
- Encart « Sur le compte » : affiche `euros(balance.latest.amount)` et « Mis à jour le {shortDate} {année} ». Avant la Task 24, il affiche « — ». Au clic, l'encart mène à `/`.
- En bas : un lien vers `/profile` avec la pastille d'initiales et le prénom (cible ≥ 44 px).
- Largeur fixe de 260 px, `position: sticky; top: 0; height: 100vh`.

`app/components/layout/AppTabBar.vue` : porter le `<nav>` de `Mobile-Accueil.dc.html` (ligne 94).
- 4 onglets `.m-tab` : Accueil → `/`, Missions → `/clients`, Congés → `/calendar`, Charges → `/expenses`.
- `position: fixed; bottom: 0; left: 0; right: 0`, rayons `26px 26px 0 0`, `padding-bottom: calc(10px + env(safe-area-inset-bottom))`.

`app/layouts/default.vue` :
```vue
<script setup lang="ts">
const { isDesktop } = useBreakpoint();
</script>

<template>
  <div class="shell" :class="{ desktop: isDesktop }">
    <AppSidebar v-if="isDesktop" />
    <main class="content">
      <div class="inner"><slot /></div>
    </main>
    <AppTabBar v-if="!isDesktop" />
  </div>
</template>

<style scoped>
.shell { min-height: 100vh; }
.shell.desktop { display: flex; }
.content { flex: 1; min-width: 0; padding: 40px var(--page-pad) 64px; }
.inner { max-width: 1180px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--gap-block); }
.shell:not(.desktop) .content { padding: calc(16px + env(safe-area-inset-top)) var(--page-pad) calc(96px + env(safe-area-inset-bottom)); }
</style>
```

`app/layouts/auth.vue` : fond crème, contenu centré, largeur max 440 px, marges de sécurité.

`app/components/ui/ToastHost.vue` : liste fixe en bas, au-dessus de la barre d'onglets sur mobile, avec `role="status"` et `aria-live="polite"`. Fond `--ink` pour `info`, `--danger-bg`/`--danger-ink` pour `error`, rayon 18 px.

`app/app.vue` :
```vue
<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <ToastHost />
</template>
```

Pages provisoires : `index.vue`, `clients/index.vue`, `calendar.vue`, `expenses.vue`, `profile.vue` affichent un `<h1>` (« Tableau de bord », « Tes clients », « Tes vacances, ta tréso », « Tes charges », « Profil »). `login.vue` utilise `definePageMeta({ layout: 'auth' })` et un formulaire minimal (e-mail, mot de passe, bouton « Se connecter » qui appelle `auth.login` puis `navigateTo('/')`), remplacé en Task 23.

- [ ] **Step 6: Playwright**

`apps/web/playwright.config.ts` :
```ts
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL, locale: 'fr-FR', timezoneId: 'Europe/Paris', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        { command: 'npm run dev:e2e -w @matreso/api', cwd: '../..', url: 'http://localhost:3001/api/health', reuseExistingServer: true, timeout: 120_000 },
        { command: 'npm run dev -w @matreso/web', cwd: '../..', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 180_000 },
      ],
});
```

`apps/web/e2e/helpers.ts` :
```ts
import { demoExportFile, type ExportFileV1 } from '@matreso/engine';
import type { Page } from '@playwright/test';

/** Typographie FR des montants : « −2 310 € » avec U+202F et U+00A0. */
export const fr = (text: string): string => text.replace(/(\d) (\d)/g, '$1 $2').replace(/ €/g, ' €');

/** Compte neuf et isolé, avec les données de démo (ou un fichier fourni), date figée au 4 octobre 2026. */
export async function freshAccount(page: Page, opts: { file?: ExportFileV1 | null; firstName?: string } = {}): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@matreso.test`;
  await page.clock.setFixedTime(new Date('2026-10-04T10:00:00'));
  const res = await page.request.post('/api/auth/register', { data: { email, password: 'motdepasse1', firstName: opts.firstName ?? 'Guillaume' } });
  if (!res.ok()) throw new Error(`register failed: ${res.status()}`);
  const file = opts.file === undefined ? demoExportFile() : opts.file;
  if (file) {
    const imported = await page.request.post('/api/import', { data: file });
    if (!imported.ok()) throw new Error(`import failed: ${imported.status()}`);
  }
  await page.goto('/');
  return email;
}
```

`apps/web/e2e/shell.spec.ts` :
```ts
import { expect, test } from '@playwright/test';
import { freshAccount } from './helpers';

test('redirects to /login without a session', async ({ page }) => {
  await page.goto('/expenses');
  await expect(page).toHaveURL(/\/login$/);
});

test('navigates between the four sections', async ({ page, isMobile }) => {
  await freshAccount(page);
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await nav.getByRole('link', { name: isMobile ? 'Charges' : 'Charges' }).click();
  await expect(page).toHaveURL(/\/expenses$/);
  await nav.getByRole('link', { name: isMobile ? 'Missions' : 'Clients & missions' }).click();
  await expect(page).toHaveURL(/\/clients$/);
});
```

- [ ] **Step 7: Vérifier**

Run : `npm run test:e2e -w @matreso/web -- shell.spec.ts`
Expected : 4 tests PASS (2 tests × 2 projets). Le premier lancement démarre l'API (PGlite en mémoire) et Nuxt.
Run : `npm run typecheck -w @matreso/web && npm run build -w @matreso/web`
Expected : OK, `apps/web/.output/public/index.html` généré.

- [ ] **Step 8: Commit**

```bash
git add apps/web package.json package-lock.json
git commit -m "feat(web): socle Nuxt (tokens, auth, layouts sidebar et onglets, Playwright)"
```

### Task 22: Kit UI

**Files:**
- Create : `apps/web/app/components/ui/{AppButton,SegmentedControl,ChoiceChips,ToggleSwitch,TipBubble,KpiCard,MoneyInput,DateInput,ListRow,AppBadge,MonthStepper,ConfirmDialog,EmptyState,EstimateNote}.vue`, page de démonstration `apps/web/app/pages/dev/ui.vue` (accessible seulement en dev), `apps/web/e2e/ui.spec.ts`

**Interfaces (props / émissions, à respecter à la lettre : les écrans s'appuient dessus) :**

| Composant | Props | Émissions / slots | Rendu (source) |
| --- | --- | --- | --- |
| `AppButton` | `variant?: 'primary' \| 'secondary' \| 'ghost'` (défaut `secondary`), `type?: 'button' \| 'submit'`, `disabled?`, `block?`, `ariaLabel?` | slot par défaut, `click` | classes `.btn` / `.btn.pri` ; 50 px de haut |
| `SegmentedControl<T>` | `modelValue: T`, `options: { value: T; label: string }[]`, `ariaLabel: string` | `update:modelValue` | rail `.seg` ; boutons avec `aria-pressed` ; actif en fond `--ink` |
| `ChoiceChips<T>` | `modelValue: T \| T[]`, `options: { value: T; label: string; ariaLabel?: string; color?: { bg: string; fg: string } }[]`, `multiple?: boolean`, `ariaLabel: string` | `update:modelValue` | `.chip` ; bordure 2 px ; actif en fond `--ink` ou `color.bg` ; `aria-pressed` ; ≥ 44 × 44 |
| `ToggleSwitch` | `modelValue: boolean`, `label: string`, `hideLabel?` | `update:modelValue` | `<button role="switch" :aria-checked>` 56 × 34, actif `--client-indigo` |
| `TipBubble` | `title: string`, `compact?` (version mobile `.mtip`) | slot texte | `.tip`, tuile jaune 44 px avec `AppIcon name="bulb"` (`Main.dc.html` l. 117) |
| `KpiCard` | `label`, `value`, `sub?`, `tone?: 'neutral' \| 'positive' \| 'warn' \| 'danger' \| 'info'`, `valueColor?` | — | carte teintée sans bordure (KPI de `Calendrier.dc.html` l. 64 à 70) |
| `MoneyInput` | `modelValue: number \| null` (centimes), `label`, `min?`, `max?`, `step?` (euros, défaut 1), `hideLabel?` | `update:modelValue` (centimes, au `change`) | `.field` ; `type="number" inputmode="decimal"` ; suffixe « € » |
| `DateInput` | `modelValue: string \| null`, `label`, `min?`, `max?` | `update:modelValue` | `.field` ; `type="date"` |
| `ListRow` | `title`, `subtitle?`, `amount?`, `amountTone?: 'income' \| 'charge' \| 'neutral'`, `barColor?` | slots `icon`, `extra` | ligne de liste (`Main.dc.html` l. 89 à 91) |
| `AppBadge` | `bg`, `fg` | slot | pastille 999 px, 13 à 14 px, gras |
| `MonthStepper` | `label: string`, `canPrev: boolean`, `canNext: boolean`, `size?: 'lg' \| 'sm'` | `prev`, `next` | flèches et mois (`Main.dc.html` l. 68 à 72) ; `aria-label` « Mois précédent » / « Mois suivant » |
| `ConfirmDialog` | `open: boolean`, `title`, `message`, `confirmLabel`, `danger?`, `withPassword?` | `confirm(password?: string)`, `cancel` | `<dialog>` natif, focus piégé, Échap = annuler |
| `EmptyState` | `title`, `text` | slot `action` | carte crème, texte `--muted` |
| `EstimateNote` | — | — | `<p class="sm">` avec `ESTIMATE_NOTE` |

- [ ] **Step 1: Écrire le test e2e du kit**

`e2e/ui.spec.ts` (la page `/dev/ui` montre chaque composant avec un état observable) :
```ts
import { expect, test } from '@playwright/test';
import { freshAccount } from './helpers';

test.beforeEach(async ({ page }) => {
  await freshAccount(page, { file: null });
  await page.goto('/dev/ui');
});

test('segmented control and chips expose aria-pressed', async ({ page }) => {
  const seg = page.getByRole('group', { name: 'Démo segment' });
  await seg.getByRole('button', { name: 'Micro-entreprise' }).click();
  await expect(seg.getByRole('button', { name: 'Micro-entreprise' })).toHaveAttribute('aria-pressed', 'true');
  const chips = page.getByRole('group', { name: 'Démo jours' });
  await chips.getByRole('button', { name: 'mercredi' }).click();
  await expect(chips.getByRole('button', { name: 'mercredi' })).toHaveAttribute('aria-pressed', 'true');
});

test('switch toggles aria-checked', async ({ page }) => {
  const sw = page.getByRole('switch', { name: 'Démo interrupteur' });
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
});

test('money input emits cents', async ({ page }) => {
  await page.getByLabel('Démo montant').fill('1234,5');
  await page.getByLabel('Démo montant').blur();
  await expect(page.getByTestId('money-value')).toHaveText('123450');
});

test('targets are at least 44 px', async ({ page }) => {
  for (const el of await page.locator('button:visible, [role="switch"]:visible').all()) {
    const box = await el.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
});
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm run test:e2e -w @matreso/web -- ui.spec.ts`
Expected : FAIL (page inexistante).

- [ ] **Step 3: Implémenter les composants**

Implémenter chaque composant selon le tableau. Exemples de référence pour les deux composants à logique :

`ToggleSwitch.vue` :
```vue
<script setup lang="ts">
defineProps<{ label: string; hideLabel?: boolean }>();
const model = defineModel<boolean>({ required: true });
</script>

<template>
  <label class="switch-row">
    <span :class="{ 'visually-hidden': hideLabel }">{{ label }}</span>
    <button type="button" role="switch" :aria-checked="model" :aria-label="label" class="switch" :class="{ on: model }" @click="model = !model">
      <span class="track"><span class="knob" /></span>
    </button>
  </label>
</template>

<style scoped>
.switch-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; font-weight: 600; }
/* Zone tactile 56 × 44, piste visuelle 56 × 34 (SPEC §7.4) */
.switch { display: flex; align-items: center; width: 56px; min-width: 56px; height: 44px; padding: 0; border: 0; background: transparent; cursor: pointer; }
.track { position: relative; width: 56px; height: 34px; border-radius: 999px; background: var(--field-border); transition: background .15s; }
.switch.on .track { background: var(--client-indigo); }
.knob { position: absolute; top: 4px; left: 4px; width: 26px; height: 26px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.2); transition: transform .15s; }
.switch.on .knob { transform: translateX(22px); }
@media (prefers-reduced-motion: reduce) { .track, .knob { transition: none; } }
</style>
```

`MoneyInput.vue` :
```vue
<script setup lang="ts">
const props = withDefaults(defineProps<{ label: string; min?: number; max?: number; step?: number; hideLabel?: boolean }>(), { step: 1 });
const model = defineModel<number | null>({ required: true });
const text = ref(model.value === null ? '' : String(model.value / 100).replace('.', ','));
watch(model, (v) => { text.value = v === null ? '' : String(v / 100).replace('.', ','); });

function commit() {
  const normalized = text.value.replace(/\s/g, '').replace(',', '.');
  if (normalized === '') { model.value = null; return; }
  const euros = Number(normalized);
  if (Number.isNaN(euros)) { text.value = model.value === null ? '' : String(model.value / 100).replace('.', ','); return; }
  const bounded = Math.min(props.max ?? Infinity, Math.max(props.min ?? -Infinity, euros));
  model.value = Math.round(bounded * 100);
}
</script>

<template>
  <label class="field">
    <span :class="{ 'visually-hidden': hideLabel }">{{ label }}</span>
    <span class="wrap">
      <input v-model="text" type="text" inputmode="decimal" :aria-label="label" @change="commit" @blur="commit" @keydown.enter="commit">
      <span class="suffix" aria-hidden="true">€</span>
    </span>
  </label>
</template>

<style scoped>
.wrap { position: relative; display: flex; }
.wrap input { flex: 1; padding-right: 36px; min-width: 0; }
.suffix { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); color: var(--muted); font-weight: 600; }
</style>
```
(`type="text" inputmode="decimal"` plutôt que `type="number"` pour accepter la virgule française.)

`pages/dev/ui.vue` : `definePageMeta({ middleware: [() => { if (!import.meta.dev) return navigateTo('/') }] })`, puis un `SegmentedControl` « Démo segment » (Société / Micro-entreprise), des `ChoiceChips` multiples « Démo jours » (lundi à vendredi), un `ToggleSwitch` « Démo interrupteur », un `MoneyInput` « Démo montant » dont la valeur est affichée dans `<output data-testid="money-value">`, et un exemplaire de chaque autre composant.

- [ ] **Step 4: Vérifier, puis commit**

Run : `npm run test:e2e -w @matreso/web -- ui.spec.ts`
Expected : PASS sur les deux projets.
```bash
git add apps/web
git commit -m "feat(web): kit UI accessible (boutons, pastilles, interrupteur, montants, bulles)"
```

### Task 23: Page `/login`

**Files:**
- Modify : `apps/web/app/pages/login.vue` (version complète)
- Create : `apps/web/e2e/auth.spec.ts`

**Interfaces:**
- Consumes : `useAuthStore().{login, register, loginWithPasskey}`, `AppButton`, `SegmentedControl`, `ApiError`.
- Produces : écran de connexion, porté de `Mobile-Connexion.dc.html` (balisage l. 51 à 78, logique l. 79 à 98).

- [ ] **Step 1: Écrire le test e2e**

```ts
import { expect, test } from '@playwright/test';
import { freshAccount } from './helpers';

test('creates an account and lands on the dashboard', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-04T10:00:00'));
  await page.goto('/login');
  await page.getByRole('button', { name: 'Créer un compte' }).first().click();
  await page.getByLabel('Prénom').fill('Camille');
  await page.getByLabel('E-mail').fill(`camille-${Date.now()}@matreso.test`);
  await page.getByLabel('Mot de passe', { exact: true }).fill('motdepasse1');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: /Ce mois-ci, ça passe/ })).toBeVisible();
});

test('shows the API error on wrong credentials', async ({ page }) => {
  const email = await freshAccount(page, { file: null });
  await page.request.post('/api/auth/logout', { data: {} });
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill('mauvais-mot-de-passe');
  await page.getByRole('button', { name: 'Se connecter' }).last().click();
  await expect(page.getByRole('alert')).toHaveText('E-mail ou mot de passe incorrect.');
});

test('toggles password visibility and announces the unavailable reset', async ({ page }) => {
  await page.goto('/login');
  const pwd = page.getByLabel('Mot de passe', { exact: true });
  await expect(pwd).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Afficher le mot de passe' }).click();
  await expect(pwd).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Mot de passe oublié ?' }).click();
  await expect(page.getByRole('status')).toContainText('Bientôt disponible');
});
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm run test:e2e -w @matreso/web -- auth.spec.ts`
Expected : FAIL.

- [ ] **Step 3: Implémenter**

Porter `Mobile-Connexion.dc.html` à l'identique :
- logo GD incliné ;
- titre `{{title}}` (« Content de te revoir » ou « Bienvenue », voir le script l. 79 à 98) ;
- bascule `SegmentedControl` Se connecter / Créer un compte, avec `ariaLabel` « Mode » ;
- champ Prénom affiché seulement à l'inscription ;
- E-mail (`type="email" autocomplete="email"`) ;
- mot de passe (`autocomplete="current-password"` ou `"new-password"`), avec un bouton œil (`aria-label` « Afficher le mot de passe » / « Masquer le mot de passe ») ;
- lien « Mot de passe oublié ? », qui est un `<button>` montrant un toast « Bientôt disponible : écris-nous en attendant. » ;
- bouton principal « Se connecter » ou « Créer mon compte » ;
- séparateur, puis bouton secondaire « Se connecter avec Face ID », qui appelle `auth.loginWithPasskey()` et n'est affiché que si `window.PublicKeyCredential` existe ;
- **ne pas** afficher le bouton de lien magique de la maquette (hors périmètre) ;
- mention de confidentialité en bas.

Erreurs : `ApiError.message` dans un `<p role="alert">` au-dessus du bouton principal. Une erreur passkey (`NotAllowedError`, annulation) affiche « Connexion par Face ID annulée. ». Pendant l'envoi, le bouton est désactivé et le libellé passe à « Un instant… ». Après succès : `navigateTo('/')`.

Sur desktop (layout `auth`), la même colonne est centrée dans une carte `.card` de 440 px.

- [ ] **Step 4: Vérifier, puis commit**

Run : `npm run test:e2e -w @matreso/web -- auth.spec.ts`
Expected : PASS.
```bash
git add apps/web
git commit -m "feat(web): écran de connexion et d'inscription avec passkey"
```

### Task 24: Store `treso` (données, moteur, mutations optimistes)

**Files:**
- Modify : `apps/web/app/stores/treso.ts` (version complète)
- Create : `apps/web/e2e/store.spec.ts`

**Interfaces:**
- Consumes : `api`, `ApiError`, `useToast`, fonctions du moteur (`monthResults`, `resultsSummary`, `groupLeaves`, `cycleWeekday`, `leavesCost`, `localToday`, `monthKey`, `matchesTarget`, types et contrats).
- Produces : `useTresoStore()` avec :
  - état : `data: StateDto | null`, `today: ISODate`, `status: 'idle' | 'loading' | 'ready' | 'error'` ;
  - getters : `input: EngineInput | null`, `profile`, `clients` (non archivés, triés par position), `allClients`, `clientById(id)`, `isMicro`, `results: MonthResult[]`, `summary: ResultsSummary`, `leavePeriods: LeavePeriod[]`, `currentMonth`, `balance` (`BalanceSnapshotDto | null`) ;
  - actions : `ensureLoaded()`, `load()`, `reset()`, `updateProfile(patch)`, `setCompanyMode(mode: 'COMPANY' | 'MICRO')`, `setBalance(amount)`, `createClient(input): Promise<Client | null>`, `updateClient(id, patch)`, `deleteClient(id)`, `addRate(clientId, rate)`, `deleteRate(clientId, rateId)`, `addLeaves(input): Promise<{ created: number; cost: Cents } | null>`, `deleteLeaves(ids)`, `toggleLeave(date, target)`, `cycleWeekday(weekday)`, `addCharge(input)`, `updateCharge(id, patch)`, `deleteCharge(id)`, `exportData()`, `importData(file: File)`.

- [ ] **Step 1: Écrire le test e2e** (vérifie le chargement, une mutation optimiste et le rollback)

`e2e/store.spec.ts` :
```ts
import { expect, test } from '@playwright/test';
import { freshAccount } from './helpers';

test('loads the state once and exposes engine results', async ({ page }) => {
  await freshAccount(page);
  const result = await page.evaluate(() => {
    const store = (window as unknown as { __treso: { results: Array<{ result: number; balance: number }> } }).__treso;
    return { first: store.results[0]?.result, balance: store.results[0]?.balance, count: store.results.length };
  });
  expect(result).toEqual({ first: -231_400, balance: 4_600_600, count: 15 });
});

test('rolls back by reloading when the API refuses a mutation', async ({ page }) => {
  await freshAccount(page);
  const outcome = await page.evaluate(async () => {
    const store = (window as unknown as { __treso: { addLeaves: (i: unknown) => Promise<unknown>; data: { leaves: unknown[] } } }).__treso;
    const before = store.data.leaves.length;
    const res = await store.addLeaves({ from: '2026-12-26', scope: 'ALL' }); // samedi → 422
    return { res, before, after: store.data.leaves.length };
  });
  expect(outcome.res).toBeNull();
  expect(outcome.after).toBe(outcome.before);
  await expect(page.getByRole('status')).toContainText('Ce jour n’est pas ouvré');
});
```
(Le store s'expose sur `window.__treso` **uniquement** si `import.meta.dev` ou si `useRuntimeConfig().public.e2e` vaut vrai. En pratique, ajouter `runtimeConfig: { public: { e2e: process.env.NUXT_PUBLIC_E2E === 'true' } }` dans `nuxt.config.ts` ; le serveur de dev Playwright tourne avec `import.meta.dev` vrai.)

- [ ] **Step 2: Vérifier l'échec**

Run : `npm run test:e2e -w @matreso/web -- store.spec.ts`
Expected : FAIL.

- [ ] **Step 3: Implémenter**

`app/stores/treso.ts` :
```ts
import {
  type BalanceSnapshotDto, type Cents, type Client, type ClientInput, type ClientPatch, type ChargeInput, type ChargePatch,
  cycleWeekday as engineCycleWeekday, type EngineInput, groupLeaves, type ISODate, type LeaveDto, type LeavesInput,
  leavesCost, type LeaveTarget, localToday, matchesTarget, monthKey, monthResults, type ProfilePatch, type RateInput,
  resultsSummary, type StateDto, type UserProfileDto,
} from '@matreso/engine';
import { defineStore } from 'pinia';

type ChargeDto = StateDto['charges'][number];
const LAST_COMPANY_STATUS = 'matreso:lastCompanyStatus';
const tmpId = () => `tmp-${crypto.randomUUID()}`;

export const useTresoStore = defineStore('treso', () => {
  const data = ref<StateDto | null>(null);
  const today = ref<ISODate>(localToday());
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const toast = useToast();

  const input = computed<EngineInput | null>(() =>
    data.value
      ? { today: today.value, profile: data.value.profile, clients: data.value.clients, leaves: data.value.leaves, charges: data.value.charges, balance: data.value.balance.latest }
      : null,
  );
  const profile = computed<UserProfileDto | null>(() => data.value?.profile ?? null);
  const allClients = computed<Client[]>(() => data.value?.clients ?? []);
  const clients = computed<Client[]>(() => allClients.value.filter((c) => c.archivedAt === null));
  const clientById = (id: string | null | undefined): Client | undefined => allClients.value.find((c) => c.id === id);
  const isMicro = computed(() => profile.value?.legalStatus === 'MICRO');
  const results = computed(() => (input.value ? monthResults(input.value) : []));
  const summary = computed(() => resultsSummary(results.value));
  const leavePeriods = computed(() => (input.value ? groupLeaves(input.value) : []));
  const currentMonth = computed(() => monthKey(today.value));
  const balance = computed<BalanceSnapshotDto | null>(() => data.value?.balance.latest ?? null);

  async function load(): Promise<void> {
    status.value = 'loading';
    try {
      data.value = await api<StateDto>('/state');
      today.value = localToday();
      status.value = 'ready';
    } catch (e) {
      status.value = 'error';
      toast.error(e instanceof ApiError ? e.message : 'Impossible de charger tes données.');
    }
  }

  async function ensureLoaded(): Promise<void> {
    if (status.value === 'idle' || status.value === 'error') await load();
  }

  function reset(): void {
    data.value = null;
    status.value = 'idle';
  }

  /** Applique localement, appelle l'API, réconcilie ; en cas d'échec : message, puis rechargement depuis le serveur. */
  async function mutate<T>(apply: (s: StateDto) => void, call: () => Promise<T>, reconcile?: (s: StateDto, res: T) => void): Promise<T | null> {
    if (!data.value) return null;
    apply(data.value);
    try {
      const res = await call();
      if (reconcile && data.value) reconcile(data.value, res);
      return res;
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Impossible d’enregistrer. Réessaie.');
      await load();
      return null;
    }
  }

  const replaceClient = (s: StateDto, client: Client, oldId = client.id) => {
    const i = s.clients.findIndex((c) => c.id === oldId);
    if (i >= 0) s.clients[i] = client;
    else s.clients.push(client);
  };

  const updateProfile = (patch: ProfilePatch) =>
    mutate((s) => { s.profile = { ...s.profile, ...patch }; }, () => api<UserProfileDto>('/profile', { method: 'PATCH', body: patch }), (s, p) => { s.profile = p; });

  function setCompanyMode(mode: 'COMPANY' | 'MICRO') {
    const current = profile.value?.legalStatus;
    if (mode === 'MICRO') {
      if (current && current !== 'MICRO') localStorage.setItem(LAST_COMPANY_STATUS, current);
      return updateProfile({ legalStatus: 'MICRO' });
    }
    const last = localStorage.getItem(LAST_COMPANY_STATUS) as UserProfileDto['legalStatus'] | null;
    return updateProfile({ legalStatus: last && last !== 'MICRO' ? last : 'SASU' });
  }

  const setBalance = (amount: Cents) => {
    const optimistic: BalanceSnapshotDto = { id: tmpId(), date: localToday(), amount };
    return mutate(
      (s) => { s.balance = { latest: optimistic, history: [optimistic, ...s.balance.history] }; },
      () => api<BalanceSnapshotDto>('/balance', { method: 'POST', body: { amount } }),
      (s, snap) => { s.balance = { latest: snap, history: [snap, ...s.balance.history.filter((b) => b.id !== optimistic.id)] }; },
    );
  };

  const createClient = async (body: ClientInput): Promise<Client | null> => {
    const id = tmpId();
    const { rate, ...fields } = body;
    return mutate(
      (s) => { s.clients.push({ ...fields, id, archivedAt: null, rates: [rate] }); },
      () => api<Client>('/clients', { method: 'POST', body }),
      (s, created) => replaceClient(s, created, id),
    );
  };

  const updateClient = (id: string, patch: ClientPatch) =>
    mutate(
      (s) => {
        const c = s.clients.find((x) => x.id === id);
        if (!c) return;
        const { archived, ...fields } = patch;
        Object.assign(c, fields);
        if (fields.billingMode === 'FORFAIT') c.weekdays = [];
        if (archived !== undefined) c.archivedAt = archived ? new Date().toISOString() : null;
      },
      () => api<Client>(`/clients/${id}`, { method: 'PATCH', body: patch }),
      (s, updated) => replaceClient(s, updated),
    );

  const deleteClient = (id: string) =>
    mutate(
      (s) => { s.clients = s.clients.filter((c) => c.id !== id); s.leaves = s.leaves.filter((l) => l.clientId !== id); },
      () => api<void>(`/clients/${id}`, { method: 'DELETE' }),
    );

  const addRate = (clientId: string, rate: RateInput) =>
    mutate(
      (s) => {
        const c = s.clients.find((x) => x.id === clientId);
        if (c) c.rates = [...c.rates.filter((r) => r.validFrom !== rate.validFrom), { ...rate, id: tmpId() }];
      },
      () => api<Client>(`/clients/${clientId}/rates`, { method: 'POST', body: rate }),
      (s, updated) => replaceClient(s, updated),
    );

  const deleteRate = (clientId: string, rateId: string) =>
    mutate(
      (s) => {
        const c = s.clients.find((x) => x.id === clientId);
        if (c && c.rates.length > 1) c.rates = c.rates.filter((r) => r.id !== rateId);
      },
      () => api<Client>(`/clients/${clientId}/rates/${rateId}`, { method: 'DELETE' }),
      (s, updated) => replaceClient(s, updated),
    );

  async function addLeaves(body: LeavesInput): Promise<{ created: number; cost: Cents } | null> {
    const res = await mutate(
      () => {},
      () => api<{ leaves: LeaveDto[]; created: number }>('/leaves', { method: 'POST', body }),
    );
    if (!res || !data.value) return null;
    const known = new Set(data.value.leaves.map((l) => l.id));
    const fresh = res.leaves.filter((l) => !known.has(l.id));
    data.value.leaves = [...data.value.leaves, ...fresh].sort((a, b) => a.date.localeCompare(b.date));
    return { created: res.created, cost: leavesCost(fresh, data.value.clients, data.value.profile.includeProspects) };
  }

  const deleteLeaves = (ids: string[]) =>
    mutate(
      (s) => { s.leaves = s.leaves.filter((l) => !ids.includes(l.id)); },
      () => api<{ deleted: number }>('/leaves/delete', { method: 'POST', body: { ids } }),
    );

  async function toggleLeave(date: ISODate, target: LeaveTarget): Promise<void> {
    const existing = data.value?.leaves.find((l) => l.date === date && matchesTarget(l, target));
    if (existing) {
      await deleteLeaves([existing.id]);
      return;
    }
    const optimistic: LeaveDto = { id: tmpId(), date, scope: target.scope, clientId: target.scope === 'CLIENT' ? target.clientId : null };
    await mutate(
      (s) => { s.leaves.push(optimistic); },
      () => api<{ leaves: LeaveDto[]; created: number }>('/leaves', { method: 'POST', body: { from: date, scope: target.scope, clientId: optimistic.clientId } }),
      (s, res) => { s.leaves = [...s.leaves.filter((l) => l.id !== optimistic.id), ...res.leaves.filter((l) => !s.leaves.some((x) => x.id === l.id))]; },
    );
  }

  async function cycleWeekday(weekday: number): Promise<void> {
    if (!input.value) return;
    for (const patch of engineCycleWeekday(input.value.clients, today.value, weekday)) {
      await updateClient(patch.clientId, { weekdays: patch.weekdays });
    }
  }

  const addCharge = (body: ChargeInput) => {
    const id = tmpId();
    return mutate(
      (s) => { s.charges.push({ ...body, id }); },
      () => api<ChargeDto>('/charges', { method: 'POST', body }),
      (s, created) => { s.charges = s.charges.map((c) => (c.id === id ? created : c)); },
    );
  };

  const updateCharge = (id: string, patch: ChargePatch) =>
    mutate(
      (s) => {
        const c = s.charges.find((x) => x.id === id);
        if (c) Object.assign(c, patch, patch.frequency === 'MONTHLY' ? { month: null } : {});
      },
      () => api<ChargeDto>(`/charges/${id}`, { method: 'PATCH', body: patch }),
      (s, updated) => { s.charges = s.charges.map((c) => (c.id === id ? updated : c)); },
    );

  const deleteCharge = (id: string) =>
    mutate((s) => { s.charges = s.charges.filter((c) => c.id !== id); }, () => api<void>(`/charges/${id}`, { method: 'DELETE' }));

  async function exportData(): Promise<void> {
    const file = await api<unknown>('/export');
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ma-treso-${localToday()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importData(file: File): Promise<boolean> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      toast.error('Ce fichier n’est pas une sauvegarde Ma Tréso valide.');
      return false;
    }
    try {
      data.value = await api<StateDto>('/import', { method: 'POST', body: parsed });
      toast.show('Sauvegarde importée.');
      return true;
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Import impossible.');
      return false;
    }
  }

  return {
    data, today, status, input, profile, allClients, clients, clientById, isMicro, results, summary, leavePeriods, currentMonth, balance,
    load, ensureLoaded, reset, updateProfile, setCompanyMode, setBalance, createClient, updateClient, deleteClient, addRate, deleteRate,
    addLeaves, deleteLeaves, toggleLeave, cycleWeekday, addCharge, updateCharge, deleteCharge, exportData, importData,
  };
});
```

Chargement : dans `layouts/default.vue`, appeler `useTresoStore().ensureLoaded()` dans `onMounted`, et afficher un état de chargement sobre (« Chargement de ta tréso… ») tant que `status !== 'ready'`. Si `import.meta.dev || useRuntimeConfig().public.e2e`, exposer `window.__treso = store`. Mettre à jour `AppSidebar` pour afficher le vrai solde.

- [ ] **Step 4: Vérifier, puis commit**

Run : `npm run test:e2e -w @matreso/web -- store.spec.ts shell.spec.ts`
Expected : PASS.
```bash
git add apps/web
git commit -m "feat(web): store treso (moteur côté navigateur, écritures optimistes, rechargement sur erreur)"
```

### Task 25: Composants graphiques

**Files:**
- Create : `apps/web/app/components/charts/{ResultBars,MiniBars,MissionTimeline,CeilingGauge,StackedCashBars,LeaveImpactBars,SplitBar,SmoothedBars}.vue`, `apps/web/e2e/charts.spec.ts`
- Modify : `apps/web/app/pages/dev/ui.vue` (ajouter une démo de chaque graphique)

**Interfaces** (données déjà calculées et formatées, aucun calcul métier dans ces composants) :

| Composant | Props | Émissions | Source du balisage |
| --- | --- | --- | --- |
| `ResultBars` | `bars: { key: string; label: string; valueLabel: string; value: number; aria: string; selected: boolean }[]`, `height?: number` (160) | `select(index)` | `Main.dc.html` l. 107 à 114 : barre verte au-dessus de l'axe noir, rouge en dessous, hauteur proportionnelle au max absolu (76 px de chaque côté), colonne sélectionnée encadrée (`#FFF4C2` + `inset 0 0 0 2px var(--ink)`), libellé en vert `#1E6B3A` ou rouge `#C2272D` |
| `MiniBars` | mêmes `bars`, `highlight?: string[]` (clés à surligner) | `select(index)` | `Mobile-Accueil.dc.html` l. 76 à 82 : version compacte, libellés de 1 à 2 lettres (`monthLetter`) |
| `MissionTimeline` | `months: string[]` (libellés courts), `rows: { id: string; name: string; sub: string; leftPct: number; widthPct: number; openEnd: boolean; prospect: boolean; dimmed: boolean; selected: boolean; color: { base: string; fg: string; soft: string }; label: string; aria: string }[]`, `gaps: { label: string; low: boolean }[]`, `gapMessage: { text: string; tone: 'warn' \| 'ok' }` | `select(id)` | `Clients.dc.html` l. 69 à 90 : piste crème, barre colorée, hachures pour une piste, bord droit ouvert si sans fin, ligne « Creux de CA » |
| `CeilingGauge` | `actualPct: number`, `plannedPct: number`, `vatPct: number`, `color: string`, `soft: string`, `ariaLabel: string` | — | `Main-Micro.dc.html` l. 96 à 116 : rail crème, réel plein, prévu hachuré, marqueur vertical « Seuil TVA » |
| `StackedCashBars` | `columns: { label: string; totalLabel: string; segments: { value: number; color: string; faded: boolean }[] }[]`, `ariaLabels: string[]` | — | `Clients.dc.html` l. 162 à 183 : 12 colonnes empilées, hauteur max 170 px, segments ≥ 4 px |
| `LeaveImpactBars` | `columns: { label: string; without: number; with: number; highlight: boolean; aria: string }[]` | — | `Calendrier.dc.html` l. 116 à 140 : deux barres par mois (gris sans congés, vert ou rouge avec), mois surlignés |
| `SplitBar` | `segments: { label: string; value: number; color: string; display: string }[]`, `total: number` | — | `Main-Micro.dc.html` l. 70 à 82 : barre horizontale découpée, légende |
| `SmoothedBars` | `bars: { key: string; label: string; value: number; low: boolean; aria: string; selected: boolean }[]`, `average: number`, `averageLabel: string` | `select(index)` | `Main-Micro.dc.html` l. 118 à 131 : barres vertes, orange si `low`, moyenne en pointillés |

Chaque barre ou colonne interactive est un `<button>` avec `aria-label` (ex. « février 2027 : −2 310 € ») et `aria-pressed` pour la sélection. Chaque graphique non interactif a un `role="img"` et un `aria-label` de synthèse. Les conteneurs larges (15 colonnes) gardent `overflow-x: auto` **à l'intérieur** de la carte, jamais sur la page. Sur mobile, ce sont les composants « mini », qui tiennent en 350 px sans défilement.

- [ ] **Step 1: Écrire le test e2e**

```ts
import { expect, test } from '@playwright/test';
import { freshAccount } from './helpers';

test.beforeEach(async ({ page }) => {
  await freshAccount(page, { file: null });
  await page.goto('/dev/ui');
});

test('result bars are labelled buttons with selection', async ({ page }) => {
  const bars = page.getByRole('group', { name: 'Démo barres' });
  await bars.getByRole('button', { name: 'novembre 2026 : +5 340 €' }).click();
  await expect(bars.getByRole('button', { name: 'novembre 2026 : +5 340 €' })).toHaveAttribute('aria-pressed', 'true');
});

test('gauge and timeline expose a readable summary', async ({ page }) => {
  await expect(page.getByRole('img', { name: /plafond/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Ouvrir Client A/ })).toBeVisible();
});
```
La page `/dev/ui` construit ses jeux de démo depuis `demoInput()` du moteur et les fonctions de format.

- [ ] **Step 2: Vérifier l'échec, implémenter, vérifier, commit**

Run : `npm run test:e2e -w @matreso/web -- charts.spec.ts` → FAIL, puis implémenter les 8 composants selon le tableau, puis relancer → PASS.
```bash
git add apps/web
git commit -m "feat(web): graphiques SVG/HTML maison (barres, frise, jauge, empilées, répartition)"
```

### Task 26: Tableau de bord société (desktop et mobile)

**Files:**
- Create : `apps/web/app/composables/useCompanyDashboard.ts`, `apps/web/app/components/dashboard/{CompanyDashboard,CompanyDashboardMobile,VerdictCard,IncomeList,ChargeList}.vue`, `apps/web/app/components/layout/{StatusSwitch,BalanceField}.vue`, `apps/web/e2e/dashboard.spec.ts`
- Modify : `apps/web/app/pages/index.vue`

**Interfaces:**
- Consumes : `useTresoStore` (`results`, `summary`, `profile`, `balance`, `clientById`, `setBalance`, `setCompanyMode`, `today`), format (`euros`, `kEuros`, `monthLabel`, `monthShort`, `monthLetter`, `longDate`, `invoiceLabel`, `shortDate`, `relativeDays`), `STATE_STYLE`, `PALETTE`, composants des Tasks 22 et 25.
- Produces : `useCompanyDashboard()` → `{ index, select, prev, next, canPrev, canNext, verdict, incomeRows, chargeRows, bars, summary, greeting, todayLabel }`, `StatusSwitch` (réutilisé en Task 27), `BalanceField`.
- Sources : `Main.dc.html` (balisage l. 39 à 120, logique l. 121 à 217) et `Mobile-Accueil.dc.html` (balisage l. 51 à 96, logique l. 97 à 187).

- [ ] **Step 1: Écrire le test e2e**

```ts
import { expect, test } from '@playwright/test';
import { fr, freshAccount } from './helpers';

test('answers the question for October 2026 with the demo data', async ({ page }) => {
  await freshAccount(page);
  await expect(page.getByText('Tu es dans le rouge ce mois-ci')).toBeVisible();
  await expect(page.getByText(fr('−2 310 €')).first()).toBeVisible();
  await expect(page.getByText(fr('46 010 €')).first()).toBeVisible();
  await expect(page.getByText(fr('Il manque ce montant pour couvrir tes charges, mais ton solde absorbe le choc : il reste 46 010 € sur le compte.'))).toBeVisible();
});

test('lists what comes in and what goes out', async ({ page }) => {
  await freshAccount(page);
  await expect(page.getByText('Facture d’août · vers le 25 oct.')).toBeVisible();
  await expect(page.getByText(fr('+6 600 €')).first()).toBeVisible();
  await expect(page.getByText('Salaire (net)')).toBeVisible();
  await expect(page.getByText('Cotisations sociales')).toBeVisible();
});

test('navigates months with the arrows and the bars', async ({ page, isMobile }) => {
  await freshAccount(page);
  await page.getByRole('button', { name: 'Mois suivant' }).click();
  await expect(page.getByText('novembre 2026').first()).toBeVisible();
  await expect(page.getByText('Tu es dans le positif')).toBeVisible();
  await expect(page.getByText(fr('+5 340 €')).first()).toBeVisible();
  const bar = page.getByRole('button', { name: fr('février 2027 : −2 310 €') });
  await bar.click();
  await expect(bar).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Sans tes vacances, ce mois serait dans le positif.')).toBeVisible();
  if (!isMobile) await expect(page.getByText('6 mois dans le rouge, jamais à découvert')).toBeVisible();
});

test('updates the balance and the projection follows', async ({ page }) => {
  await freshAccount(page);
  const field = page.getByLabel('Solde du compte');
  await field.fill('50000');
  await field.blur();
  await expect(page.getByText(fr('47 690 €')).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(fr('47 690 €')).first()).toBeVisible();
});

test('shows empty states on a brand new account, without NaN', async ({ page, isMobile }) => {
  await freshAccount(page, { file: null, firstName: 'Camille' });
  await expect(page.getByText('Aucun paiement client attendu ce mois-ci.')).toBeVisible();
  if (isMobile) await expect(page.getByRole('link', { name: 'Ton profil' })).toHaveText('C');
  else await expect(page.getByText('Salut Camille', { exact: false })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('NaN');
});
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm run test:e2e -w @matreso/web -- dashboard.spec.ts`
Expected : FAIL.

- [ ] **Step 3: Implémenter le view-model**

`app/composables/useCompanyDashboard.ts` :
```ts
import { euros, invoiceLabel, kEuros, longDate, monthLabel, monthLetter, monthShort } from '@matreso/engine';

export function useCompanyDashboard() {
  const treso = useTresoStore();
  const index = ref(0);
  const max = computed(() => Math.max(0, treso.results.length - 1));
  const current = computed(() => treso.results[index.value] ?? null);

  const select = (i: number) => { index.value = Math.min(max.value, Math.max(0, i)); };
  const prev = () => select(index.value - 1);
  const next = () => select(index.value + 1);

  const verdict = computed(() => {
    const r = current.value;
    if (!r) return null;
    const positive = r.result >= 0;
    const safe = r.balance >= 0;
    let sentence = positive
      ? 'Tes rentrées couvrent toutes tes charges, et il te reste ce montant en plus.'
      : safe
        ? `Il manque ce montant pour couvrir tes charges, mais ton solde absorbe le choc : il reste ${euros(r.balance)} sur le compte.`
        : 'Et ton solde ne suffit pas : le compte passe à découvert.';
    if (r.state === 'RED_DUE_TO_LEAVES') sentence += ' Sans tes vacances, ce mois serait dans le positif.';
    return {
      month: r.month,
      monthLabel: monthLabel(r.month),
      state: r.state,
      style: STATE_STYLE[r.state],
      title: positive ? 'Tu es dans le positif' : 'Tu es dans le rouge ce mois-ci',
      result: euros(r.result, { sign: true }),
      sentence,
      income: euros(r.income),
      charges: euros(r.charges),
      balance: euros(r.balance),
    };
  });

  const incomeRows = computed(() =>
    (current.value?.entries ?? []).map((e) => {
      const client = treso.clientById(e.clientId);
      return {
        key: `${e.clientId}-${e.workMonth}`,
        name: client?.name ?? 'Client',
        color: client ? PALETTE[client.color].base : 'var(--muted)',
        sub: invoiceLabel(e, client?.billingMode ?? 'TJM'),
        amount: euros(e.amount, { sign: true }),
        lost: e.leaveCost > 0 ? `−${euros(e.leaveCost)} de vacances déjà retirés` : null,
      };
    }),
  );

  const chargeRows = computed(() =>
    (current.value?.chargeItems ?? []).map((c) => ({
      key: c.id,
      name: c.name,
      sub: c.frequency === 'MONTHLY' ? 'Chaque mois' : 'Une fois par an',
      amount: `−${euros(c.amount)}`,
      computed: c.computed,
    })),
  );

  const bars = computed(() =>
    treso.results.map((r, i) => ({
      key: r.month,
      label: monthShort(r.month) + (r.month.endsWith('-01') || i === 0 ? ` ${r.month.slice(2, 4)}` : ''),
      letter: monthLetter(r.month),
      valueLabel: kEuros(r.result),
      value: r.result,
      aria: `${monthLabel(r.month)} : ${euros(r.result, { sign: true })}`,
      selected: i === index.value,
      state: r.state,
    })),
  );

  const summary = computed(() => ({
    text: treso.summary.text,
    tone: treso.summary.overdraftCount > 0 ? 'danger' : treso.summary.redCount > 0 ? 'warn' : 'positive',
  }));

  const greeting = computed(() => `Salut ${treso.profile?.firstName ?? ''} !`);
  const todayLabel = computed(() => `Aujourd’hui, ${longDate(treso.today)}`);

  return { index, select, prev, next, canPrev: computed(() => index.value > 0), canNext: computed(() => index.value < max.value), verdict, incomeRows, chargeRows, bars, summary, greeting, todayLabel };
}
```

- [ ] **Step 4: Implémenter les composants et la page**

- `StatusSwitch.vue` : le `<nav aria-label="Statut">` de `Main.dc.html` (l. 64), sous forme de `SegmentedControl` Société / Micro-entreprise. La valeur vaut `treso.isMicro ? 'MICRO' : 'COMPANY'`, et le changement appelle `treso.setCompanyMode`.
- `BalanceField.vue` : un `MoneyInput` « Solde du compte », valeur `treso.balance?.amount ?? null`. Au changement, appeler `treso.setBalance(cents)`. En dessous, en petit : « Mis à jour {relativeDays(balance.date, today)} », ou « Indique ton solde pour démarrer » s'il n'y a pas de solde.
- `VerdictCard.vue` : props `verdict`, `size: 'lg' | 'sm'`, `canPrev`, `canNext` ; émet `prev` et `next`.
  - En `lg`, porter `Main.dc.html` l. 66 à 85 : chiffre de 72 px, trois tuiles Rentrées, Charges, Sur le compte fin de mois.
  - En `sm`, porter `Mobile-Accueil.dc.html` l. 60 à 74 : chiffre de 52 px, deux tuiles et un bandeau « Sur le compte fin de mois ».
  - Le fond et l'encre viennent de `verdict.style.bg` / `.ink`.
  - Le titre d'état est toujours affiché, car l'état ne doit pas reposer sur la couleur seule.
- `IncomeList.vue` / `ChargeList.vue` : porter `Main.dc.html` l. 86 à 101 (`ListRow`). `IncomeList` affiche l'état vide « Aucun paiement client attendu ce mois-ci. » ; `ChargeList` a le lien « Modifier mes charges » vers `/expenses`.
- `CompanyDashboard.vue` (desktop), dans l'ordre :
  - en-tête (`todayLabel`, H1 avec `greeting` et « Ce mois-ci, ça passe ? », puis `StatusSwitch` et `BalanceField`) ;
  - `VerdictCard lg` ;
  - les deux listes côte à côte ;
  - la carte « Mois par mois » avec `ResultBars`, la pastille `summary` et la bulle « Pourquoi certains mois sont dans le rouge ? », dont le texte est repris de `Main.dc.html` l. 117.
- `CompanyDashboardMobile.vue` : porter `Mobile-Accueil.dc.html` l. 51 à 96 dans l'ordre de la maquette :
  - en-tête « Ce mois-ci, ça passe ? » avec « Aujourd’hui, {shortDate(today)} » au-dessus et la pastille d'initiales en haut à droite (`NuxtLink` vers `/profile`, `aria-label` « Ton profil », comme dans la maquette l. 55) ;
  - `StatusSwitch` ;
  - `VerdictCard sm` ;
  - « Les 15 prochains mois » avec `MiniBars` ;
  - les listes ;
  - la bulle (`TipBubble compact`) ;
  - `BalanceField` en dernier.
- `pages/index.vue` :
```vue
<script setup lang="ts">
const treso = useTresoStore();
const { isDesktop } = useBreakpoint();
</script>

<template>
  <template v-if="treso.status === 'ready'">
    <template v-if="treso.isMicro">
      <MicroDashboard v-if="isDesktop" />
      <MicroDashboardMobile v-else />
    </template>
    <template v-else>
      <CompanyDashboard v-if="isDesktop" />
      <CompanyDashboardMobile v-else />
    </template>
  </template>
</template>
```
(`MicroDashboard*` arrivent en Task 27. D'ici là, créer deux composants vides qui affichent « Bientôt ».)

- [ ] **Step 5: Vérifier, puis commit**

Run : `npm run test:e2e -w @matreso/web -- dashboard.spec.ts`
Expected : PASS sur desktop et mobile.
```bash
git add apps/web
git commit -m "feat(web): tableau de bord société (verdict, rentrées, sorties, 15 mois)"
```

### Task 27: Tableau de bord micro-entreprise (desktop et mobile)

**Files:**
- Create : `apps/web/app/composables/useMicroDashboard.ts`, `apps/web/app/components/dashboard/{MicroDashboard,MicroDashboardMobile,SetAsideCard,CeilingCard}.vue`, `apps/web/e2e/micro.spec.ts`

**Interfaces:**
- Consumes : `microMonths`, `ceilingGauge`, `smoothedIncome`, `paramsFor`, `yearOf`, `addMonths`, format, `useTresoStore().{input, profile, updateProfile, today}`, `StatusSwitch`, `BalanceField`, `SplitBar`, `CeilingGauge`, `SmoothedBars`.
- Produces : `useMicroDashboard()` → `{ index, select, prev, next, canPrev, canNext, month, split, tiles, setAside, years, year, setYear, gauge, testMission, toggleTestMission, smoothed, bars }`.
- Sources : `Main-Micro.dc.html` (balisage l. 39 à 133, logique l. 134 à 205) et `Mobile-Accueil-Micro.dc.html` (balisage l. 51 à 95, logique l. 96 à 168).

- [ ] **Step 1: Écrire le test e2e**

```ts
import { demoExportFile, type ExportFileV1 } from '@matreso/engine';
import { expect, test } from '@playwright/test';
import { fr, freshAccount } from './helpers';

const microDemo = (): ExportFileV1 => {
  const file = demoExportFile();
  return { ...file, profile: { ...file.profile, legalStatus: 'MICRO' } };
};

test('shows what is left for you this month', async ({ page }) => {
  await freshAccount(page, { file: microDemo() });
  await expect(page.getByText('Pour toi ce mois-ci').first()).toBeVisible();
  await expect(page.getByText(fr('4 040 €')).first()).toBeVisible();
  await expect(page.getByText(fr('sur 6 600 € encaissés'))).toBeVisible();
});

test('switches to versement libératoire', async ({ page }) => {
  await freshAccount(page, { file: microDemo() });
  await page.getByRole('switch', { name: /Versement libératoire/ }).click();
  await expect(page.getByRole('switch', { name: /Versement libératoire/ })).toHaveAttribute('aria-checked', 'true');
  // 6 600 − 1 722,60 − 145,20 − 180 = 4 552,20
  await expect(page.getByText(fr('4 550 €')).first()).toBeVisible();
});

test('the test mission tips the year over the ceiling and names the month', async ({ page }) => {
  const file: ExportFileV1 = {
    ...microDemo(),
    clients: [{
      ref: 'big', name: 'Gros client', subtitle: null, color: 'green', billingMode: 'FORFAIT', weekdays: [],
      startDate: '2026-01-01', endDate: null, paymentTerm: 'RECEPTION', averageDelayDays: 0, isProspect: false, archived: false,
      rates: [{ validFrom: '2026-01-01', amount: 680_000 }],
    }],
    leaves: [],
  };
  await freshAccount(page, { file });
  await expect(page.getByText(/Tu frôles le plafond/)).toBeVisible();
  await page.getByRole('checkbox', { name: /Tester une mission en plus/ }).check();
  await expect(page.getByText(/tu dépasses le plafond en décembre 2026/)).toBeVisible();
});

test('the status switch goes back to company mode', async ({ page }) => {
  await freshAccount(page, { file: microDemo() });
  await page.getByRole('group', { name: 'Statut' }).getByRole('button', { name: 'Société' }).click();
  await expect(page.getByText('Tu es dans le rouge ce mois-ci')).toBeVisible();
});
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm run test:e2e -w @matreso/web -- micro.spec.ts`
Expected : FAIL.

- [ ] **Step 3: Implémenter le view-model**

`app/composables/useMicroDashboard.ts` :
```ts
import { ceilingGauge, euros, kEuros, microMonths, monthLabel, monthLetter, monthName, monthShort, addMonths, paramsFor, smoothedIncome, yearOf } from '@matreso/engine';

export function useMicroDashboard() {
  const treso = useTresoStore();
  const index = ref(0);
  const testMission = ref(false);
  const year = ref(yearOf(treso.today));

  const months = computed(() => (treso.input ? microMonths(treso.input) : []));
  const current = computed(() => months.value[index.value] ?? null);
  const smoothed = computed(() => smoothedIncome(months.value));
  const max = computed(() => Math.max(0, months.value.length - 1));
  const select = (i: number) => { index.value = Math.min(max.value, Math.max(0, i)); };

  const split = computed(() => {
    const b = current.value?.breakdown;
    if (!b) return [];
    return [
      { label: 'Cotisations', value: b.contributions, color: '#FF8A3D', display: euros(b.contributions) },
      { label: 'Impôt', value: b.tax, color: '#9B6BFF', display: euros(b.tax) },
      { label: 'Frais pro', value: b.proExpenses, color: '#B9B2CC', display: euros(b.proExpenses) },
      { label: 'Pour toi', value: Math.max(0, b.forYou), color: '#2E9E6A', display: euros(b.forYou) },
    ];
  });

  const tiles = computed(() => {
    const b = current.value?.breakdown;
    return b
      ? { forYou: euros(b.forYou), income: `sur ${euros(b.income)} encaissés`, low: b.forYou < smoothed.value.average * 0.6, monthLabel: monthLabel(current.value!.month) }
      : null;
  });

  const setAside = computed(() => {
    const m = current.value;
    if (!m || !treso.profile) return null;
    const next = addMonths(m.month, 1);
    const vl = treso.profile.microVersementLiberatoire;
    return {
      contributions: { title: 'Cotisations URSSAF', sub: `Déclarées et payées fin ${monthName(next)}`, amount: euros(m.breakdown.contributions) },
      tax: { title: vl ? 'Versement libératoire' : 'Impôt sur le revenu', sub: vl ? 'Payé avec tes cotisations' : 'À garder pour ta déclaration au printemps', amount: euros(m.breakdown.tax) },
      versementLiberatoire: vl,
      provisionPct: treso.profile.microIncomeTaxProvisionPct,
    };
  });

  const years = computed(() => [yearOf(treso.today), yearOf(treso.today) + 1]);

  const gauge = computed(() => {
    if (!treso.input) return null;
    const g = ceilingGauge(treso.input, year.value, { testMission: testMission.value });
    const scale = Math.max(g.ceiling * 1.1, g.total);
    const color = g.level === 'OVER' ? '#E5484D' : g.level === 'WARN' ? '#E0A800' : '#2E9E6A';
    const soft = g.level === 'OVER' ? '#FBD2CE' : g.level === 'WARN' ? '#FFF1B8' : '#CDEBD8';
    const message =
      g.level === 'OVER'
        ? `Au rythme prévu, tu dépasses le plafond en ${monthLabel(g.overMonth!)} (${g.pct} %). Si ça se répète deux années de suite, tu sors du régime micro : anticipe le passage en société.`
        : g.level === 'WARN'
          ? `Tu frôles le plafond : ${g.pct} % prévus sur ${g.year}. Garde un œil dessus.`
          : `Tranquille : ${g.pct} % du plafond prévus sur ${g.year}.`;
    const vat = g.vatMonth
      ? `Seuil de franchise de TVA dépassé en ${monthLabel(g.vatMonth)} : tu devras facturer la TVA en plus de tes prix, tout de suite ou l’année suivante selon le montant.`
      : 'Sous le seuil de franchise de TVA : tu factures sans TVA.';
    return {
      total: euros(g.total), ceiling: euros(g.ceiling), level: g.level, color, soft, message, vat,
      actualPct: (g.actual / scale) * 100, plannedPct: (g.planned / scale) * 100, vatPct: (g.vatThreshold / scale) * 100,
      aria: `Plafond ${g.year} : ${euros(g.total)} sur ${euros(g.ceiling)}, ${g.pct} %`,
    };
  });

  const bars = computed(() =>
    months.value.map((m, i) => ({
      key: m.month,
      label: monthShort(m.month) + (m.month.endsWith('-01') || i === 0 ? ` ${m.month.slice(2, 4)}` : ''),
      letter: monthLetter(m.month),
      value: Math.max(0, m.breakdown.forYou),
      low: smoothed.value.lowMonths.includes(m.month),
      aria: `${monthLabel(m.month)} : ${euros(m.breakdown.forYou)} pour toi`,
      selected: i === index.value,
      valueLabel: kEuros(m.breakdown.forYou, { sign: false }),
    })),
  );

  return {
    index, select, prev: () => select(index.value - 1), next: () => select(index.value + 1),
    canPrev: computed(() => index.value > 0), canNext: computed(() => index.value < max.value),
    split, tiles, setAside, years, year, setYear: (y: number) => { year.value = y; },
    gauge, testMission, toggleTestMission: () => { testMission.value = !testMission.value; },
    smoothed: computed(() => ({ average: smoothed.value.average, label: `Revenu lissé sur 12 mois : ${euros(smoothed.value.average)} / mois` })),
    bars, params: computed(() => paramsFor(year.value)),
  };
}
```

- [ ] **Step 4: Implémenter les composants**

- `MicroDashboard.vue` : porter `Main-Micro.dc.html` dans l'ordre de la maquette :
  - en-tête (même `StatusSwitch` et `BalanceField` que la société) ;
  - carte « Pour toi ce mois-ci » avec `MonthStepper`, chiffre de 72 px, « sur X € encaissés », `SplitBar` et 4 tuiles chiffrées ;
  - `SetAsideCard` ;
  - `CeilingCard` ;
  - carte « Combien te verser chaque mois » : bandeau du revenu lissé, `SmoothedBars`, bulle « Pourquoi lisser ? » ;
  - `EstimateNote`.
- `SetAsideCard.vue` (« À mettre de côté ») : deux lignes (cotisations, impôt), puis un `ToggleSwitch` « Versement libératoire (2,2 %) » qui appelle `treso.updateProfile({ microVersementLiberatoire })`. Si le versement libératoire est désactivé, ajouter un curseur `input[type=range]` de 0 à 30 % pour la provision d'impôt, avec libellé et valeur affichée, qui appelle `updateProfile({ microIncomeTaxProvisionPct })` au `change`.
- `CeilingCard.vue` (« Ton plafond de CA ») :
  - `SegmentedControl` des années ;
  - total sur plafond ;
  - `CeilingGauge` ;
  - message coloré (`role="status"`) ;
  - encart TVA ;
  - case à cocher native « Tester une mission en plus : lundi, 650 €/j, dès {mois suivant} », liée à `testMission`. Le libellé du mois vient de `monthName(addMonths(currentMonth, 1))`.
- `MicroDashboardMobile.vue` : porter `Mobile-Accueil-Micro.dc.html`, dont le H1 est « Combien il te reste ? ». Mêmes blocs empilés, en version compacte (mini-barres, interrupteur de versement libératoire).

- [ ] **Step 5: Vérifier, puis commit**

Run : `npm run test:e2e -w @matreso/web -- micro.spec.ts dashboard.spec.ts`
Expected : PASS.
```bash
git add apps/web
git commit -m "feat(web): tableau de bord micro (pour toi, à mettre de côté, plafond, revenu lissé)"
```

### Task 28: Clients et missions (desktop)

**Files:**
- Create : `apps/web/app/composables/useClientsView.ts`, `apps/web/app/components/clients/{ClientsDesktop,MissionTable,MissionPanel,RateEditor,InvoicePath}.vue`, `apps/web/e2e/clients.spec.ts`
- Modify : `apps/web/app/pages/clients/index.vue`, création de `apps/web/app/pages/clients/new.vue` et `apps/web/app/pages/clients/[id].vue`

**Interfaces:**
- Consumes : `missionTimeline`, `billedVsCashed`, `estimatedMonthly`, `currentRate`, `nextRate`, `rateHistory`, `firstInvoicePath`, `PAYMENT_TERMS`, `PAYMENT_TERM_KEYS`, format, `PALETTE`, `nextColor`, actions `createClient`, `updateClient`, `deleteClient`, `addRate`, `deleteRate`, `updateProfile({ includeProspects })`.
- Produces : `useClientsView(selectedId: Ref<string | null>)` → `{ timeline, rows, selected, panel, cashBars, totals, kicker }` ; `MissionPanel` (props `clientId: string | 'new'`), réutilisé sur mobile par la Task 29 pour la logique (via `useClientsView`).
- Sources : `Clients.dc.html` (balisage l. 39 à 185, logique l. 186 à 282).

Routage :
- `/clients` affiche la page, avec le premier client sélectionné.
- `/clients/:id` (desktop) affiche la même page avec ce client sélectionné ; sur mobile, c'est l'écran poussé de la Task 29.
- `/clients/new` (desktop) ouvre le panneau en création ; sur mobile, c'est l'écran poussé de création.

- [ ] **Step 1: Écrire le test e2e** (projet desktop uniquement)

```ts
import { expect, test } from '@playwright/test';
import { fr, freshAccount } from './helpers';

test.skip(({ isMobile }) => isMobile, 'version desktop');

test('shows the timeline and the missions table', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  await expect(page.getByRole('heading', { name: 'Tes missions dans le temps' })).toBeVisible();
  await expect(page.getByText(/Creux repéré : juin 2027/)).toBeVisible();
  await expect(page.getByRole('row', { name: /Client A/ })).toContainText(fr('650 €/j'));
  await expect(page.getByRole('row', { name: /Client A/ })).toContainText(fr('→ 700 € au 1er janv.'));
});

test('selects a mission and shows the path of an invoice', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  await page.getByRole('row', { name: /Client A/ }).click();
  const panel = page.getByRole('region', { name: 'Client A' });
  await expect(panel.getByText('31 oct.')).toBeVisible();
  await expect(panel.getByText('Soit 30 jours d’attente entre la fin du mois travaillé et l’argent sur ton compte.')).toBeVisible();
});

test('adds a future rate and protects the last rate', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  await page.getByRole('row', { name: /Client A/ }).click();
  const panel = page.getByRole('region', { name: 'Client A' });
  await panel.getByLabel('Nouveau TJM (€)').fill('750');
  await panel.getByLabel('À partir du').fill('2027-04-01');
  await panel.getByRole('button', { name: 'Ajouter' }).click();
  await expect(panel.getByText(fr('750 €/j'))).toBeVisible();
  await expect(panel.getByText('À venir').first()).toBeVisible();
  await page.getByRole('row', { name: /Client C/ }).click();
  const c = page.getByRole('region', { name: 'Client C' });
  await expect(c.getByRole('button', { name: /Supprimer le tarif/ })).toHaveCount(0);
});

test('edits payment terms and the path follows', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  await page.getByRole('row', { name: /Client A/ }).click();
  const panel = page.getByRole('region', { name: 'Client A' });
  await panel.getByRole('button', { name: '60 jours' }).click();
  await expect(panel.getByText('Soit 60 jours d’attente', { exact: false })).toBeVisible();
});

test('creates a new client', async ({ page }) => {
  await freshAccount(page, { file: null });
  await page.goto('/clients');
  await page.getByRole('button', { name: 'Ajouter un client' }).click();
  const panel = page.getByRole('region', { name: 'Nouveau client' });
  await panel.getByLabel('Nom du client').fill('Acme');
  await panel.getByLabel('TJM (€)').fill('600');
  await panel.getByRole('button', { name: 'lundi' }).click();
  await panel.getByRole('button', { name: 'Créer la mission' }).click();
  await expect(page.getByRole('row', { name: /Acme/ })).toBeVisible();
});
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm run test:e2e -w @matreso/web -- clients.spec.ts --project=desktop`
Expected : FAIL.

- [ ] **Step 3: Implémenter le view-model**

`app/composables/useClientsView.ts` : à partir de `treso.input` et du client sélectionné, produire :
- `kicker` : « N missions · M piste(s) » (script l. 268) ;
- `timeline` : `missionTimeline(input)` transformé en props pour `MissionTimeline` :
  - `months` = `monthShort` ;
  - par client : `name`, et `sub` = « Piste », ou « Forfait · {subtitle} », ou le `subtitle` ;
  - `label` = « {shortDate(start)} → {shortDate(end) ou …} » ;
  - `aria` = « Ouvrir {name} : Du {shortDate(start)}, sans fin » ou « … au {shortDate(end)} » ;
  - `dimmed` = piste alors que `includeProspects` est faux ;
  - `gaps` = « {monthShort} : {euros(billed)} facturés » avec `low` ;
  - `gapMessage` : « Creux repéré : {liste des monthLabel}. Il manque une mission pour remplir tes jours. », ou « Aucun creux sur 12 mois : tes jours sont remplis. » ;
- `rows` (tableau Missions) :
  - client, barre de couleur (opacité 0,6 si piste) ;
  - jours : « Lun, Ven » via `WEEKDAY_SHORT`, ou « Forfait mensuel », ou « aucun jour » ;
  - période : « Du 1er oct., sans fin » / « Du … au … » ;
  - tarif actuel : `eurosExact(currentRate) + ' €/j'` ou `' €/mois'` ;
  - sous-titre du tarif : « → {eurosExact(next)} au {shortDate(next.validFrom)} », ou « {n} tarifs dans l’historique » s'il y a plus d'un tarif ;
  - délai : `PAYMENT_TERMS[term].label` ;
  - retard : « + {n} j de retard en moyenne », ou « paie à l’heure » ;
  - montant mensuel : `(isProspect ? '+' : '') + euros(estimatedMonthly(client, today))` ;
- `panel` (client sélectionné) :
  - mode, `modeHelp` (textes du script l. 274), titre du tarif « TJM actuel » / « Montant mensuel actuel », valeur actuelle ;
  - `history` = `rateHistory(rates, today)` mappé en `{ id, value, when: 'Du … au …', status, badge: 'Actuel' | 'À venir' | 'Ancien', canDelete: rates.length > 1 }` ;
  - jours de présence, début, fin, sans fin, délai, retard ;
  - badge « Piste » / « À venir » / « En cours » ;
  - `path` = `firstInvoicePath(client, today)` formaté : « Tu factures le {shortDate(invoiceDate)} », « Échéance le {shortDate(dueDate)} », « L’argent arrive vers le {shortDate(cashDate)} », « Soit {waitDays} jours d’attente entre la fin du mois travaillé et l’argent sur ton compte. » ;
- `cashBars` : `billedVsCashed(input)` → colonnes empilées par client (couleurs `PALETTE`), au choix « Facturé » ou « Encaissé » ;
- `totals` : « {euros} facturés » et « {euros} encaissés » sur 12 mois.

- [ ] **Step 4: Implémenter les composants**

- `ClientsDesktop.vue` : porter `Clients.dc.html` dans l'ordre :
  - en-tête « Tes clients » avec le `kicker` et le bouton « Ajouter un client » (vers `/clients/new`) ;
  - carte « Tes missions dans le temps » : `MissionTimeline`, plus la case « Compter les pistes » qui appelle `updateProfile({ includeProspects })` ;
  - deux colonnes : `MissionTable` (sélection au clic et au clavier, Entrée/Espace, la ligne étant un `<tr>` avec `tabindex="0"` et `aria-selected`) et `MissionPanel` (`<section role="region" :aria-label="name">`) ;
  - carte « Ce qui rentre vraiment, mois par mois » : pastilles `SegmentedControl` Facturé / Encaissé, `StackedCashBars`, et la bulle du script.
- `MissionPanel.vue` : porter les lignes 107 à 160 de la maquette.
  - Bascule « Au temps passé / Forfait mensuel » : `SegmentedControl` qui appelle `updateClient({ billingMode })`. En repassant en TJM sans jours, poser `weekdays: [0]`.
  - `RateEditor` : valeur actuelle, historique avec badges, bouton poubelle (`aria-label` « Supprimer le tarif du {shortDate} ») absent quand `canDelete` est faux. Formulaire « Nouveau TJM (€) » ou « Nouveau forfait (€) », plus « À partir du » et « Ajouter », qui appelle `addRate`.
  - Jours de présence : `ChoiceChips` multiple L M M J V, `aria-label` = jour en toutes lettres, couleur client quand le jour est actif. Masqués en forfait.
  - Début, fin (`DateInput`) et `ToggleSwitch` « Mission sans date de fin ». Passer à « avec fin » propose `endDate` = début + 6 mois.
  - Délai de paiement : `ChoiceChips` simple sur les 5 délais.
  - Retard moyen : curseur de 0 à 30, libellé « aucun » ou « N jours ».
  - `InvoicePath` : les trois étapes `.step` reliées par des flèches `.arr`, et la phrase d'attente.
  - Bouton tertiaire « Supprimer ce client », avec `ConfirmDialog` danger, qui appelle `deleteClient`.
  - Chaque modification part immédiatement (champ par champ, au `change`). Le rejet `END_BEFORE_START` est affiché par le toast et l'état est rechargé.
  - Mode **création** (`clientId === 'new'`, titre « Nouveau client ») : formulaire local avec Nom du client, sous-titre, couleur (`nextColor`), mode, « TJM (€) » / « Forfait (€) », jours, début (défaut : 1er du mois courant), fin, délai (défaut `NET_30`), retard 0, case « Piste (pas encore signée) ». Le bouton « Créer la mission » appelle `createClient`, puis `navigateTo('/clients/' + id)`.

- [ ] **Step 5: Vérifier, puis commit**

Run : `npm run test:e2e -w @matreso/web -- clients.spec.ts --project=desktop`
Expected : PASS.
```bash
git add apps/web
git commit -m "feat(web): clients et missions desktop (frise, tableau, fiche, tarifs, chemin d'une facture)"
```

### Task 29: Missions mobile et fiche mission mobile

**Files:**
- Create : `apps/web/app/components/clients/{MissionsMobile,WeekTemplate,ClientCard,MissionDetailMobile}.vue`, `apps/web/e2e/missions-mobile.spec.ts`
- Modify : `apps/web/app/pages/clients/index.vue`, `apps/web/app/pages/clients/[id].vue`, `apps/web/app/pages/clients/new.vue` (bascule desktop/mobile)

**Interfaces:**
- Consumes : `weekTemplate`, `estimatedMonthly`, `estimatedDaysPerMonth`, `billedVsCashed`, `useClientsView`, `RateEditor`, `InvoicePath`, `treso.cycleWeekday`.
- Produces : écrans mobiles « Qui te fait vivre ? » et « Ta mission ».
- Sources : `Mobile-Missions.dc.html` (balisage l. 51 à 88, logique l. 89 à 115) et `Mobile-Client.dc.html` (balisage l. 51 à 103, logique l. 104 à 176).

- [ ] **Step 1: Écrire le test e2e** (projet mobile uniquement)

```ts
import { expect, test } from '@playwright/test';
import { fr, freshAccount } from './helpers';

test.skip(({ isMobile }) => !isMobile, 'version mobile');

test('cycles a weekday in the typical week', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  const monday = page.getByRole('button', { name: /^lundi/ });
  await expect(monday).toContainText('A');
  await monday.click();
  await expect(monday).toContainText('B');
  await monday.click();
  await expect(monday).toContainText('Libre');
});

test('opens a mission as a pushed screen with a back button', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/clients');
  await page.getByRole('link', { name: 'Modifier la mission Client A' }).click();
  await expect(page).toHaveURL(/\/clients\/.+/);
  await expect(page.getByRole('heading', { name: 'Ta mission' })).toBeVisible();
  await expect(page.getByText(fr('650 €/j')).first()).toBeVisible();
  await page.getByRole('link', { name: 'Retour' }).click();
  await expect(page).toHaveURL(/\/clients$/);
});
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm run test:e2e -w @matreso/web -- missions-mobile.spec.ts --project=mobile`
Expected : FAIL.

- [ ] **Step 3: Implémenter**

- `MissionsMobile.vue` : porter `Mobile-Missions.dc.html` :
  - H1 « Qui te fait vivre ? » ;
  - `WeekTemplate` ;
  - CA moyen mensuel recalculé (somme des `estimatedMonthly` des clients signés) ;
  - une `ClientCard` par client ;
  - bouton « Ajouter un client » vers `/clients/new`.
- `WeekTemplate.vue` : 5 grosses cases L à V (≥ 56 px). Chaque case affiche la lettre du client (dernier caractère de son nom, « A », ou ses initiales) sur sa couleur, ou « Libre ». Son `aria-label` vaut « lundi : Client A, toucher pour changer ». Au toucher, appeler `treso.cycleWeekday(weekday)`.
- `ClientCard.vue` :
  - bandeau couleur avec nom et TJM ;
  - « {estimatedDaysPerMonth} jours / mois » ou « Forfait » ;
  - « {euros(estimatedMonthly)} / mois », période, délai ;
  - lien « Modifier la mission » vers `/clients/{id}`, avec `aria-label` « Modifier la mission {name} ».
- `MissionDetailMobile.vue` : porter `Mobile-Client.dc.html` :
  - lien « Retour » vers `/clients` (avec `AppIcon arrow-left`, cible de 44 px) et H1 « Ta mission » ;
  - sélecteur des clients en `ChoiceChips` (initiales), qui navigue vers `/clients/{id}` ;
  - bandeau client ;
  - carte **Tarif** : mode, `RateEditor` ;
  - carte **Dates** : début, fin, interrupteur Sans date de fin ;
  - carte **Paiement** : 5 délais, retard, `InvoicePath` compact ;
  - « Encaissements » : mini-graphe sur 12 mois (`MiniBars` sur `cashedTotal` du client).
  - Mêmes actions du store que `MissionPanel`, en réutilisant `useClientsView`.
- Pages :
  - `clients/index.vue` affiche `ClientsDesktop` ou `MissionsMobile` ;
  - `clients/[id].vue` affiche `ClientsDesktop` avec ce client sélectionné, ou `MissionDetailMobile` ;
  - `clients/new.vue` affiche `ClientsDesktop` en création, ou `MissionDetailMobile` en mode création, avec le même formulaire que la Task 28.

- [ ] **Step 4: Vérifier, puis commit**

Run : `npm run test:e2e -w @matreso/web -- missions-mobile.spec.ts clients.spec.ts`
Expected : PASS (chaque spec ne tourne que sur son projet).
```bash
git add apps/web
git commit -m "feat(web): missions mobile (semaine type, fiches) et fiche mission poussée"
```

### Task 30: Calendrier et congés (desktop et mobile)

**Files:**
- Create : `apps/web/app/composables/useCalendarView.ts`, `apps/web/app/components/calendar/{CalendarDesktop,CalendarMobile,MonthCalendar,LeaveForm,LeavePeriods,MonthTable}.vue`, `apps/web/e2e/calendar.spec.ts`
- Modify : `apps/web/app/pages/calendar.vue`

**Interfaces:**
- Consumes : `calendarMonth`, `leaveKpis`, `monthResults` (avec l'option `includeProspects` pour la case « Compter la piste »), `groupLeaves`, `workingDaysBetween`, format, `STATE_STYLE`, `PALETTE`, `WEEKDAY_LONG`, actions `toggleLeave`, `addLeaves`, `deleteLeaves`.
- Produces : `useCalendarView()` → `{ monthIndex, months, monthLabel, prev, next, target, setTarget, targetOptions, days, kpis, alert, impactColumns, tableRows, periods, includeProspect, toggleProspect, addPeriod, lastMessage }`.
- Sources : `Calendrier.dc.html` (balisage l. 39 à 162, logique l. 163 à 307) et `Mobile-Conges.dc.html` (balisage l. 51 à 96, logique l. 97 à 216).

- [ ] **Step 1: Écrire le test e2e**

```ts
import { expect, test } from '@playwright/test';
import { fr, freshAccount } from './helpers';

test('poses and removes a leave by clicking a day', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/calendar');
  const days = page.getByTestId('kpi-days');
  await expect(days).toContainText('21');
  const cell = page.getByRole('button', { name: /^mercredi 14 octobre 2026/ });
  await cell.click();
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
  await expect(days).toContainText('22');
  await cell.click();
  await expect(cell).toHaveAttribute('aria-pressed', 'false');
  await expect(days).toContainText('21');
});

test('weekends and holidays are not clickable', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/calendar');
  await expect(page.getByRole('button', { name: /^samedi 10 octobre 2026/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Mois suivant' }).click();
  await expect(page.getByRole('button', { name: /^mercredi 11 novembre 2026/ })).toBeDisabled();
  await expect(page.getByText('Armistice')).toBeVisible();
});

test('adds a period with the form and shows its cost immediately', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/calendar');
  await page.getByLabel('Du', { exact: true }).fill('2027-02-15');
  await page.getByLabel('Au', { exact: true }).fill('2027-02-19');
  await page.getByRole('button', { name: 'Ajouter et simuler' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'jours ajoutés' })).toHaveText(fr('5 jours ajoutés : −3 200 € encaissés'));
  await expect(page.getByText('15 févr. → 19 févr.', { exact: false })).toBeVisible();
});

test('lists periods with their cost and impact months', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/calendar');
  await expect(page.getByText(fr('Se voit en janv. (−650 €), févr. (−2 400 €)'))).toBeVisible();
});
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm run test:e2e -w @matreso/web -- calendar.spec.ts`
Expected : FAIL.

- [ ] **Step 3: Implémenter le view-model**

`app/composables/useCalendarView.ts` :
- `months` : les 15 mois de `treso.results`. `monthIndex` démarre à 0.
- `target` : `{ scope: 'ALL' }` ou `{ scope: 'CLIENT', clientId }`. `targetOptions` = « Tous », puis un bouton par client TJM non archivé (son nom).
- `days` : `calendarMonth(input, months[monthIndex], target)` transformé pour la vue. Pour chaque jour :
  - `ariaLabel` = « {WEEKDAY_LONG} {jour} {monthName} {année} » suivi de « : Client A », « : vacances », « : Noël (férié) » ou « : week-end » ;
  - `pressed` = `targetLeave !== null` ;
  - `isLeave` = au moins un congé ce jour ;
  - couleurs des clients du jour, `holidayName`, `weekend`, `clickable`, `inMonth`.
- `kpis` : `leaveKpis(input, results)` formaté :
  - jours posés (`data-testid="kpi-days"`) ;
  - CA perdu « −X € » ;
  - point bas du solde « X € » avec « en {monthLabel} » ;
  - mois dans le rouge, avec le sous-titre « N à découvert », « N à cause des vacances », « à cause des délais » ou « aucun » (script l. 290 à 300). Les couleurs de fond suivent le script.
- `alert` : bandeau `role="status"` repris du script (l. 270 à 280) : découvert, sinon rouge à cause des vacances, sinon « … dans le rouge, même sans vacances, à cause des délais de paiement. Ton solde absorbe. », sinon positif.
- `impactColumns` : pour `LeaveImpactBars`, `without` = `resultWithoutLeaves`, `with` = `result`, et `highlight` si l'état vaut `RED_DUE_TO_LEAVES`.
- `includeProspect` : état local de la case « Compter la piste ». Quand il vaut vrai, utiliser `monthResults(input, { includeProspects: true })` pour les colonnes, le tableau et les KPI. Le profil n'est pas modifié.
- `tableRows` (« Mois par mois ») : par mois, encaissé sans congés, avec congés, coût des congés, charges, résultat, solde, et badge d'état (`STATE_STYLE`).
- `periods` : `treso.leavePeriods` formaté :
  - « {shortDate(from)} → {shortDate(to)} », ou une seule date ;
  - « {n} jour(s) · tous clients » ou « · {client} » ;
  - coût « −X € » ou « 0 € » ;
  - « Se voit en {monthShort} ({−X €}), … » (impacts dans l'ordre, séparés par des virgules) ;
  - suppression via `deleteLeaves(leaveIds)`.
- `addPeriod(from, to, target)` : appelle `treso.addLeaves`. En cas de succès, `lastMessage` = « {created} jour(s) ajouté(s) : −{euros(cost)} encaissés » ; si `created === 0`, « Ces jours étaient déjà posés. ».

- [ ] **Step 4: Implémenter les composants**

- `MonthCalendar.vue` : grille de 7 colonnes (L à D) portée de `Calendrier.dc.html` l. 72 à 88.
  - Chaque case est un `<button>` avec `aria-label`, `aria-pressed` et `disabled` si `!clickable`.
  - Contenu : barre ou fond de la couleur du client, « Vacances » sur fond `--sun` si congé, nom du férié, fond grisé le week-end, opacité réduite hors du mois.
  - Rayons 13 à 16 px. Taille ≥ 44 px sur mobile (les cases font `aspect-ratio: 1`, avec `min-height: 44px`).
  - Au clic : `treso.toggleLeave(date, target)`.
- `LeaveForm.vue` (« Poser des vacances ») :
  - `DateInput` Du / Au ;
  - `ChoiceChips` « Chez qui » (Tous et les clients TJM) ;
  - bouton principal « Ajouter et simuler » ;
  - message `role="status"` (`lastMessage`) ;
  - validation locale : « Au » doit être ≥ « Du ».
- `LeavePeriods.vue` : liste des périodes avec coût, mois d'impact et bouton poubelle (`aria-label` « Supprimer les vacances du … »).
- `MonthTable.vue` : tableau porté de la maquette l. 142 à 160. Sur desktop, il est dans un conteneur à défilement horizontal **interne** à la carte.
- `CalendarDesktop.vue` : ordre de la maquette :
  - H1 « Tes vacances, ta tréso » ;
  - quatre `KpiCard` ;
  - carte calendrier (`MonthStepper`, sélecteur « Poser chez : », `MonthCalendar`), avec à côté `LeaveForm` et `LeavePeriods` ;
  - carte « Ce que tes vacances font à chaque mois » : bandeau `alert`, `LeaveImpactBars`, case « Compter la piste » ;
  - `MonthTable`.
- `CalendarMobile.vue` : porter `Mobile-Conges.dc.html` :
  - H1 « Tes vacances » ;
  - bandeau d'alerte ;
  - 4 KPI en grille 2 × 2 ;
  - calendrier avec sélecteur Tous / A / B ;
  - « Mois par mois » avec `MiniBars` (mois concernés surlignés) et la liste des mois impactés ;
  - « Tes périodes » avec suppression ;
  - bouton « Poser des vacances » qui déplie `LeaveForm`.

- [ ] **Step 5: Vérifier, puis commit**

Run : `npm run test:e2e -w @matreso/web -- calendar.spec.ts`
Expected : PASS sur les deux projets.
```bash
git add apps/web
git commit -m "feat(web): calendrier et congés (pose au clic, périodes, impact mois par mois)"
```

### Task 31: Charges (desktop et mobile)

**Files:**
- Create : `apps/web/app/composables/useExpensesView.ts`, `apps/web/app/components/expenses/{ExpensesDesktop,ExpensesMobile,RemunerationCard,ChargesTable,ChargeForm}.vue`, `apps/web/e2e/expenses.spec.ts`
- Modify : `apps/web/app/pages/expenses.vue`

**Interfaces:**
- Consumes : `remunerationCost`, `remunerationComparison`, `LEGAL_STATUSES`, `LEGAL_STATUS_LABELS`, `REGIME_OF`, `remunerationLines`, `chargesSummary`, `monthlyEquivalent`, `paramsFor`, `ceilingGauge`, `MONTHS_LONG`, format, actions `updateProfile`, `addCharge`, `updateCharge`, `deleteCharge`.
- Produces : `useExpensesView()` → `{ statuses, status, setStatus, statusHelp, net, setNet, cost, comparison, microAlert, kpis, rows, periodMode, setPeriodMode, total }`.
- Sources : `Charges.dc.html` (balisage l. 39 à 123, logique l. 124 à 234) et `Mobile-Charges.dc.html` (balisage l. 51 à 82, logique l. 83 à 181).

- [ ] **Step 1: Écrire le test e2e**

```ts
import { expect, test } from '@playwright/test';
import { fr, freshAccount } from './helpers';

test('switching to EURL à l’IS lowers the cost from 7 200 € to 5 800 € (acceptance criterion)', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/expenses');
  await expect(page.getByText(fr('7 200 €')).first()).toBeVisible();
  await page.getByRole('button', { name: 'EURL à l’IS' }).click();
  await expect(page.getByRole('button', { name: 'EURL à l’IS' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(fr('5 800 €')).first()).toBeVisible();
  await expect(page.getByRole('row', { name: /Cotisations sociales/ })).toContainText(fr('1 800 €'));
  await expect(page.getByRole('row', { name: /Cotisations sociales/ })).toContainText('calculé');
});

test('adds, edits and deletes a charge', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/expenses');
  await page.getByLabel('Nom de la charge').fill('Coworking');
  await page.getByLabel('Montant', { exact: true }).fill('250');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  const row = page.getByRole('row', { name: /Coworking/ });
  await expect(row).toBeVisible();
  await row.getByLabel('Montant de Coworking').fill('300');
  await row.getByLabel('Montant de Coworking').blur();
  await page.reload();
  await expect(page.getByRole('row', { name: /Coworking/ }).getByLabel('Montant de Coworking')).toHaveValue('300');
  await page.getByRole('row', { name: /Coworking/ }).getByRole('button', { name: 'Supprimer Coworking' }).click();
  await expect(page.getByRole('row', { name: /Coworking/ })).toHaveCount(0);
});

test('a yearly charge asks for its month', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/expenses');
  await page.getByLabel('Nom de la charge').fill('Domaine');
  await page.getByLabel('Montant', { exact: true }).fill('15');
  await page.getByRole('button', { name: 'Annuelle' }).click();
  await page.getByLabel('Mois du prélèvement').selectOption({ label: 'mars' });
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page.getByRole('row', { name: /Domaine/ })).toContainText('Une fois par an');
});
```
(Les intitulés exacts des lignes, de la fréquence et des KPI suivent la maquette : vérifier `Charges.dc.html` l. 70 à 122 et ajuster **le composant**, pas le test, si un libellé diffère de ceux de ce test.)

- [ ] **Step 2: Vérifier l'échec**

Run : `npm run test:e2e -w @matreso/web -- expenses.spec.ts`
Expected : FAIL.

- [ ] **Step 3: Implémenter**

`useExpensesView.ts` :
- `statuses` : les 8 `LEGAL_STATUSES` avec `LEGAL_STATUS_LABELS`. `statusHelp` reprend les phrases d'aide par statut du script de `Charges.dc.html`.
- `net` : `profile.netPayMonthly`. `setNet(cents)` appelle `updateProfile({ netPayMonthly })` via un curseur de 0 à 8 000 € (pas de 50 €), avec un `MoneyInput` pour la saisie exacte.
- `cost` : `remunerationCost(net, status, paramsFor(currentYear))`, d'où l'équation « Net + Cotisations = {totalLabel} ».
- `comparison` : `remunerationComparison`, avec la ligne du régime courant mise en avant.
- `microAlert` : si le statut est MICRO et que `ceilingGauge(input, currentYear).level === 'OVER'`, afficher l'alerte rouge `role="status"` de la maquette.
- `kpis` : `chargesSummary(charges, profile, currentYear)`, soit la moyenne mensuelle (annuelles lissées) et le total annuel.
- `rows` :
  - d'abord les lignes calculées `remunerationLines`, en lecture seule avec la mention « calculé » ;
  - puis les charges stockées : nom, fréquence (« Chaque mois » ou « Une fois par an · {mois} »), montant éditable (`MoneyInput`, `aria-label` « Montant de {nom} »), montant mensualisé `monthlyEquivalent`, et bouton « Supprimer {nom} ».
- `periodMode` (mobile) : « Par mois » ou « Par an », qui change `total` et les montants affichés.

Composants :
- `RemunerationCard.vue` : porter la carte « Ta rémunération » (8 `ChoiceChips` de statut, phrase d'aide, curseur, équation, comparaison des 3 régimes, alerte micro, `EstimateNote`).
- `ChargesTable.vue` : le tableau porté de la maquette.
- `ChargeForm.vue` (« Ajouter une charge ») : nom (« Nom de la charge »), « Montant », Mensuelle / Annuelle (`SegmentedControl`), « Mois du prélèvement » (`<select>` des 12 mois) si annuelle, catégorie (`<select>` : Toi, Social, Impôts, Véhicule, Services, Outils, Banque, Assurance, Autre), bouton « Ajouter ».
- `ExpensesDesktop.vue` / `ExpensesMobile.vue` : ordre des maquettes. Sur mobile, la liste remplace le tableau (lignes `.row`) et le bouton « Ajouter une charge » déplie `ChargeForm`.

- [ ] **Step 4: Vérifier, puis commit**

Run : `npm run test:e2e -w @matreso/web -- expenses.spec.ts`
Expected : PASS.
```bash
git add apps/web
git commit -m "feat(web): charges et coût de la rémunération par statut juridique"
```

### Task 32: Profil

**Files:**
- Create : `apps/web/app/components/profile/ProfileView.vue`, `apps/web/e2e/profile.spec.ts`
- Modify : `apps/web/app/pages/profile.vue`

**Interfaces:**
- Consumes : `useAuthStore().{me, enablePasskey, disablePasskey, changePassword, logout, deleteAccount}`, `useTresoStore().{profile, balance, updateProfile, setBalance, exportData, importData}`, `ToggleSwitch`, `ConfirmDialog`, `MoneyInput`, `initials`.
- Source : `Mobile-Profil.dc.html` (balisage l. 51 à 67, logique l. 68 à 79). Sur desktop, le même contenu s'affiche dans une colonne de 640 px.

- [ ] **Step 1: Écrire le test e2e**

```ts
import { expect, test } from '@playwright/test';
import { freshAccount } from './helpers';

test('shows the account and toggles alerts', async ({ page }) => {
  const email = await freshAccount(page);
  await page.goto('/profile');
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText('GD').first()).toBeVisible();
  const alert = page.getByRole('switch', { name: 'Mois dans le rouge' });
  await alert.click();
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Mois dans le rouge' })).toHaveAttribute('aria-checked', 'false');
});

test('exports a JSON backup', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/profile');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter mes données' }).click();
  expect((await download).suggestedFilename()).toMatch(/^ma-treso-\d{4}-\d{2}-\d{2}\.json$/);
});

test('rejects an invalid import file', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/profile');
  await page.getByLabel('Importer une sauvegarde').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"foo":1}') });
  await page.getByRole('button', { name: 'Remplacer mes données' }).click();
  await expect(page.getByRole('status')).toContainText('Ce fichier n’est pas une sauvegarde Ma Tréso valide.');
});

test('logs out', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('deletes the account after confirmation', async ({ page }) => {
  await freshAccount(page);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Supprimer mon compte' }).click();
  await page.getByLabel('Mot de passe').fill('motdepasse1');
  await page.getByRole('button', { name: 'Supprimer définitivement' }).click();
  await expect(page).toHaveURL(/\/login$/);
});
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm run test:e2e -w @matreso/web -- profile.spec.ts`
Expected : FAIL.

- [ ] **Step 3: Implémenter**

Porter `Mobile-Profil.dc.html` :
- pastille d'initiales (« GD »), prénom en H1, e-mail ;
- **Mon compte** : société (champ texte qui appelle `updateProfile({ companyName })` au `change`), solde du compte (`MoneyInput` qui appelle `setBalance`) ;
- **Sécurité** :
  - `ToggleSwitch` « Face ID » : vrai si `me.hasPasskey` ; l'activation appelle `enablePasskey()` (une erreur ou une annulation produit un toast « Impossible d’activer Face ID sur cet appareil. »), la désactivation appelle `disablePasskey()` ;
  - interrupteur masqué si `window.PublicKeyCredential` est absent ;
  - bouton « Changer de mot de passe » qui ouvre un petit formulaire (actuel / nouveau) et appelle `changePassword` ;
- **Alertes** : `ToggleSwitch` « Mois dans le rouge » (`alertRedMonth`) et « Paiement en retard » (`alertLatePayment`), avec la mention « Les notifications arrivent bientôt : tes préférences sont gardées. » ;
- **Mes données** : bouton « Exporter mes données » (`exportData`), et `<label>` « Importer une sauvegarde » qui enveloppe un `<input type="file" accept="application/json">` visuellement caché. Une fois le fichier choisi, un `ConfirmDialog` « L’import remplace toutes tes données actuelles. » s'ouvre (`confirmLabel` « Remplacer mes données ») et sa confirmation appelle `importData(file)`. Ne jamais utiliser `window.confirm`, que Playwright annule automatiquement ;
- bouton secondaire « Se déconnecter » (`logout` puis `navigateTo('/login')`) ;
- bouton danger « Supprimer mon compte », qui ouvre un `ConfirmDialog` avec mot de passe, `confirmLabel` « Supprimer définitivement », et appelle `deleteAccount` puis `navigateTo('/login')`.

- [ ] **Step 4: Vérifier, puis commit**

Run : `npm run test:e2e -w @matreso/web -- profile.spec.ts`
Expected : PASS.
```bash
git add apps/web
git commit -m "feat(web): profil (compte, Face ID, alertes, export/import, suppression)"
```

### Task 33: PWA

**Files:**
- Modify : `apps/web/nuxt.config.ts`, `apps/web/package.json`
- Create : `apps/web/public/icons/{icon-192.png,icon-512.png,maskable-512.png}` (générées depuis `favicon.svg`), `apps/web/e2e/pwa.spec.ts`

**Interfaces:**
- Produces : manifest `/manifest.webmanifest` et service worker `/sw.js`, qui précache les assets mais pas `/api`.

- [ ] **Step 1: Écrire le test e2e**

```ts
import { expect, test } from '@playwright/test';

test.skip(!process.env.E2E_BASE_URL, 'le service worker n’est généré qu’au build : test lancé contre l’image (Task 34)');

test('exposes an installable manifest', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest).toMatchObject({ name: 'Ma Tréso', short_name: 'Ma Tréso', display: 'standalone', theme_color: '#1F1A2E', background_color: '#FFF7EC', lang: 'fr' });
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 2: Implémenter**

```bash
npm i -D -w @matreso/web @vite-pwa/nuxt
```
Dans `nuxt.config.ts`, ajouter `'@vite-pwa/nuxt'` aux modules et :
```ts
pwa: {
  registerType: 'autoUpdate',
  manifest: {
    name: 'Ma Tréso', short_name: 'Ma Tréso', lang: 'fr', start_url: '/', display: 'standalone',
    theme_color: '#1F1A2E', background_color: '#FFF7EC',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: { navigateFallback: '/', navigateFallbackDenylist: [/^\/api\//], globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
  devOptions: { enabled: false },
},
```
Générer les PNG depuis `favicon.svg` avec un script Node ponctuel utilisant `sharp` (`npx --yes sharp-cli` ou équivalent), puis committer les images. Ne pas ajouter `sharp` aux dépendances.

**Repli** si `@vite-pwa/nuxt` échoue au build avec Nuxt 4.5 : retirer le module, écrire `public/manifest.webmanifest` (mêmes champs) et un `public/sw.js` minimal (cache-first sur `/_nuxt/*` et les icônes, réseau seul pour `/api`, `navigate` en réseau avec repli sur `/` en cache), l'enregistrer dans un plugin `app/plugins/sw.client.ts` (`navigator.serviceWorker.register('/sw.js')` hors dev), et ajouter `<link rel="manifest">` dans `app.head`.

- [ ] **Step 3: Vérifier, puis commit**

Run : `npm run build -w @matreso/web` puis `ls apps/web/.output/public`
Expected : `manifest.webmanifest` et `sw.js` présents.
```bash
git add apps/web package-lock.json
git commit -m "feat(web): PWA installable (manifest, service worker, icônes)"
```

---

# Phase 4 — Livraison

### Task 34: Image Docker, compose et Playwright contre le build de production

**Files:**
- Create : `Dockerfile`, `.dockerignore`, `apps/web/e2e/mobile.spec.ts`, `scripts/e2e-prod.mjs`
- Modify : `docker-compose.yml` (service `app`), `package.json` racine (script `e2e:prod`)

**Interfaces:**
- Consumes : builds des trois workspaces, `WEB_DIST` (Task 20).
- Produces : image `ma-treso` qui écoute sur 3000, sert `/api` et le front, joue les migrations au démarrage et expose un `HEALTHCHECK`.

- [ ] **Step 1: Écrire le test mobile transverse**

`apps/web/e2e/mobile.spec.ts` :
```ts
import { expect, test } from '@playwright/test';
import { freshAccount } from './helpers';

test.skip(({ isMobile }) => !isMobile, 'contrôles 390 px');

for (const path of ['/', '/clients', '/calendar', '/expenses', '/profile', '/clients/new']) {
  test(`no horizontal scroll and 44 px targets on ${path}`, async ({ page }) => {
    await freshAccount(page);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);
    for (const el of await page.locator('button:visible, [role="switch"]:visible, .chip:visible').all()) {
      const box = await el.boundingBox();
      if (!box) continue;
      expect.soft(box.height, await el.getAttribute('aria-label') ?? await el.innerText()).toBeGreaterThanOrEqual(44);
      expect.soft(box.width, await el.getAttribute('aria-label') ?? await el.innerText()).toBeGreaterThanOrEqual(44);
    }
  });
}

test('the login screen fits 390 px', async ({ page }) => {
  await page.goto('/login');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
```
Run : `npm run test:e2e -w @matreso/web -- mobile.spec.ts --project=mobile`
Expected : PASS. Corriger les composants fautifs s'il y a des échecs (« soft »).

- [ ] **Step 2: Dockerfile**

`.dockerignore` :
```
**/node_modules
**/dist
**/.output
**/.nuxt
**/coverage
**/playwright-report
**/test-results
.git
.claude
design.zip
.env
```

`Dockerfile` :
```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
RUN npm run build -w @matreso/engine \
 && (cd apps/web && npx nuxt prepare) \
 && npm run build -w @matreso/web \
 && npm run build -w @matreso/api

FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --ignore-scripts -w @matreso/api -w @matreso/engine

FROM node:24-alpine AS runtime
ENV NODE_ENV=production PORT=3000 WEB_DIST=/app/web
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/packages/engine/package.json ./packages/engine/package.json
COPY --from=build /app/packages/engine/dist ./packages/engine/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=build /app/apps/web/.output/public ./web
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
```
Note : `node_modules/@matreso/engine` est un lien symbolique de workspace vers `packages/engine`, recréé par `npm ci` dans `prod-deps`. Vérifier qu'il résout bien vers `/app/packages/engine/dist` dans l'image (`docker run --rm ma-treso node -e "import('@matreso/engine').then(m => console.log(Object.keys(m).length))"`).

- [ ] **Step 3: Compose**

Ajouter à `docker-compose.yml` :
```yaml
  app:
    build: .
    image: ma-treso
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgres://matreso:matreso@db:5432/matreso
      SESSION_SECRET: ${SESSION_SECRET:-change-me-change-me-change-me}
      WEBAUTHN_RP_ID: ${WEBAUTHN_RP_ID:-localhost}
      WEBAUTHN_ORIGIN: ${WEBAUTHN_ORIGIN:-http://localhost:3000}
      COOKIE_SECURE: ${COOKIE_SECURE:-false}
      SEED_DEMO: ${SEED_DEMO:-true}
      SEED_DEMO_PASSWORD: ${SEED_DEMO_PASSWORD:-demo1234}
      AUTH_RATE_LIMIT: ${AUTH_RATE_LIMIT:-10}
    ports:
      - "${APP_PORT:-3000}:3000"
```
- [ ] **Step 4: e2e contre le build de production, en local et sans Docker**

Créer `scripts/e2e-prod.mjs`, avec le script racine `"e2e:prod": "node scripts/e2e-prod.mjs"`. Le script Node doit, sans dépendance ajoutée :
1. lancer `npm run build` à la racine (`child_process.spawnSync`, `stdio: 'inherit'`, `shell: true`) ;
2. démarrer `node apps/api/dist/main.js` (`spawn`) avec l'environnement `NODE_ENV=production`, `PORT=3100`, `DATABASE_URL=pglite:memory`, `SESSION_SECRET=e2e-prod-secret-e2e-prod-secret`, `WEB_DIST=<chemin absolu de apps/web/.output/public>`, `SEED_DEMO=true`, `COOKIE_SECURE=false`, `AUTH_RATE_LIMIT=10000`, `WEBAUTHN_ORIGIN=http://localhost:3100` ;
3. attendre que `GET http://localhost:3100/api/health` réponde 200 (boucle `fetch`, 60 s au plus) ;
4. lancer `npx playwright test` dans `apps/web`, avec `E2E_BASE_URL=http://localhost:3100` ;
5. arrêter le serveur dans tous les cas (`finally`) et renvoyer le code de sortie de Playwright.

Run :
```bash
node scripts/e2e-prod.mjs
```
Expected : toute la suite Playwright PASS contre l'API qui sert le front construit (même topologie que l'image : un process, un port), y compris `pwa.spec.ts` et le repli SPA.

- [ ] **Step 5: Vérifier l'image Docker (si le démon Docker est disponible)**

Run (seulement si `docker info` répond) :
```bash
docker compose build app
docker compose up -d app
curl -fsS http://localhost:3000/api/health
curl -fsS http://localhost:3000/ | grep -o '<title>[^<]*'
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:3000/calendar
docker compose down
```
Expected : `{"status":"ok","db":"ok"}`, `<title>Ma Tréso`, `200`. Si Docker n'est pas disponible, l'indiquer dans le rapport (statut DONE_WITH_CONCERNS) sans bloquer la tâche.

- [ ] **Step 6: Commit**

```bash
git add Dockerfile .dockerignore docker-compose.yml package.json scripts apps/web/e2e/mobile.spec.ts
git commit -m "build: image Docker unique (API + front), compose et e2e sur le build de production"
```

### Task 35: README et vérification finale

**Files:**
- Modify : `README.md`

- [ ] **Step 1: README**

Réécrire `README.md` (en français) avec :
- une phrase de présentation ;
- une capture des parcours (optionnel) ;
- **Démarrer en local** (sans Docker) : prérequis (Node 24), `npm install`, `cp .env.example .env` (optionnel : par défaut, PGlite dans `apps/api/.data/pglite`), `npm run dev`, ouvrir http://localhost:3000, compte de démo `demo@matreso.fr` / `demo1234` ;
- **Tests** : moteur (`npm run test -w @matreso/engine`, couverture ≥ 90 %), API (`npm run test -w @matreso/api`), e2e en dev (`npm run test:e2e -w @matreso/web`), e2e sur le build de production (`npm run e2e:prod`), le tout sans Docker grâce à PGlite ;
- **Déployer** : `docker build -t ma-treso .`, puis le tableau des variables d'environnement (repris de `.env.example`, avec obligatoire/défaut). En production : `SESSION_SECRET` long et aléatoire, `COOKIE_SECURE=true` derrière HTTPS, `WEBAUTHN_RP_ID` = domaine exact, `WEBAUTHN_ORIGIN` = `https://domaine`, `SEED_DEMO=false` ;
- **Architecture** : schéma texte des trois workspaces et rôle de chacun ;
- **Limites v1** : paramètres réglementaires approximatifs (SPEC §9.1), pas de TVA, pas d'envoi d'e-mail.

- [ ] **Step 2: Vérification finale complète**

Suivre le skill `superpowers:verification-before-completion`. Run :
```bash
npm run test -w @matreso/engine
npm run typecheck -w @matreso/engine
npm run test -w @matreso/api
npm run typecheck -w @matreso/api
npm run typecheck -w @matreso/web
npm run build
npm run e2e:prod
```
Expected : tout passe. Relire la table « Correspondance avec les critères d'acceptation » de la spec (§7) et cocher chaque ligne avec le test qui la prouve. Tout écart est corrigé avant de conclure, ou signalé explicitement.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README (démarrage, tests, déploiement Docker, architecture)"
```
