# Ma Tréso

Ma Tréso est une application de prévision de trésorerie pour les indépendants : elle projette sur 15 mois tes rentrées (selon les délais de paiement de chaque client) et tes charges, et répond à une seule question, « Ce mois-ci, est-ce que ça passe ? ». Le produit est décrit dans [`SPEC.md`](SPEC.md) et son implémentation dans [`docs/superpowers/specs/2026-10-04-ma-treso-design.md`](docs/superpowers/specs/2026-10-04-ma-treso-design.md).

## Sommaire

- [Démarrer en local](#démarrer-en-local)
- [Tests](#tests)
- [Déployer](#déployer)
- [Connecter Claude Code](#connecter-claude-code)
- [Architecture](#architecture)
- [Limites de la v1](#limites-de-la-v1)

## Démarrer en local

Aucun Docker n’est nécessaire : en développement, la base est PGlite (PostgreSQL embarqué).

Prérequis : Node 24 (`>= 24.11`) et npm.

```bash
npm install
cp .env.example .env   # optionnel
npm run dev
```

- Sans `.env`, tout a une valeur par défaut : la base est PGlite, persistée dans `apps/api/.data/pglite` (ou `DATABASE_URL=pglite:memory` pour une base jetable).
- `npm run dev` construit d’abord le moteur, puis lance l’API NestJS sur le port 3001 et Nuxt sur le port 3000. Nuxt relaie vers l’API tout ce qu’elle sert : `/api`, les routes OAuth (`/authorize`, `/token`, `/register`, `/revoke`, `/.well-known`) et `/mcp`.
- Ouvre http://localhost:3000.
- Avec `SEED_DEMO=true` (la valeur de `.env.example`), un compte de démo est créé au démarrage : `demo@matreso.fr` / `demo1234` (le mot de passe se règle avec `SEED_DEMO_PASSWORD`).
- Le premier compte inscrit devient l’unique **administrateur** (`ADMIN`) ; les suivants sont de simples utilisateurs. Le compte de démo ne l’est jamais, et le rôle ne peut être modifié ni depuis le profil, ni par un import.

## Tests

Tout tourne sans Docker : les tests de l’API utilisent PGlite en mémoire.

| Quoi | Commande | Remarque |
| --- | --- | --- |
| Moteur | `npm run test -w @matreso/engine` | Vitest ; le seuil de couverture de 90 % bloque l’exécution. |
| API | `npm run test -w @matreso/api` | Vitest + supertest sur PGlite en mémoire (`DATABASE_URL_TEST=postgres://…` pour viser un vrai PostgreSQL). |
| Types | `npm run typecheck -w @matreso/engine` · `-w @matreso/api` · `-w @matreso/web` | |
| e2e en dev | `npm run build -w @matreso/engine && npm run test:e2e -w @matreso/web` | Playwright lance l’API (PGlite en mémoire) et Nuxt ; les assistants de test importent le moteur construit, d’où le build préalable. |
| e2e sur le build de production | `npm run e2e:prod` | Construit tout (`npm run build`), démarre l’API qui sert le front sur le port 3100, puis joue toute la suite Playwright : même topologie que l’image Docker. `E2E_PROD_SKIP_BUILD=1` réutilise le dernier build. |
| Tout (hors e2e) | `npm run test` | Lance le script `test` de chaque workspace. |

Playwright demande les navigateurs : `npx playwright install chromium` à la première utilisation.

## Déployer

L’image Docker est unique et n’exécute qu’un seul processus : l’API NestJS écoute sur le port 3000 et sert l’API (`/api`), le front construit (SPA, PWA) et les routes OAuth et MCP. Elle tourne avec l’utilisateur `node`, avec `TZ=Europe/Paris`, et déclare un `HEALTHCHECK` sur `/api/health`. Les migrations sont jouées au démarrage.

```bash
docker build -t ma-treso .
docker run -p 3000:3000 \
  -e DATABASE_URL=postgres://utilisateur:motdepasse@hote:5432/matreso \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  -e PUBLIC_URL=https://cresus.example.com \
  -e WEBAUTHN_RP_ID=cresus.example.com \
  -e WEBAUTHN_ORIGIN=https://cresus.example.com \
  -e COOKIE_SECURE=true \
  -e SEED_DEMO=false \
  ma-treso
```

Le fichier `docker-compose.yml` fournit un exemple complet (PostgreSQL 16 et l’application) : `docker compose up --build`, puis http://localhost:3000. Ses valeurs par défaut conviennent à un essai local, pas à la production.

### Variables d’environnement

Le modèle est `.env.example`. « Défaut » est la valeur appliquée si la variable est absente.

| Variable | Obligatoire | Défaut | Rôle |
| --- | --- | --- | --- |
| `DATABASE_URL` | oui en production | `pglite:./.data/pglite` | `postgres://…` en production ; `pglite:<dossier>` (persistant) ou `pglite:memory` en dev et en tests. |
| `SESSION_SECRET` | **oui en production** | secret de dev | Secret de signature des cookies (≥ 16 caractères) : long et aléatoire. L’API refuse de démarrer en production sans lui. |
| `PUBLIC_URL` | **oui en production** | `http://localhost:3000` | Origine publique du site, sans chemin ni « / » final (ex. `https://cresus.example.com`) : émetteur OAuth, ressource MCP (`PUBLIC_URL/mcp`) et page de consentement. |
| `WEBAUTHN_RP_ID` | à régler en production (non vérifié au démarrage) | `localhost` | Passkeys : domaine exact du site (sans schéma ni port). |
| `WEBAUTHN_ORIGIN` | à régler en production (non vérifié au démarrage) | `http://localhost:3000` | Passkeys : origine exacte du site (`https://domaine`). |
| `WEBAUTHN_RP_NAME` | non | `Ma Tréso` | Nom affiché par le navigateur lors de l’enregistrement d’une passkey. |
| `COOKIE_SECURE` | `true` derrière HTTPS | `true` si `NODE_ENV=production`, sinon `false` | Marque le cookie de session `Secure`. |
| `SEED_DEMO` | non | `false` (`true` dans `.env.example`) | Crée le compte `demo@matreso.fr` au démarrage. À laisser à `false` en production. |
| `SEED_DEMO_PASSWORD` | non | `demo1234` | Mot de passe du compte de démo (≥ 8 caractères). |
| `AUTH_RATE_LIMIT` | non | `10` | Requêtes par minute et par IP sur `/api/auth/*`. |
| `OAUTH_RATE_LIMIT_MULTIPLIER` | non | `1` | Entier ≥ 1 qui multiplie les limites par défaut des routes OAuth (`/register`, `/token`…), par IP. Garde `1` en production ; relevé seulement pour les tests e2e. |
| `PORT` | non | `3001` en dev, `3000` dans l’image | Port HTTP du processus. |
| `NODE_ENV` | non | `development` (`production` dans l’image) | `production` active les contrôles de configuration ci-dessus. |
| `TZ` | non | `Europe/Paris` dans l’image | Fuseau du serveur : le serveur MCP en déduit la date du jour. |
| `WEB_DIST` | non | vide en dev, `/app/web` dans l’image | Dossier du front construit servi par l’API (posé par l’image, à ne pas changer). |

En production :

- `SESSION_SECRET` : une valeur longue et aléatoire (`openssl rand -hex 32`).
- `PUBLIC_URL` : l’origine publique réelle, avec `https://`. Les clients MCP et OAuth s’y fient pour retrouver l’émetteur et les routes.
- `WEBAUTHN_RP_ID` : le domaine exact du site, et `WEBAUTHN_ORIGIN` : `https://domaine`. Une passkey n’est valable que pour ce couple.
- `COOKIE_SECURE=true` derrière HTTPS. L’API suppose un seul proxy inverse devant elle (`trust proxy` à 1) pour lire l’IP du client.
- `SEED_DEMO=false`, pour ne pas exposer un compte au mot de passe connu.
- Le premier compte inscrit devient l’unique administrateur : sur un déploiement neuf, crée le tien avant de communiquer l’adresse.

## Connecter Claude Code

Ma Tréso embarque un serveur MCP (Streamable HTTP, sur `/mcp`) : Claude Code peut consulter ta trésorerie et gérer tes clients, congés et charges, au nom de ton compte. La connexion passe par OAuth 2.1 (PKCE), avec ton compte Ma Tréso : l’API est elle-même le serveur d’autorisation, dans la même image et sur le même domaine.

```bash
claude mcp add --transport http cresus https://cresus.gagnaire.dev/mcp
```

Puis, dans Claude Code, ouvre `/mcp`, choisis `cresus` et clique sur « Authenticate ». Le navigateur s’ouvre sur l’écran de consentement de Ma Tréso (connecte-toi d’abord si besoin) : vérifie l’adresse vers laquelle tu seras renvoyé, puis clique sur « Autoriser ». Pour révoquer l’accès, déconnecte-toi de l’app MCP depuis Claude Code (`/mcp`).

En développement (`npm run dev`), le même serveur répond sur `http://localhost:3000/mcp`.

Le point d’entrée `/mcp` répond en `POST` (mode sans session : un transport par requête) ; `GET` et `DELETE` renvoient 405. Les routes OAuth (`/authorize`, `/token`, `/register`, `/revoke`) et les métadonnées (`/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`) sont à la racine du domaine, hors du préfixe `/api`.

| Outil | Rôle |
| --- | --- |
| `get_overview` | Projection sur 15 mois (encaissements, charges, résultat, solde, état), synthèse et solde actuel. |
| `get_month` | Détail d’un mois : encaissements et charges. |
| `get_profile` · `update_profile` | Profil (statut juridique, net mensuel, options micro, pistes, alertes). |
| `set_balance` | Nouveau solde du compte. |
| `list_clients` · `create_client` · `update_client` · `delete_client` | Missions et clients (avec tarifs). |
| `add_rate` · `delete_rate` | Tarifs historisés d’un client. |
| `list_leaves` · `add_leaves` · `delete_leaves` | Congés (périodes, coût, mois d’impact). |
| `list_charges` · `create_charge` · `update_charge` · `delete_charge` | Charges. |
| `export_data` | Sauvegarde JSON complète. |

Les montants sont en euros, les dates au format `YYYY-MM-DD` et les mois au format `YYYY-MM`.

## Architecture

Monorepo npm workspaces :

```
.
├─ packages/
│  └─ engine/     @matreso/engine : moteur de calcul en TypeScript pur (projection, tarifs, congés, charges,
│                 rémunération, micro-entreprise, jours fériés, seed de démo). Partagé : exécuté dans le navigateur,
│                 et par l’API pour valider.
├─ apps/
│  ├─ api/        @matreso/api : NestJS 12 + Drizzle. PGlite en dev et en tests, PostgreSQL en production.
│  │              Auth (mot de passe, passkeys), données, export / import, serveur d’autorisation OAuth 2.1
│  │              et serveur MCP ; sert aussi le front construit en production.
│  └─ web/        @matreso/web : Nuxt 4 en SPA + Pinia, PWA installable. Tests e2e Playwright.
├─ scripts/       e2e-prod.mjs : suite Playwright contre le build de production
├─ Dockerfile     image unique (API + front), port 3000
└─ docker-compose.yml   PostgreSQL 16 + l’application
```

- **`packages/engine`** : pas de dépendance, pas d’entrées-sorties. Les paramètres réglementaires vivent dans `src/params` et se changent sans toucher aux écrans.
- **`apps/api`** : une seule origine pour tout (`/api`, OAuth, `/mcp`, SPA). Les mots de passe sont hachés avec Argon2, la session est un cookie `httpOnly` dont seul le hash est stocké, les jetons OAuth ne sont stockés que hachés.
- **`apps/web`** : calcule la projection dans le navigateur avec le moteur ; l’API ne fait que stocker les données et les valider.

## Limites de la v1

- **Paramètres réglementaires approximatifs** : coûts de rémunération, cotisations et plafonds micro, seuils de TVA sont des estimations à vérifier avant la mise en production (SPEC §9.1). L’app affiche « Estimation simplifiée, à affiner avec ton expert-comptable ».
- **Pas de TVA** : le solde projeté ne colle pas forcément au solde bancaire.
- **Pas d’envoi d’e-mail** : ni lien magique, ni réinitialisation du mot de passe (« Mot de passe oublié » affiche « Bientôt disponible »). La connexion se fait par e-mail et mot de passe, ou par passkey.
- **Notifications non envoyées** : les préférences d’alerte sont enregistrées, mais rien n’est émis.
- Pas de mode sombre, pas de synchronisation bancaire, pas de calendrier fiscal détaillé (SPEC §1).
