# Cresus

Caisse de buvette pour les associations de parents d'élèves (APE) : un gros bouton par article, un appui = une vente. Chaque évènement (kermesse, marché de Noël…) a ses articles, son bilan et son export Excel. Plusieurs téléphones vendent en même temps, les compteurs se mettent à jour en direct, et la caisse continue de marcher sans réseau.

- Conception : [`docs/superpowers/specs/2026-11-15-cresus-caisse-design.md`](docs/superpowers/specs/2026-11-15-cresus-caisse-design.md)
- Plan : [`docs/superpowers/plans/2026-11-15-cresus-caisse.md`](docs/superpowers/plans/2026-11-15-cresus-caisse.md)
- Produit et direction visuelle : [`apps/web/PRODUCT.md`](apps/web/PRODUCT.md), [`apps/web/.impeccable/surfaces/app.md`](apps/web/.impeccable/surfaces/app.md)

## Démarrer en local

Prérequis : Node 24 (`>= 24.11`). Aucun Docker : en développement la base est PGlite (PostgreSQL embarqué).

```bash
npm install
cp .env.example .env   # optionnel
npm run dev
```

- `npm run dev` construit `@cresus/shared`, puis lance l'API NestJS (port 3001) et Nuxt (port 3000), qui relaie `/api` (socket compris) vers l'API.
- Ouvrez http://localhost:3000 et créez le compte d'une asso.
- La base de dev est persistée dans `apps/api/.data/pglite` (`DATABASE_URL=pglite:memory` pour une base jetable).

## Tests

| Quoi | Commande |
| --- | --- |
| Partagé (pictos, montants) | `npm run test -w @cresus/shared` |
| API (Vitest + supertest sur PGlite, socket.io compris) | `npm run test -w @cresus/api` |
| File de ventes du front (Vitest) | `npm run test -w @cresus/web` |
| Types | `npm run typecheck -w @cresus/shared` · `-w @cresus/api` · `-w @cresus/web` |
| e2e en dev (Playwright, téléphone et tablette) | `npm run build -w @cresus/shared && npm run test:e2e -w @cresus/web` |
| e2e sur le build de production | `npm run e2e:prod` (l'API sert le front construit sur le port 3100, comme l'image Docker) |

Playwright demande Chromium : `npx playwright install chromium` la première fois.

## Déployer

Image Docker unique (`Dockerfile`) : l'API NestJS écoute sur le port 3000 et sert l'API (`/api`), le temps réel (`/api/socket.io`) et le front construit (PWA). Migrations jouées au démarrage, utilisateur `node`, `TZ=Europe/Paris`, `HEALTHCHECK` sur `/api/health`.

```bash
docker build -t cresus .
docker run -p 3000:3000 \
  -e DATABASE_URL=postgres://utilisateur:motdepasse@hote:5432/cresus \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  -e ADMIN_EMAILS=moi@exemple.fr \
  cresus
```

`docker-compose.yml` fournit un essai complet (PostgreSQL 16 + l'appli) : `SESSION_SECRET=$(openssl rand -hex 32) docker compose up --build`.

| Variable | Obligatoire | Défaut | Rôle |
| --- | --- | --- | --- |
| `DATABASE_URL` | oui en production | `pglite:./.data/pglite` | `postgres://…` en production ; `pglite:<dossier>` ou `pglite:memory` en dev. |
| `SESSION_SECRET` | oui en production | secret de dev | Signature des cookies (≥ 16 caractères, long et aléatoire). |
| `ADMIN_EMAILS` | non | vide | Emails (séparés par des virgules) des comptes qui ont accès au panneau d'admin (`/admin`). Le compte doit d'abord être créé avec cet email. |
| `COOKIE_SECURE` | `true` derrière HTTPS | `true` en production | Cookie de session `Secure`. |
| `AUTH_RATE_LIMIT` | non | `30` | Requêtes par minute et par IP sur `/api/auth/*` (assez pour 20 bénévoles qui se connectent sur le même wifi). |
| `PORT` | non | `3001` en dev, `3000` dans l'image | Port HTTP. |
| `TZ` | non | `Europe/Paris` dans l'image | Heures du bilan et de l'export. |

La production suppose un seul proxy inverse devant l'appli (`trust proxy` à 1), qui laisse passer les WebSockets.

### Mot de passe oublié

Il n'y a pas d'envoi d'email. L'admin réinitialise le mot de passe depuis le panneau d'admin (`/admin` › le compte › « Réinitialiser le mot de passe »), ou en ligne de commande dans le conteneur :

```bash
cd /app/apps/api && node dist/cli/reset-password.js ape@exemple.fr
```

Un mot de passe de 12 caractères est affiché et toutes les sessions du compte sont fermées.

## Architecture

```
packages/shared   @cresus/shared : types de l'API, catalogue de pictos et appariement par nom, montants. Compilé en dist/.
apps/api          @cresus/api : NestJS + Drizzle (PGlite en dev et tests, PostgreSQL en production) ; auth, évènements,
                  articles, ventes (envoi idempotent), export Excel (exceljs), temps réel (socket.io), panneau d'admin.
apps/web          @cresus/web : Nuxt 4 en SPA + Pinia, PWA installable ; file de ventes hors ligne (localStorage).
scripts/          build-pictos.mjs (extrait les SVG Fluent Emoji), build-icons.mjs (icônes PNG), e2e-prod.mjs.
```

- **Ventes** : chaque appui crée une vente avec un identifiant généré sur le téléphone, mise en file puis envoyée par lots à `POST /api/events/:id/sync`. L'envoi est idempotent (une vente renvoyée n'est comptée qu'une fois), une heure de téléphone aberrante est remplacée par l'heure de réception, et une vente d'un article inconnu est rejetée sans bloquer le lot.
- **Temps réel** : une salle socket.io par évènement ; après chaque envoi, le serveur diffuse les compteurs, et signale les articles modifiés et le nombre d'appareils connectés. Quand le socket est coupé, la caisse se rafraîchit toutes les 10 s.
- **Sessions** : cookie `httpOnly` de 24 h, prolongé à l'usage (au plus toutes les 5 minutes) ; l'appli ouverte le rappelle toutes les 5 minutes.
- **Pictos** : [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) © Microsoft, licence MIT (`apps/web/public/pictos/LICENSE.txt`). Après une modification du catalogue (`packages/shared/src/pictos.ts`) : `npm run pictos`.
- **Indexation** : jamais (`X-Robots-Tag: noindex, nofollow`, balise meta robots, `robots.txt`).

## Limites de la v1

- Pas de panier, de rendu de monnaie ni de moyen de paiement : un appui = une vente.
- Un seul compte par asso, partagé par les bénévoles (pas de rôles).
- Pas d'envoi d'email (mot de passe oublié : l'admin le réinitialise).
- Les pictos sont mis en cache à leur première vue : hors ligne, un picto jamais affiché sur ce téléphone n'apparaît pas.
