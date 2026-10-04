# Ma Tréso — Plan d'implémentation, Phase 3 bis : serveur MCP et OAuth 2.1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Demande utilisateur ajoutée en cours d'exécution. Ces tâches s'exécutent **après la Task 33 et avant la Task 34** (l'image Docker et l'e2e de production doivent inclure le MCP). Spec : `docs/superpowers/specs/2026-10-04-ma-treso-design.md` §9. Les sections **Global Constraints** et **Conventions de code** de `2026-10-04-ma-treso.md` s'appliquent, ainsi que les rappels de la phase API (ESM, imports `.js`, tests Vitest + unplugin-swc sur PGlite).

**Bibliothèque :** `@modelcontextprotocol/sdk` ^1.32 (zod 4 et Express 5 supportés). Elle fournit :
- `McpServer` (`@modelcontextprotocol/sdk/server/mcp.js`) ;
- `StreamableHTTPServerTransport` (`…/server/streamableHttp.js`) ;
- `mcpAuthRouter`, `requireBearerAuth` et l'interface `OAuthServerProvider` (`…/server/auth/…`) ;
- côté tests, `Client` et `StreamableHTTPClientTransport` (`…/client/…`).

**Suivre les types installés** si un chemin d'import ou une signature diffère de ce plan, et lister chaque écart dans le rapport.

---

### Task 38: Serveur d'autorisation OAuth 2.1 (API)

**Files:**
- Create : `apps/api/src/oauth/{oauth.module.ts,oauth.provider.ts,oauth.store.ts,oauth.controller.ts,redirect-uri.ts}`, `apps/api/test/oauth.e2e.test.ts`
- Modify : `apps/api/src/db/schema.ts` (4 tables), nouvelle migration `apps/api/drizzle/0002_*.sql`, `apps/api/src/config.ts` (`PUBLIC_URL` → `publicUrl`), `apps/api/src/bootstrap.ts` (montage du routeur du SDK), `apps/api/src/app.module.ts` (`OAuthModule`, exclusions du service statique), `.env.example`, `apps/api/.env.e2e`

**Interfaces:**
- Produces : `OAuthProvider` (implémente `OAuthServerProvider` : `clientsStore`, `authorize`, `challengeForAuthorizationCode`, `exchangeAuthorizationCode`, `exchangeRefreshToken`, `verifyAccessToken`, `revokeToken`) ; `verifyAccessToken` renvoie un `AuthInfo` avec `extra: { userId }`, qui servira à la Task 39.
- Routes : celles du routeur du SDK à la racine (`/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`, `/authorize`, `/token`, `/register`, `/revoke`) ; en API, `GET /api/oauth/requests/:id` (session requise : `{ clientName, redirectHost, scope }`), puis `POST /api/oauth/requests/:id/approve` et `POST /api/oauth/requests/:id/deny` (session requise : `{ redirectUrl }`).

**Règles :**
- `config.publicUrl` : `PUBLIC_URL`, obligatoire si `NODE_ENV=production`, défaut `http://localhost:3000`. `issuerUrl = new URL(publicUrl)`, `resourceServerUrl = new URL('/mcp', publicUrl)`, scope unique `cresus` (`scopesSupported: ['cresus']`).
- Montage dans `bootstrap.ts`, **avant** `app.init()` : `app.use(mcpAuthRouter({ provider, issuerUrl, resourceServerUrl, scopesSupported: ['cresus'], resourceName: 'Ma Tréso' }))`. Le provider est récupéré par `app.get(OAuthProvider)`. Le préfixe `/api` ne s'applique pas à ces middlewares. Exclure `/mcp`, `/authorize`, `/token`, `/register`, `/revoke` et `/.well-known/{*path}` du repli SPA de `ServeStaticModule`.
- Le middleware `jsonOnlyMutations` ne vise que `/api/` : `/token` et `/register` (formulaire ou JSON, selon le SDK) ne sont pas concernés.
- Tables (schéma Drizzle `pg-core`, `user_id` en cascade quand présent) :
  - `oauth_clients` : `client_id` text pk, `client_name`, `redirect_uris` text[], `metadata` jsonb, `created_at` ;
  - `oauth_requests` : `id` uuid, `client_id`, `redirect_uri`, `code_challenge`, `state` nullable, `scope`, `resource` nullable, `expires_at` (10 min) ;
  - `oauth_codes` : `code_hash` pk, `client_id`, `user_id`, `redirect_uri`, `code_challenge`, `scope`, `resource`, `expires_at` (5 min) ;
  - `oauth_tokens` : `id`, `access_hash` unique, `refresh_hash` unique, `client_id`, `user_id`, `scope`, `access_expires_at` (1 h), `refresh_expires_at` (30 j), `revoked_at`.
