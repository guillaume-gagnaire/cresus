# Cresus (caisse de buvette) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer Ma Tréso par Cresus, un compteur de ventes pour buvettes d'APE (un appui = une vente), avec évènements, articles à pictos automatiques, hors ligne, bilan et export Excel, déployé sur cresus.gagnaire.dev.

**Architecture:** Monorepo npm : `@cresus/shared` (types d'API + catalogue de pictos et appariement, compilé en `dist/`), `@cresus/api` (NestJS + Drizzle, PGlite en dev/tests, PostgreSQL en prod, sert aussi le front) et `@cresus/web` (Nuxt 4 SPA + Pinia + PWA). Les ventes passent par une file locale (localStorage) envoyée à `POST /api/events/:id/sync`, idempotente.

**Tech Stack:** Node 24, TypeScript 5.9, NestJS 12, Drizzle 0.45, PGlite 0.5, pg, zod 4, @node-rs/argon2, exceljs 4, Nuxt 4, Pinia, @vite-pwa/nuxt, Vitest 5, Playwright, @iconify-json/fluent-emoji (dev, MIT).

**Spec:** `docs/superpowers/specs/2026-11-15-cresus-caisse-design.md`

**Référence technique :** l'ancienne appli est sur `origin/escouade/dev-full-app` (`git show origin/escouade/dev-full-app:<chemin>`). Ses briques d'infrastructure sont reprises en les renommant (`@matreso/*` → `@cresus/*`, `users` → `accounts`, `userId` → `accountId`), sans OAuth/MCP/passkeys/seed : `apps/api/src/{bootstrap,config,main}.ts`, `src/db/{client,migrate,db.module}.ts`, `src/common/*`, `src/auth/{password,cookies,session.service,session.guard}.ts`, `src/front/front.service.ts`, `test/helpers.ts`, `vitest.config.ts`, les `tsconfig*`, `apps/web/playwright.config.ts`, `Dockerfile`, `docker-compose.yml`, `scripts/e2e-prod.mjs`.

## Global Constraints

- Node `>=24.11` ; npm workspaces ; paquets `@cresus/shared`, `@cresus/api`, `@cresus/web`.
- Toute l'interface et tous les messages d'erreur en français, au vouvoiement (choix du constructeur).
- Argent en centimes entiers ; prix d'article de 0 à 99 999 centimes ; affichage `Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })`.
- Date d'évènement `YYYY-MM-DD` ; heures affichées et exportées en `Europe/Paris`.
- Erreurs d'API : `{ statusCode, code, message }` ; un objet d'un autre compte répond 404 `NOT_FOUND`.
- Mutations sous `/api` : `Content-Type: application/json` obligatoire (415 sinon).
- Session : cookie `cresus_session`, `httpOnly`, `SameSite=Lax`, `Secure` en production, durée 180 jours glissante ; seul le hash SHA-256 du jeton est stocké.
- Nom d'article 1–40 caractères (après trim), nom d'asso 1–60, nom d'évènement 1–60, mot de passe 8–200.
- Pictos : clés = noms Fluent Emoji (ex. `pancakes`), fichiers `apps/web/public/pictos/<clé>.svg`, picto générique `label` ; affichés par `<img>`, jamais insérés dans le DOM.
- Pas d'envoi d'email, pas d'OAuth/MCP, pas de passkeys.

## Review Focus

- **Rush à l'ouverture de la kermesse** : 20 bénévoles se connectent depuis le même wifi d'école en une minute → aucun n'est bloqué (limite de débit à 30 requêtes/min/IP sur `/api/auth/*`) ; test dans la tâche 3.
- **Article ou évènement supprimé pendant que des ventes attendent sur un téléphone** → la file ne reste pas bloquée : `sync` rejette l'opération inconnue (liste `rejected`) sans échouer le lot, et le client abandonne les opérations d'un évènement qui répond 404 ; tests dans les tâches 5 et 8.
- **Horloge du téléphone fausse** (vente datée de plusieurs jours dans le futur) → la vente est comptée, avec l'heure de réception ; test dans la tâche 5.
- **Envoi rejoué** (réponse perdue, nouvel essai) ou appuis très rapides → chaque appui compte exactement une fois ; tests dans les tâches 5 et 8.
- **Session expirée avec des ventes en attente** → les ventes restent sur le téléphone et partent après reconnexion au même compte, jamais vers un autre compte ; test dans la tâche 8.

Écart assumé avec la spec §6 (« le serveur refuse une heure de plus d'un jour dans le futur ») : refuser ferait perdre la vente ; le serveur la garde avec l'heure de réception. La spec est mise à jour dans la tâche 1.

---

## Contrats partagés (`@cresus/shared`)

```ts
// packages/shared/src/dto.ts
export interface ApiErrorBody { statusCode: number; code: string; message: string }
export interface AccountDto { id: string; email: string; name: string }
export interface EventDto { id: string; name: string; date: string; salesCount: number; revenueCents: number; createdAt: string }
export interface ArticleDto { id: string; eventId: string; name: string; priceCents: number; picto: string | null; position: number; onSale: boolean; archived: boolean }
export interface ArticleTotals { articleId: string; count: number; revenueCents: number }
export interface HourBucket { hour: string /* 'YYYY-MM-DDTHH:00' heure de Paris */; count: number; revenueCents: number }
export interface SummaryDto { eventId: string; salesCount: number; revenueCents: number; articles: ArticleTotals[]; byHour: HourBucket[] }
export interface EventDetailDto { event: EventDto; articles: ArticleDto[] /* archivés compris, triés par position */; summary: SummaryDto }
export type SyncOp =
  | { op: 'sale'; id: string /* uuid v4 client */; articleId: string; priceCents: number; soldAt: string /* ISO */ }
  | { op: 'void'; id: string };
export interface SyncRequest { ops: SyncOp[] /* 1..500 */ }
export interface SyncResponse { applied: number; rejected: string[] /* ids */; summary: SummaryDto }
export interface SaleDto { id: string; articleId: string; articleName: string; priceCents: number; soldAt: string }
export interface SalesPageDto { sales: SaleDto[]; next: string | null /* curseur opaque */ }

// packages/shared/src/pictos.ts
export type PictoCategory = 'sucre' | 'sale' | 'boisson' | 'fruit' | 'kermesse' | 'vente' | 'divers';
export interface Picto { key: string; label: string; category: PictoCategory; keywords: string[] }
export const PICTOS: readonly Picto[];
export const FALLBACK_PICTO = 'label';
export function normalizeText(text: string): string;          // minuscules, sans accents (œ→oe, æ→ae), ponctuation et apostrophes → espace, espaces fusionnés, trim
export function matchPicto(name: string): string;             // clé ; FALLBACK_PICTO si rien
export function searchPictos(query: string): Picto[];          // vide → tous ; sinon chaque mot de la requête est le début d'un mot du libellé ou d'un mot-clé
export function resolvePicto(a: { name: string; picto: string | null }): string; // picto choisi s'il existe dans PICTOS, sinon matchPicto(name)
export function pictoCategory(key: string): PictoCategory;     // 'divers' si inconnue
export const pictoUrl: (key: string) => string;                // `/pictos/${key}.svg`

// packages/shared/src/money.ts
export function formatEuros(cents: number): string;            // « 2,50 € » (fr-FR, espace insécable comprise)
export function parseEuros(input: string): number | null;      // « 2,5 », « 2.50 », « 2 € » → 250 ; invalide/négatif/>999,99 → null
```

---

### Task 1: Monorepo et `@cresus/shared` (pictos, types, argent)

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `.gitignore`, `.nvmrc`, `.dockerignore`, `.env.example`
- Create: `packages/shared/{package.json,tsconfig.json,vitest.config.ts}`, `packages/shared/src/{index,dto,pictos,money}.ts`
- Create: `scripts/build-pictos.mjs`, `apps/web/public/pictos/*.svg`, `apps/web/public/pictos/LICENSE.txt`
- Modify: `docs/superpowers/specs/2026-11-15-cresus-caisse-design.md` (§6, heure future), `README.md` (titre et une phrase, complété en tâche 10)
- Test: `packages/shared/test/{pictos,money}.test.ts`

**Interfaces:**
- Produces: tout le bloc « Contrats partagés » ci-dessus ; `npm run build -w @cresus/shared` écrit `dist/` (JS + `.d.ts`) ; `package.json` du paquet : `"main": "dist/index.js"`, `"types": "dist/index.d.ts"`, `"type": "module"`.
- Racine : scripts `build` (shared → web → api), `dev` (build shared puis api + web en parallèle via `concurrently`), `test` (tous les workspaces), `e2e:prod`, `pictos` (`node scripts/build-pictos.mjs`).

- [ ] **Step 1: Écrire les tests qui échouent** (`packages/shared/test/pictos.test.ts`, `money.test.ts`)

```ts
it.each([
  ['Crêpe Nutella', 'pancakes'], ['crepes au sucre', 'pancakes'], ['Gaufre', 'waffle'],
  ['Jus de pomme', 'beverage-box'], ['Gâteau au chocolat', 'shortcake'], ['Pain au chocolat', 'croissant'],
  ['Chocolat chaud', 'hot-beverage'], ['Hot-dog', 'hot-dog'], ['hot dog', 'hot-dog'], ['Barquette de frites', 'french-fries'],
  ['Coca', 'cup-with-straw'], ['Bière', 'beer-mug'], ['Verre de rosé', 'wine-glass'], ['Café', 'hot-beverage'],
  ['Eau', 'droplet'], ['Ticket tombola', 'admission-tickets'], ['Pêche à la ligne', 'fishing-pole'], ['Pêches', 'peach'],
  ['Barbe à papa', 'lollipop'], ['Croque-monsieur', 'sandwich'], ['Œuf', 'egg'], ['Sachet de bonbons', 'candy'],
  ['Galette des rois', 'crown'], ['Brioche', 'bread'], ['Sapin de Noël', 'christmas-tree'], ['Truc inconnu', 'label'], ['', 'label'],
])('matchPicto(%s) = %s', (name, key) => expect(matchPicto(name)).toBe(key));
it('aucun mot-clé (normalisé, singulier) ne désigne deux pictos', …);
it('chaque picto a un fichier apps/web/public/pictos/<clé>.svg', …);
it('resolvePicto garde un picto choisi connu, ignore une clé inconnue', …);
it('searchPictos("bois") contient beer-mug et cup-with-straw ; searchPictos("") renvoie tout', …);
it.each([['2,5', 250], ['2.50', 250], ['2 €', 200], ['0', 0], ['999,99', 99999], ['-1', null], ['1000', null], ['abc', null], ['1,234', null]])('parseEuros', …);
it('formatEuros(250) === "2,50 €"', …);
```

- [ ] **Step 2: Lancer les tests, constater l'échec** — `npm run test -w @cresus/shared` → FAIL (modules absents).

- [ ] **Step 3: Implémenter `pictos.ts`, `money.ts`, `dto.ts`, `index.ts`**

Catalogue d'environ 120 pictos dans l'esprit de la spec §5 (libellé français, catégorie, mots-clés au singulier avec synonymes et marques). Appariement :
```
mots(nom) = normalizeText(nom).split(' ') puis singulier(m) = m.length > 3 && /[sx]$/.test(m) ? m.slice(0, -1) : m
index = pour chaque mot-clé de chaque picto : sa suite de mots singularisés → clé
correspondances = toutes les suites de l'index présentes de façon contiguë dans mots(nom)
gagnant = plus grand nombre de mots, puis position de départ la plus petite, puis ordre du catalogue
```

- [ ] **Step 4: Écrire `scripts/build-pictos.mjs`** — lit `@iconify-json/fluent-emoji/icons.json` (devDependency racine), importe `PICTOS` depuis `packages/shared/dist`, écrit `<svg xmlns="http://www.w3.org/2000/svg" viewBox="<left> <top> <width> <height>">body</svg>` (dimensions de l'icône, sinon celles du jeu, 32 par défaut) pour chaque clé, échoue si une clé manque, supprime les SVG qui ne sont plus au catalogue, écrit `LICENSE.txt` (texte MIT, « Copyright (c) Microsoft Corporation », source https://github.com/microsoft/fluentui-emoji). Lancer `npm run build -w @cresus/shared && npm run pictos`.

- [ ] **Step 5: Lancer les tests** — `npm run test -w @cresus/shared` → PASS ; `npm run typecheck -w @cresus/shared` → OK.

- [ ] **Step 6: Commit** — `feat(shared): catalogue de pictos Fluent Emoji, appariement par nom, types d'API`

---

### Task 2: Socle de l'API (config, base, schéma, santé, front servi)

**Files:**
- Create: `apps/api/{package.json,tsconfig.json,tsconfig.build.json,vitest.config.ts,drizzle.config.ts,.env.e2e}`
- Create: `apps/api/src/{main,bootstrap,config,app.module}.ts`, `src/db/{client,migrate,db.module,schema}.ts`, `src/common/{app-error,error.filter,zod.pipe,rate-limit.guard,security-headers.middleware,json-only.middleware,current-account.decorator,public.decorator,pg-errors}.ts`, `src/health/health.controller.ts`, `src/front/front.service.ts`
- Create: `apps/api/drizzle/0000_*.sql` (+ `meta/`) via `npm run db:generate -w @cresus/api`
- Test: `apps/api/test/{helpers,health.e2e,hardening.e2e}.test.ts` (helpers.ts n'est pas un test)

**Interfaces:**
- Config (`loadConfig(env)`) : `NODE_ENV`, `PORT` (3001 dev), `DATABASE_URL` (défaut `pglite:./.data/pglite`, obligatoire en production), `SESSION_SECRET` (≥ 16, obligatoire en production), `COOKIE_SECURE`, `WEB_DIST`, `AUTH_RATE_LIMIT` (défaut **30**).
- Schéma Drizzle :
  - `accounts(id uuid pk defaultRandom, email text unique not null, name text not null, password_hash text not null, created_at timestamptz default now)`
  - `sessions(id text pk /*sha256*/, account_id uuid → accounts cascade, expires_at timestamptz, created_at)`
  - `events(id uuid pk, account_id → accounts cascade, name text, date date mode string, created_at)` index `(account_id, date)`
  - `articles(id uuid pk, event_id → events cascade, name text, price_cents integer, picto text null, position integer, on_sale boolean default true, archived_at timestamptz null, created_at)`
  - `sales(id uuid pk /*client*/, event_id → events cascade, article_id → articles cascade, price_cents integer, sold_at timestamptz, received_at timestamptz default now, voided_at timestamptz null)` index `(event_id, sold_at)`
- Produces : `DB` (token Nest), `type Db`, `AppError`, `notFound(what)`, `ZodPipe`, `parseWith`, `RateLimitGuard`, `Public()`, `CurrentAccount()` (id du compte), `AuthedRequest { accountId?, sessionToken? }`, `setupTestApp(overrides?)`, `resetDb(app)` (TRUNCATE des 5 tables), `agentFor(app)`.
- `GET /api/health` → `200 { status: 'ok' }` (public).

- [ ] **Step 1: Tests qui échouent** — `health.e2e.test.ts` : `GET /api/health` → 200 `{ status: 'ok' }` ; `hardening.e2e.test.ts` : en-têtes `X-Content-Type-Options: nosniff` et `X-Frame-Options: DENY` sur `/api/health` ; `POST /api/auth/login` en `text/plain` → 415 `JSON_REQUIRED` ; route inconnue `/api/nope` → 404 JSON `NOT_FOUND` ; `loadConfig({ NODE_ENV: 'production' })` lève une erreur qui mentionne `SESSION_SECRET`, puis (avec secret) `DATABASE_URL`.
- [ ] **Step 2: Lancer** — `npm run test -w @cresus/api` → FAIL.
- [ ] **Step 3: Implémenter** en reprenant les fichiers de référence (sans OAuth/MCP/seed), schéma ci-dessus, migration générée.
- [ ] **Step 4: Lancer** — `npm run test -w @cresus/api` et `npm run typecheck -w @cresus/api` → PASS.
- [ ] **Step 5: Commit** — `feat(api): socle NestJS, schéma Drizzle et santé`

---

### Task 3: Compte de l'asso (inscription, connexion, réglages, CLI)

**Files:**
- Create: `apps/api/src/auth/{auth.module,auth.controller,auth.service,account.controller,password,cookies,session.service,session.guard}.ts`, `src/cli/reset-password.ts`
- Test: `apps/api/test/{auth,account}.e2e.test.ts`

**Interfaces:**
- `POST /api/auth/signup { name, email, password }` → 201 `AccountDto` + cookie ; email trim + minuscules ; doublon → 409 `EMAIL_TAKEN` « Un compte existe déjà avec cet email. »
- `POST /api/auth/login { email, password }` → 200 `AccountDto` + cookie ; échec → 401 `INVALID_CREDENTIALS` « Email ou mot de passe incorrect. »
- `POST /api/auth/logout` → 204 ; `GET /api/auth/me` → `AccountDto` ou 401 `UNAUTHENTICATED`.
- `PATCH /api/account { name }` → `AccountDto`.
- `POST /api/account/password { currentPassword, newPassword }` → 204 ; mauvais mot de passe actuel → 401 ; supprime les autres sessions du compte, garde la courante.
- `DELETE /api/account { password }` → 204 ; supprime le compte (cascade) et efface le cookie.
- `RateLimitGuard` sur signup, login, password.
- CLI `node dist/cli/reset-password.js <email>` (script npm `reset-password`) : génère un mot de passe de 12 caractères lisibles, le hache, supprime toutes les sessions du compte, l'affiche ; email inconnu → code de sortie 1. Fonction testable `resetPassword(db, email): Promise<string>` exportée par `src/cli/reset-password-core.ts`.

- [ ] **Step 1: Tests qui échouent** — inscription → `me` renvoie `{ email: 'ape@ecole.fr', name: 'APE Jules Ferry' }` (email saisi `  APE@Ecole.fr `) ; doublon 409 ; connexion mauvais mot de passe 401 ; déconnexion → `me` 401 ; mot de passe de 7 caractères → 400 avec message « au moins 8 caractères » ; changement de mot de passe : l'agent A reste connecté, l'agent B (autre session) reçoit 401, l'ancien mot de passe ne marche plus ; suppression du compte avec mauvais mot de passe → 401, bon → 204 puis connexion impossible ; **rush** : avec la configuration par défaut (`AUTH_RATE_LIMIT` non surchargé), 25 connexions réussies d'affilée depuis la même IP → toutes 200, la 31e requête dans la minute → 429 ; `resetPassword` renvoie un mot de passe qui permet de se connecter et coupe les sessions existantes.
- [ ] **Step 2: Lancer** — FAIL.
- [ ] **Step 3: Implémenter** (références : `auth.controller.ts`, `auth.service.ts`, `session.*`, `cookies.ts` avec `SESSION_COOKIE = 'cresus_session'`, `SESSION_TTL_MS = 180 jours`).
- [ ] **Step 4: Lancer** — PASS + typecheck.
- [ ] **Step 5: Commit** — `feat(api): compte de l'asso (inscription, connexion, mot de passe, suppression)`

---

### Task 4: Évènements et articles

**Files:**
- Create: `apps/api/src/events/{events.module,events.controller,events.service,articles.controller,articles.service,summary.service,mappers}.ts`
- Test: `apps/api/test/{events,articles}.e2e.test.ts`

**Interfaces:**
- `GET /api/events` → `EventDto[]` (date décroissante, puis création décroissante) avec `salesCount`/`revenueCents` hors ventes annulées.
- `POST /api/events { name, date, copyFromEventId? }` → 201 `EventDto` ; la copie reprend les articles non archivés (nom, prix, picto, ordre) avec `onSale: true` ; `copyFromEventId` d'un autre compte → 404.
- `GET /api/events/:id` → `EventDetailDto` ; `PATCH /api/events/:id { name?, date? }` → `EventDto` ; `DELETE /api/events/:id` → 204.
- `POST /api/events/:id/articles { name, priceCents, picto?: string | null }` → 201 `ArticleDto` en dernière position ; `picto` : `null` ou `/^[a-z0-9-]{1,40}$/`.
- `PATCH /api/events/:id/articles/:articleId { name?, priceCents?, picto?, onSale? }` → `ArticleDto`.
- `PUT /api/events/:id/articles/order { ids }` → `ArticleDto[]` ; `ids` doit être exactement l'ensemble des articles non archivés, sinon 400 `ORDER_MISMATCH`.
- `DELETE /api/events/:id/articles/:articleId` → 204 ; avec au moins une vente non annulée : archivé (`archived: true`, reste dans `GET /api/events/:id`) ; sinon supprimé.
- `SummaryService.summary(eventId): Promise<SummaryDto>` (utilisé aussi en tâches 5 et 6) : agrégats hors ventes annulées ; `byHour` groupé par `to_char(date_trunc('hour', sold_at AT TIME ZONE 'Europe/Paris'), 'YYYY-MM-DD"T"HH24:00')`, trié.
- `EventsService.requireEvent(accountId, eventId)` → ligne d'évènement ou 404 (utilisé par toutes les routes `/events/:id/...`).

- [ ] **Step 1: Tests qui échouent** — création + liste triée ; copie depuis un évènement (3 articles dont 1 archivé et 1 « épuisé ») → 2 articles, tous en vente, même ordre ; isolation : le compte B reçoit 404 sur GET/PATCH/DELETE de l'évènement et des articles de A, et sa liste est vide ; validation (nom vide, date `2026-13-01`, prix -1 ou 100000, picto `Pizza!`) → 400 ; réordonnancement OK et `ORDER_MISMATCH` ; suppression d'un article sans vente → absent du détail ; avec vente → `archived: true` ; suppression de l'évènement → 404 ensuite.
- [ ] **Step 2: Lancer** — FAIL.
- [ ] **Step 3: Implémenter.**
- [ ] **Step 4: Lancer** — PASS + typecheck.
- [ ] **Step 5: Commit** — `feat(api): évènements et articles`

---

### Task 5: Ventes (sync idempotent, résumé, historique)

**Files:**
- Create: `apps/api/src/events/{sales.controller,sales.service}.ts`
- Test: `apps/api/test/sales.e2e.test.ts`

**Interfaces:**
- `POST /api/events/:id/sync SyncRequest` → 200 `SyncResponse`. Opérations appliquées dans l'ordre, en une transaction. `sale` : article de cet évènement (archivé accepté), `priceCents` entier 0..99999, `id` uuid ; insertion `ON CONFLICT (id) DO NOTHING` ; `soldAt` invalide, antérieur à 2020 ou plus de 24 h dans le futur → remplacé par l'heure de réception. Article inconnu → id ajouté à `rejected`, le reste du lot passe. `void` : pose `voided_at` (une seule fois) sur la vente de cet évènement ; inconnue → ignorée. Lot vide ou > 500 → 400.
- `GET /api/events/:id/summary` → `SummaryDto`.
- `GET /api/events/:id/sales?limit=50&cursor=` → `SalesPageDto`, ventes non annulées, `sold_at` décroissant puis `id` décroissant ; `limit` 1..200 ; `next` = curseur de la page suivante ou `null`.

- [ ] **Step 1: Tests qui échouent** — 3 ventes (2 crêpes à 250, 1 soda à 150) → résumé `{ salesCount: 3, revenueCents: 650 }` et totaux par article ; **rejeu** : le même lot renvoyé → toujours 3 ; `void` d'une crêpe → 2 / 400, rejoué → inchangé ; **horloge fausse** : `soldAt` dans 3 jours → vente comptée, `soldAt` renvoyé par l'historique à moins de 5 s de maintenant ; **article supprimé** : lot `[vente article inconnu, vente crêpe]` → 200, `rejected` = [id de la première], la crêpe est comptée ; évènement d'un autre compte → 404 ; prix modifié après coup → les ventes passées gardent leur prix ; `byHour` : deux ventes à `2027-06-20T12:10:00Z` et `T12:50:00Z` → `[{ hour: '2027-06-20T14:00', count: 2, … }]` ; historique paginé par 2 sur 3 ventes → 2 + 1, `next` null à la fin ; lot de 501 → 400.
- [ ] **Step 2: Lancer** — FAIL.
- [ ] **Step 3: Implémenter.**
- [ ] **Step 4: Lancer** — PASS + typecheck.
- [ ] **Step 5: Commit** — `feat(api): ventes synchronisées, résumé et historique`

---

### Task 6: Export Excel

**Files:**
- Create: `apps/api/src/events/{export.controller,export.service}.ts`
- Test: `apps/api/test/export.e2e.test.ts`

**Interfaces:**
- `GET /api/events/:id/export` → `.xlsx` (`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `Content-Disposition: attachment; filename="cresus-<slug>-<date>.xlsx"; filename*=UTF-8''…`) ; `<slug>` = nom normalisé ASCII, tirets.
- Feuilles et colonnes exactement comme la spec §4.6 : « Récapitulatif » (lignes d'en-tête Asso / Évènement / Date / Exporté le, puis tableau Article | Prix unitaire | Quantité | Total, une ligne par couple article × prix pratiqué dans l'ordre de caisse, ligne « Total »), « Ventes » (Date | Heure | Article | Prix, ordre chronologique, heure de Paris), « Par heure » (Tranche horaire « 14:00 – 15:00 » préfixée de la date si l'évènement s'étale sur plusieurs jours | Nombre de ventes | Montant). Montants en euros (nombre) au format `#,##0.00 "€"`.

- [ ] **Step 1: Test qui échoue** — ventes d'une crêpe à 250 ×2, puis prix passé à 300 et une vente, un soda annulé ; relire le fichier avec `exceljs` : 3 feuilles nommées comme ci-dessus ; récapitulatif contient les lignes `Crêpe | 2,5 | 2 | 5` et `Crêpe | 3 | 1 | 3` et un total de 8 ; « Ventes » a 3 lignes de données (l'annulée absente) ; nom de fichier `cresus-kermesse-2027-2027-06-20.xlsx` pour « Kermesse 2027 » ; un autre compte → 404.
- [ ] **Step 2: Lancer** — FAIL. **Step 3: Implémenter** (exceljs, `workbook.xlsx.write(res)`). **Step 4: Lancer** — PASS + typecheck.
- [ ] **Step 5: Commit** — `feat(api): export Excel d'un évènement`

---

### Task 7: Front — socle, connexion, réglages

**Files:**
- Create: `apps/web/{package.json,nuxt.config.ts,tsconfig.json,playwright.config.ts,vitest.config.ts}`, `apps/web/app/app.vue`, `app/assets/css/{tokens,base}.css`, `app/composables/{useApi,useToast,useOnline}.ts`, `app/stores/auth.ts`, `app/middleware/auth.global.ts`, `app/layouts/default.vue`, `app/pages/{login,reglages}.vue`, `app/components/ui/{AppButton,AppField,AppDialog,ToastHost,TopBar}.vue`, `public/{favicon.svg,icons/*}`
- Test: `apps/web/e2e/{helpers,auth}.spec.ts`

**Interfaces:**
- `useApi()` → `{ get<T>(path), post<T>(path, body?), patch<T>, put<T>, del<T>(path, body?) }` ; lève `ApiError { status, code, message }` ; `status: 0` hors ligne (échec réseau).
- `useAuthStore()` (Pinia) : `account: AccountDto | null`, `ready: boolean`, `init()` (appelle `me`, en cas d'échec réseau reprend `localStorage['cresus:account']`), `signup`, `login`, `logout`, `rename`, `changePassword`, `deleteAccount`.
- Middleware : non connecté → `/login?redirect=…` ; connecté sur `/login` → `/`.
- PWA : manifest « Cresus », `display: standalone`, précache `**/*.{js,css,html,svg,png,woff2}` (pictos compris), `navigateFallbackDenylist` pour `/api`.
- Style (choix du constructeur) : fond crème clair, encre presque noire, couleur principale framboise, accent jaune citron, une police ronde et lisible (`@fontsource-variable/nunito`), chiffres tabulaires, cibles tactiles ≥ 48 px, focus visible. Couleurs par catégorie de picto (teinte légère de tuile) : sucré rose, salé orange, boisson bleu, fruit vert, kermesse violet, vente turquoise, divers gris.
- `/login` : bascule « Se connecter / Créer le compte de l'asso », mention « Mot de passe oublié ? Demandez à l'administrateur de Cresus. »
- `/reglages` : nom de l'asso, email (lecture seule), changer le mot de passe, se déconnecter, supprimer le compte (dialogue avec mot de passe), crédit des pictos.

- [ ] **Step 1: Test e2e qui échoue** (`auth.spec.ts`, viewport mobile 390×844) — inscription → arrive sur `/` avec le nom de l'asso affiché ; déconnexion → `/login` ; connexion avec mauvais mot de passe → message « Email ou mot de passe incorrect. » ; réglages : renommer l'asso, changer le mot de passe puis se reconnecter avec le nouveau.
- [ ] **Step 2: Lancer** — `npm run build -w @cresus/shared && npm run test:e2e -w @cresus/web -- auth` → FAIL.
- [ ] **Step 3: Implémenter.** **Step 4: Lancer** — PASS ; `npm run typecheck -w @cresus/web` OK.
- [ ] **Step 5: Commit** — `feat(web): socle Nuxt, connexion et réglages`

---

### Task 8: Front — évènements, articles et caisse hors ligne

**Files:**
- Create: `app/utils/sale-queue.ts`, `app/stores/caisse.ts`, `app/pages/index.vue`, `app/pages/evenements/nouveau.vue`, `app/pages/evenements/[id]/index.vue` (caisse), `app/pages/evenements/[id]/articles.vue`, `app/components/{PictoImg,PictoPicker,ArticleForm,EventForm,CaisseTile,SyncBadge}.vue`
- Test: `apps/web/test/sale-queue.test.ts` (Vitest), `apps/web/e2e/{events,caisse}.spec.ts`

**Interfaces:**
- `sale-queue.ts` (pur, sans DOM) :
  - `type QueuedOp = SyncOp & { eventId: string; articleId: string; priceCents: number }` (un `void` porte l'article et le prix de la vente visée, pour l'affichage)
  - `applyPending(summary: SummaryDto, ops: QueuedOp[]): SummaryDto` — ajoute les ventes en attente, retire les annulations en attente (totaux et par article ; `byHour` inchangé)
  - `undoSale(ops: QueuedOp[], saleId: string, inFlight: ReadonlySet<string>, sale: { eventId; articleId; priceCents }): QueuedOp[]` — retire la vente si elle est en file et pas en cours d'envoi, sinon ajoute un `void`
  - `queueKey(accountId: string): string` → `cresus:queue:<accountId>` ; `cacheKey(accountId, eventId)` → `cresus:event:<accountId>:<eventId>`
- `useCaisseStore()` : `open(eventId)` (cache puis `GET /api/events/:id`), `detail`, `displayed: SummaryDto` (= `applyPending`), `sell(article)` (uuid `crypto.randomUUID()`, `soldAt` = maintenant, enfile, vibration 15 ms, envoi différé de 300 ms, renvoie l'id), `undo(saleId)`, `voidSale(sale)`, `flush()` (un seul envoi à la fois, par lots de 500 ; réponse → `summary` remplacé et ops envoyées retirées, ensemble ; 404 → ops de cet évènement abandonnées et toast « Cet évènement n'existe plus » ; 401 → file conservée ; `status 0` → hors ligne), `status: 'ok' | 'pending' | 'offline'`, `pendingCount`. Envoi : après un appui, au retour de `online`, toutes les 10 s s'il reste des ops ; rafraîchissement du résumé toutes les 10 s quand la caisse est visible et la file vide. La file d'un compte n'est envoyée que si `auth.account.id` correspond.
- Pages : `/` liste des évènements (nom, date, total, nb de ventes ; bouton « Nouvel évènement ») ; `/evenements/nouveau` (nom, date du jour, « Reprendre les articles de… ») ; caisse : en-tête (nom, total, nb de ventes, `SyncBadge`, liens « Articles » et « Bilan »), grille `repeat(auto-fill, minmax(150px, 1fr))` de `CaisseTile` (picto 72 px, nom, prix, compteur ; `min-height: 140px` ; `aria-label="Vendre <nom>, <prix>"`), toast « <nom> +1 · Annuler » 5 s, Wake Lock si disponible, état vide « Ajoutez vos articles » ; articles : liste (picto, nom, prix, interrupteur « En vente », monter/descendre, modifier, supprimer avec confirmation), `ArticleForm` (nom, prix avec `parseEuros`, aperçu du picto `resolvePicto` mis à jour à la frappe, appui → `PictoPicker` : recherche `searchPictos`, grille, « Automatique »), modification du nom/date de l'évènement et suppression de l'évènement (confirmation) ; hors ligne : la page articles affiche « Connexion nécessaire pour modifier les articles ».

- [ ] **Step 1: Tests unitaires qui échouent** (`sale-queue.test.ts`) — `applyPending` : résumé serveur 2 crêpes + 1 vente crêpe en attente + 1 void d'un soda → crêpe 3, soda −1, total cohérent ; `undoSale` sur une vente en file → retirée ; sur une vente en cours d'envoi → `void` ajouté ; sur une vente déjà envoyée → `void` ajouté.
- [ ] **Step 2: Tests e2e qui échouent** — `events.spec.ts` : créer « Kermesse 2027 », ajouter « Crêpe nutella » à « 2,50 » (aperçu = picto crêpe), « Coca » à 1,50, changer le picto du Coca via le sélecteur (« jus »), réordonner, créer un second évènement en reprenant les articles → 2 articles présents. `caisse.spec.ts` : 3 appuis rapides sur Crêpe → compteur 3, total 7,50 € ; « Annuler » → 2, 5,00 € ; recharger la page → 2 (serveur) ; **hors ligne** (`context.setOffline(true)`) : 2 appuis → badge « 2 en attente », compteur 4 ; recharger hors ligne est hors périmètre en dev (pas de service worker), repasser en ligne → badge « À jour » et `GET /api/events/:id/summary` renvoie 4 ; **session expirée** : vider les cookies, 1 appui (en attente), se reconnecter au même compte, rouvrir la caisse → la vente part (5) ; **deux appareils** : un second contexte connecté au même compte vend 1 Coca → le premier l'affiche après rafraîchissement automatique (≤ 12 s).
- [ ] **Step 3: Lancer** — FAIL. **Step 4: Implémenter.** **Step 5: Lancer** — PASS (unitaires + e2e + typecheck).
- [ ] **Step 6: Commit** — `feat(web): évènements, articles à pictos et caisse hors ligne`

---

### Task 9: Front — bilan, historique, export

**Files:**
- Create: `app/pages/evenements/[id]/bilan.vue`, `app/components/{HourBars,SalesHistory}.vue`
- Test: `apps/web/e2e/bilan.spec.ts`

**Interfaces:**
- Bilan : total, nombre de ventes, tableau par article (ordre de caisse, archivés compris avec la mention « retiré »), `HourBars` (barres horizontales HTML/CSS, une par tranche de `byHour`, libellé « 14 h », valeur en €), bouton « Exporter en Excel » (lien `GET /api/events/:id/export` avec `download`), `SalesHistory` (pages de 50, « Voir plus », « Supprimer » avec confirmation → `caisse.voidSale` puis rafraîchissement). Hors ligne : « Connexion nécessaire pour le bilan ».

- [ ] **Step 1: Test e2e qui échoue** — après 2 crêpes et 1 coca : bilan affiche 6,50 € et 3 ventes, tableau Crêpe nutella 2 / 5,00 € ; supprimer le coca dans l'historique → 5,00 € et 2 ventes ; « Exporter en Excel » déclenche un téléchargement nommé `cresus-kermesse-2027-<date>.xlsx`.
- [ ] **Step 2: Lancer** — FAIL. **Step 3: Implémenter.** **Step 4: Lancer** — PASS + typecheck.
- [ ] **Step 5: Commit** — `feat(web): bilan, historique et export Excel`

---

### Task 10: Image Docker, README, e2e sur le build de production

**Files:**
- Create: `Dockerfile`, `docker-compose.yml`, `scripts/e2e-prod.mjs`, `README.md`
- Test: `npm run e2e:prod`

**Interfaces:**
- Image unique Node 24 alpine, port 3000, `WEB_DIST=/app/web`, `TZ=Europe/Paris`, `USER node`, `HEALTHCHECK` `wget -qO- http://127.0.0.1:${PORT}/api/health`, migrations au démarrage ; copie `packages/shared/dist`, `apps/api/{dist,drizzle,package.json}`, `apps/web/.output/public`.
- README : présentation, démarrage local, tests, déploiement et variables (`DATABASE_URL`, `SESSION_SECRET`, `COOKIE_SECURE`, `AUTH_RATE_LIMIT`, `PORT`, `TZ`), réinitialisation d'un mot de passe (`cd /app/apps/api && node dist/cli/reset-password.js <email>`), crédit des pictos, limites de la v1.

- [ ] **Step 1:** Écrire les fichiers. **Step 2:** `npm run e2e:prod` → toute la suite Playwright passe contre l'API qui sert le front construit (port 3100). **Step 3:** `docker build -t cresus .` si Docker est disponible localement (sinon le build Coolify fait foi en tâche 11).
- [ ] **Step 4: Commit** — `build: image Docker, README et e2e de production`

---

### Task 11: Mise en production sur cresus.gagnaire.dev

- [ ] **Step 1:** Pousser `escouade/reset-cresus-caisse` sur `origin`.
- [ ] **Step 2:** Coolify, application « Cresus » (`dkjdbnntyinb8bsia8o5kwqc`) : `git_branch` → `escouade/reset-cresus-caisse` ; variables : garder `DATABASE_URL`, `SESSION_SECRET`, `NODE_ENV` ; poser `COOKIE_SECURE=true` ; retirer les variables Ma Tréso obsolètes (`PUBLIC_URL`, `WEBAUTHN_*`, `SEED_DEMO*`, `OAUTH_*`).
- [ ] **Step 3:** Vider la base `cresus-db` (`zzfukyyafjwkehsfywpgy4kn`) : schémas `public` et `drizzle` supprimés puis `public` recréé (accord de Guillaume, sans sauvegarde).
- [ ] **Step 4:** Déployer, suivre le déploiement jusqu'à `running:healthy`.
- [ ] **Step 5:** Vérifier en ligne : `GET https://cresus.gagnaire.dev/api/health` → `{ status: 'ok' }` ; page de connexion servie ; parcours inscription → évènement → article → vente → export sur un compte de test, puis suppression de ce compte.