- `registerClient` : clients publics (`token_endpoint_auth_method: 'none'`), `client_id` aléatoire. Chaque `redirect_uri` doit passer `isAllowedRedirectUri` (`redirect-uri.ts`) : `http://localhost:<port>/…`, `http://127.0.0.1:<port>/…` ou `https://…`. Sinon l'enregistrement est refusé (erreur OAuth `invalid_redirect_uri` / `invalid_client_metadata` selon le SDK).
- `authorize(client, params, res)` : crée la demande en attente, puis `res.redirect(\`${publicUrl}/oauth/consent?request=${id}\`)`.
- Approbation (`/api/oauth/requests/:id/approve`, utilisateur de la session) : vérifie que la demande n'a pas expiré, crée le code (32 octets aléatoires, base64url, haché en SHA-256), supprime la demande, renvoie `redirectUrl` = `redirect_uri` + `code` + `state`. Refus : `redirect_uri?error=access_denied&state=…`. Une demande inconnue ou expirée donne 404 « Cette demande d’autorisation a expiré. Relance la connexion depuis Claude Code. ».
- `exchangeAuthorizationCode` : code connu, non expiré, même client et même `redirect_uri` ; usage unique (supprimé à l'échange). Le PKCE est vérifié par le SDK via `challengeForAuthorizationCode`. Émet `{ access_token, token_type: 'bearer', expires_in: 3600, refresh_token, scope: 'cresus' }`.
- `exchangeRefreshToken` : rotation (l'ancienne ligne est révoquée et une nouvelle paire est émise) ; un jeton expiré ou révoqué est refusé.
- `verifyAccessToken` : jeton connu, non révoqué, non expiré → `{ token, clientId, scopes: ['cresus'], expiresAt (secondes), extra: { userId } }`, sinon erreur `InvalidTokenError` du SDK.
- Logs : jamais de jeton ni de code en clair.

- [ ] **Step 1: Tests e2e (supertest), à écrire d'abord**

`apps/api/test/oauth.e2e.test.ts` : créer un utilisateur (`agentFor(app)` + register), puis :
1. `GET /.well-known/oauth-authorization-server` → 200, avec `issuer`, `authorization_endpoint`, `token_endpoint`, `registration_endpoint`, `code_challenge_methods_supported` qui contient `S256`.
2. `GET /.well-known/oauth-protected-resource` (et, si le SDK l'expose, `/.well-known/oauth-protected-resource/mcp`) → `resource` = `${PUBLIC_URL}/mcp`, `authorization_servers` contient l'émetteur.
3. `POST /register` `{ client_name: 'Claude Code', redirect_uris: ['http://localhost:33418/callback'], grant_types: ['authorization_code','refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' }` → 201 avec `client_id`. Une `redirect_uri` `myapp://cb` ou `http://evil.example/cb` → 400.
4. Générer `verifier` et `challenge` (S256, `node:crypto`). `GET /authorize?response_type=code&client_id=…&redirect_uri=…&code_challenge=…&code_challenge_method=S256&state=xyz&scope=cresus` → 302 vers `…/oauth/consent?request=<id>`.
5. Sans session, `GET /api/oauth/requests/<id>` → 401. Avec la session : `{ clientName: 'Claude Code', redirectHost: 'localhost:33418', scope: 'cresus' }`.
6. `POST /api/oauth/requests/<id>/approve` → `{ redirectUrl }` qui commence par la `redirect_uri` et contient `code` et `state=xyz`. Rejouer l'approbation → 404.
7. `POST /token` (`grant_type=authorization_code`, code, `code_verifier`, `client_id`, `redirect_uri`) → 200 avec `access_token`, `refresh_token`, `expires_in` 3600. Rejouer le même code → 400 `invalid_grant`. Un mauvais `code_verifier` sur un nouveau code → 400.
8. `POST /token` en `grant_type=refresh_token` → nouvelle paire ; l'ancien jeton de rafraîchissement est ensuite refusé.
9. `POST /revoke` du jeton d'accès → jeton refusé ensuite (testé via `OAuthProvider.verifyAccessToken`, qui lève l'erreur).
10. Refus : `deny` → `redirectUrl` contient `error=access_denied&state=xyz`.
11. La base ne contient que des hachages : aucune colonne de `oauth_tokens` ni de `oauth_codes` ne contient le jeton en clair.

- [ ] **Step 2: Vérifier l'échec, implémenter, générer la migration**, puis `npm run test -w @matreso/api` et `npm run typecheck -w @matreso/api` → PASS.

- [ ] **Step 3: Commit** `feat(api): serveur d'autorisation OAuth 2.1 (PKCE, enregistrement dynamique, consentement)`

### Task 39: Serveur MCP Streamable HTTP et outils (API)

**Files:**
- Create : `apps/api/src/mcp/{mcp.module.ts,mcp.server.ts,mcp.tools.ts,money.ts}`, `apps/api/test/mcp.e2e.test.ts`
- Modify : `apps/api/src/bootstrap.ts` (route `/mcp` avec `requireBearerAuth`), petits services extraits si nécessaire : `BalanceService` (création de snapshot) et `ProfileService` (patch du profil), réutilisés par les contrôleurs existants et par MCP. Ne pas dupliquer leur logique.

**Interfaces:**
- Consumes : `OAuthProvider.verifyAccessToken` (Task 38), `StateService.getState`, `ClientsService`, `LeavesService`, `ChargesService`, `TransferService.exportFile`, les schémas zod existants et le moteur (`monthResults`, `resultsSummary`, `groupLeaves`, `microMonths`, `ceilingGauge`, `smoothedIncome`, `localToday`).
- Produces : endpoint `/mcp` (POST, GET, DELETE) protégé par Bearer. Sans jeton ou avec un jeton invalide → 401 avec `WWW-Authenticate: Bearer … resource_metadata="${PUBLIC_URL}/.well-known/oauth-protected-resource…"` (fourni par `requireBearerAuth`).

**Règles :**
- Montage : `app.use('/mcp', express.json(), requireBearerAuth({ verifier: provider, requiredScopes: ['cresus'], resourceMetadataUrl }), handler)`. Le handler crée **par requête** un `McpServer` (nom `ma-treso`, version du package) lié à l'utilisateur `req.auth.extra.userId`, et un `StreamableHTTPServerTransport({ sessionIdGenerator: undefined })` (mode sans état), puis `await server.connect(transport)`, `await transport.handleRequest(req, res, req.body)` et la fermeture à `res.on('close')`. GET et DELETE renvoient 405 en mode sans état, si c'est le comportement du SDK.
- `money.ts` : `toCents(euros: number): number` (arrondi au centime, refuse les valeurs non finies) et `toEuros(cents): number`. Tous les montants des outils sont en euros.
- Outils (`server.registerTool(name, { title, description (en français), inputSchema: zodShape }, handler)`). Chaque handler renvoie `{ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result }`. Une `AppError` donne `{ isError: true, content: [{ type: 'text', text: message }] }`.

| Outil | Entrées | Sortie (montants en euros) |
| --- | --- | --- |
| `get_overview` | `{ includeProspects?: boolean }` | `{ today, balance, mode: 'societe' \| 'micro', summary, months: [{ month, income, incomeWithoutLeaves, charges, result, balance, state }] }`, plus en micro `micro: { months: [{ month, income, forYou }], gauge: { year, total, ceiling, pct, level, overMonth, vatMonth }, smoothedAverage }` |
| `get_month` | `{ month: 'YYYY-MM' }` (dans l'horizon) | `{ month, state, income, charges, result, balance, entries: [{ client, workMonth, cashDate, amount, leaveCost }], charges: [{ name, amount, frequency, computed }] }` |
| `get_profile` | `{}` | profil (sans `id`), avec `role` |
| `update_profile` | champs du profil (montants en euros), tous optionnels | profil mis à jour |
| `set_balance` | `{ amount: number, date?: 'YYYY-MM-DD' }` | snapshot |
| `list_clients` | `{ includeArchived?: boolean }` | clients avec tarifs (euros) |
| `create_client` | mêmes champs que l'API, avec `rate: { validFrom, amount }` en euros | client |
| `update_client` | `{ id, …champs optionnels, archived? }` | client |
| `delete_client` | `{ id }` | `{ deleted: true }` |
| `add_rate` / `delete_rate` | `{ clientId, validFrom, amount }` / `{ clientId, rateId }` | client |
| `list_leaves` | `{}` | périodes (`groupLeaves`) : `{ from, to, dayCount, scope, client, cost, impacts, leaveIds }` |
| `add_leaves` | `{ from, to?, scope: 'ALL' \| 'CLIENT', clientId? }` | `{ created, leaves }` |
| `delete_leaves` | `{ ids: string[] }` | `{ deleted }` |
| `list_charges` / `create_charge` / `update_charge` / `delete_charge` | champs de l'API, montants en euros | charge(s) |
| `export_data` | `{}` | fichier d'export |

- La validation métier passe par les mêmes schémas et services que l'API (aucune règle recopiée). Un congé un samedi donne `isError` avec « Ce jour n’est pas ouvré… ». Supprimer le dernier tarif donne `isError` avec le message `LAST_RATE`.

- [ ] **Step 1: Tests e2e, à écrire d'abord**

`apps/api/test/mcp.e2e.test.ts` :
- démarrer l'app sur un port libre (`await app.listen(0)`) ;
- créer un utilisateur et importer `demoExportFile()` ;
- obtenir un jeton d'accès par le parcours OAuth de la Task 38, à factoriser dans un helper `issueAccessToken(app, agent)` de `test/helpers.ts` ;
- se connecter avec `Client` + `StreamableHTTPClientTransport(new URL(\`http://127.0.0.1:${port}/mcp\`), { requestInit: { headers: { Authorization: \`Bearer ${token}\` } } })`.

Tests :
1. Sans jeton : `POST /mcp` → 401 et en-tête `WWW-Authenticate` contenant `resource_metadata`.
2. `listTools()` contient les 19 outils du tableau.
3. `callTool('get_overview', {})` avec la date figée au 2026-10-04 (`vi.useFakeTimers({ toFake: ['Date'] })`, `vi.setSystemTime(new Date('2026-10-04T10:00:00'))`) : `months[0]` = `{ month: '2026-10', result: -2314, balance: 46006, state: 'RED' }`.
4. `get_month` `{ month: '2027-02' }` → `state: 'RED_DUE_TO_LEAVES'`.
5. `create_client` (TJM, `rate.amount` 600) puis `list_clients` : le nouveau client apparaît avec `rates[0].amount === 600`.
6. `add_leaves` `{ from: '2026-12-26', scope: 'ALL' }` → `isError`, avec le message « Ce jour n’est pas ouvré ».
7. `update_profile` `{ legalStatus: 'EURL_IS' }` puis `get_month('2026-11')` : la charge calculée « Cotisations sociales » vaut 1800.
8. Isolation : le jeton de l'utilisateur A ne voit jamais les clients de l'utilisateur B.

- [ ] **Step 2: Vérifier l'échec, implémenter**, puis `npm run test -w @matreso/api` et `npm run typecheck -w @matreso/api` → PASS.

- [ ] **Step 3: Commit** `feat(api): serveur MCP (Streamable HTTP, outils de gestion de la trésorerie)`

### Task 40: Écran de consentement OAuth et retour après connexion (web)

**Files:**
- Create : `apps/web/app/pages/oauth/consent.vue`, `apps/web/e2e/oauth.spec.ts`
- Modify : `apps/web/app/middleware/auth.global.ts` (redirection vers `/login?redirect=<chemin courant>`), `apps/web/app/pages/login.vue` (après connexion ou inscription, `navigateTo(safeRedirect(route.query.redirect) ?? '/')`), `apps/web/app/utils/redirect.ts` (`safeRedirect` : un chemin relatif commençant par `/`, pas `//`, sans schéma, sinon `null`), `apps/web/nuxt.config.ts` (`devProxy` : en plus de `/api`, proxifier `/mcp`, `/authorize`, `/token`, `/register`, `/revoke` et `/.well-known` vers `http://localhost:3001`), `README.md` (section « Connecter Claude Code »)

**Règles :**
- `/oauth/consent` utilise le layout `auth` : carte centrée, même identité visuelle que la connexion (logo GD).
- La page charge `GET /api/oauth/requests/:id` (`request` dans la query) et affiche :
  - le titre « **{clientName}** veut accéder à ton compte Ma Tréso » ;
  - le paragraphe « Il pourra consulter ta trésorerie et modifier tes clients, congés et charges en ton nom. » ;
  - la mention « Après validation, tu seras renvoyé vers {redirectHost}. » ;
  - les boutons « Autoriser » (principal) et « Refuser » (secondaire) ;
  - la mention « Tu pourras révoquer l’accès en te déconnectant de l’app MCP. ».
- Clic : `POST …/approve` ou `…/deny`, puis `window.location.assign(redirectUrl)`.
- Une demande expirée (404) affiche le message de l'API et un lien vers `/`.
- Accessibilité : `h1`, boutons de 50 px, messages en `role="alert"`.

- [ ] **Step 1: Test e2e Playwright, à écrire d'abord** (`e2e/oauth.spec.ts`, projets desktop et mobile)
1. Enregistrer un client via `page.request.post('/register', …)` avec `redirect_uris: ['http://localhost:3999/callback']`, ce qui passe par le proxy Nuxt.
2. Générer le PKCE et ouvrir `/authorize?…` **sans session** : on arrive sur `/login?redirect=%2Foauth%2Fconsent%3Frequest%3D…`.
3. Se connecter avec un compte frais (créé via l'API dans un autre contexte, ou s'inscrire sur la page) : retour sur `/oauth/consent` avec le texte « Claude Code veut accéder à ton compte Ma Tréso ».
4. Intercepter `http://localhost:3999/callback**` avec `page.route` (répondre 200 « ok »), cliquer sur « Autoriser », et vérifier que l'URL finale contient `code=` et `state=`.
5. Refus : nouvelle demande, puis « Refuser » → URL avec `error=access_denied`.
6. `safeRedirect` : `/login?redirect=https://evil.example` → après connexion, on arrive sur `/`.

- [ ] **Step 2: Vérifier l'échec, implémenter**, puis lancer `npm run test:e2e -w @matreso/web -- oauth.spec.ts auth.spec.ts shell.spec.ts` et `npm run typecheck -w @matreso/web` → PASS.

- [ ] **Step 3: README** : section « Connecter Claude Code » (`claude mcp add --transport http cresus https://cresus.gagnaire.dev/mcp`, puis `/mcp` › Authenticate) et liste des outils.

- [ ] **Step 4: Commit** `feat(web): écran de consentement OAuth et retour après connexion`
