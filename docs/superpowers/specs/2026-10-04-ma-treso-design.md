# Ma Tréso — Spec technique (design d'implémentation)

Date : 2026-10-04 · Auteur : Guillaume Gagnaire (avec Claude)

Ce document décrit **comment** construire l'app décrite dans `SPEC.md` (le **quoi**). En cas de conflit sur une règle produit ou de calcul, `SPEC.md` fait foi. Les maquettes de référence sont dans `design/ma-treso-design/ecrans/*.dc.html` : le balisage et les styles en ligne servent de référence visuelle, et le bloc `<script type="text/x-dc">` donne la logique de démo et les données du seed.

## 1. Décisions

| Sujet | Décision | Source |
| --- | --- | --- |
| Front | Vue 3 + Nuxt 4, mode SPA (`ssr: false`, `nuxt generate`) | demande utilisateur |
| Back | NestJS (dernière majeure) | demande utilisateur |
| Base | PostgreSQL 16, ORM Drizzle (`drizzle-orm` + `drizzle-kit`) | demande utilisateur + SPEC §8.1 |
| Déploiement | **Une seule image Docker** : NestJS sert l'API sous `/api` et le build statique de Nuxt | approche A validée |
| Calcul | Moteur TS pur partagé (`packages/engine`), exécuté **dans le navigateur** ; l'API l'utilise seulement pour valider | SPEC §8.4 |
| Auth v1 | E-mail + mot de passe, **passkeys (Face ID / Touch ID / Windows Hello)**. Pas de lien magique ni d'envoi d'e-mail. | choix utilisateur |
| URLs | En anglais (`/login`, `/clients`, `/calendar`, `/expenses`, `/profile`) | choix utilisateur |
| Langue de l'interface | Français, tutoiement (SPEC §7.5) | SPEC |
| Node | 24 LTS (Nuxt 4.5 demande `^22.19 \|\| ^24.11`). En local, utiliser `C:\Users\guill\AppData\Roaming\nvm\v24.14.0` en tête de `PATH`, sans `nvm use` global. | contrainte outillage |

Réponses par défaut aux questions ouvertes de SPEC §9.4 : pas de TVA en v1 ; le net de rémunération n'est pas historisé ; l'app est personnelle (un compte = une personne, données isolées par `userId`), mais plusieurs comptes peuvent coexister dans un même déploiement.

## 2. Organisation du dépôt

Monorepo **npm workspaces** :

```
/
├─ package.json              # workspaces, scripts racine (dev, build, test, lint)
├─ tsconfig.base.json        # strict: true, noUncheckedIndexedAccess
├─ Dockerfile
├─ docker-compose.yml        # postgres + app (local / démo)
├─ .env.example
├─ packages/
│  └─ engine/                # @matreso/engine — TS pur, aucune dépendance runtime
│     ├─ src/
│     │  ├─ types.ts
│     │  ├─ dates.ts         # dates civiles ISO, arithmétique UTC
│     │  ├─ holidays.ts      # fériés FR, Pâques (algorithme de Meeus)
│     │  ├─ params/{index,2026,2027}.ts
│     │  ├─ rates.ts         # rateAt, classement Ancien/Actuel/À venir
│     │  ├─ billing.ts       # billableDays, monthlyAmount (TJM + forfait)
│     │  ├─ payment.ts       # paymentDate (échéance + retard)
│     │  ├─ income.ts        # projectIncome (avec et sans congés)
│     │  ├─ charges.ts       # projectCharges (+ lignes de rémunération)
│     │  ├─ results.ts       # monthResults, états, synthèse
│     │  ├─ leaves.ts        # leaveImpact, groupLeaves, isWorkingDay
│     │  ├─ remuneration.ts  # remunerationCost, comparaison 3 régimes
│     │  ├─ micro.ts         # microBreakdown, ceilingGauge, smoothedIncome
│     │  ├─ missions.ts      # frise, creux de CA, facturé vs encaissé
│     │  ├─ calendar.ts      # infos d'une case de calendrier
│     │  ├─ format.ts        # formats FR (€, k, dates courtes)
│     │  ├─ seed.ts          # données de démo (SPEC §8.6, maquettes)
│     │  └─ index.ts
│     └─ test/*.test.ts
├─ apps/
│  ├─ api/                   # @matreso/api — NestJS
│  │  ├─ src/
│  │  │  ├─ main.ts, app.module.ts
│  │  │  ├─ db/              # schéma Drizzle, client, migrations/
│  │  │  ├─ auth/            # mot de passe, sessions, passkeys, guard
│  │  │  ├─ profile/         # PATCH profil + préférences
│  │  │  ├─ balance/
│  │  │  ├─ clients/         # clients + tarifs
│  │  │  ├─ leaves/
│  │  │  ├─ charges/
│  │  │  ├─ state/           # GET /api/state
│  │  │  ├─ data/            # export / import / suppression du compte
│  │  │  ├─ seed/            # compte de démo
│  │  │  └─ health/
│  │  └─ test/               # e2e (vraie base PostgreSQL)
│  └─ web/                   # @matreso/web — Nuxt 4
│     ├─ nuxt.config.ts
│     ├─ app/
│     │  ├─ assets/css/      # tokens.css, base.css (classes globales des maquettes)
│     │  ├─ components/{ui,charts,icons,dashboard,clients,calendar,expenses,profile}/
│     │  ├─ composables/     # useApi, useBreakpoint, useToast
│     │  ├─ stores/          # treso.ts (Pinia), auth.ts
│     │  ├─ layouts/         # default (sidebar / tab bar), auth
│     │  ├─ middleware/      # auth.global.ts
│     │  └─ pages/
│     └─ e2e/                # Playwright
└─ design/ma-treso-design/   # maquettes (référence, non déployées)
```

`@matreso/engine` est construit avec `tsup` en ESM + CJS + `.d.ts`, pour que NestJS (CommonJS) et Nuxt (ESM, via un alias vers `src` en dev) puissent tous deux le consommer.

## 3. Moteur (`packages/engine`)

### 3.1 Conventions

- `ISODate = string` (`YYYY-MM-DD`), `MonthKey = string` (`YYYY-MM`), `Cents = number` (entier).
- Toute l'arithmétique de dates passe par `dates.ts`, avec `Date.UTC` en interne et aucun fuseau horaire. Fonctions : `parse`, `toISO`, `addDays`, `addMonths`, `lastDayOfMonth`, `daysInMonth`, `weekday` (0 = lundi … 6 = dimanche), `monthKey`, `eachDay(from, to)`, `monthRange(from, count)`, `diffDays`.
- Le moteur ne lit jamais l'horloge : `today: ISODate` est toujours passé en paramètre.
- Arrondis : les montants intermédiaires restent des nombres (les forfaits proratisés sont fractionnaires). Chaque montant de facture (client × mois) est arrondi au centime avec `Math.round` avant d'être agrégé. L'arrondi à la dizaine d'euros se fait **uniquement** dans `format.ts`.

### 3.2 Types principaux

```ts
type LegalStatus = 'SASU' | 'SAS' | 'SASU_IR' | 'SARL' | 'EURL_IS' | 'EURL_IR' | 'EI' | 'MICRO';
type SocialRegime = 'SALARIE' | 'TNS' | 'MICRO';
type PaymentTerm = 'RECEPTION' | 'NET_30' | 'NET_45' | 'EOM_30' | 'NET_60';
type BillingMode = 'TJM' | 'FORFAIT';
type ClientColor = 'indigo' | 'orange' | 'violet' | 'green' | 'rose' | 'teal';

interface Rate { id?: string; validFrom: ISODate; amount: Cents }
interface Client {
  id: string; name: string; subtitle: string | null; color: ClientColor;
  billingMode: BillingMode; weekdays: number[];            // 0..4, vide si FORFAIT
  startDate: ISODate; endDate: ISODate | null;
  paymentTerm: PaymentTerm; averageDelayDays: number;      // 0..30
  isProspect: boolean; archivedAt: string | null; rates: Rate[];
}
interface Leave { id?: string; date: ISODate; scope: 'ALL' | 'CLIENT'; clientId: string | null }
interface Charge { id: string; name: string; amount: Cents; frequency: 'MONTHLY' | 'YEARLY'; month: number | null; category: string | null }
interface Profile {
  firstName: string; legalStatus: LegalStatus; netPayMonthly: Cents;
  microVersementLiberatoire: boolean; microIncomeTaxProvisionPct: number; microProExpensesMonthly: Cents;
  includeProspects: boolean;
}
interface EngineInput {
  today: ISODate; profile: Profile; clients: Client[]; leaves: Leave[]; charges: Charge[];
  balance: { date: ISODate; amount: Cents } | null;          // dernier BalanceSnapshot
}
```

Les clients archivés (`archivedAt` non null) sont exclus de tous les calculs. Les pistes (`isProspect`) ne sont comptées que si `includeProspects` est vrai, ou si l'appelant force l'option (case « Compter la piste » de l'écran congés).

### 3.3 Fonctions (contrats)

| Fonction | Contrat |
| --- | --- |
| `holidays(year)` → `Map<ISODate, string>` | Fériés FR nommés. Fêtes mobiles calculées depuis Pâques. Lundi de Pentecôte inclus. Mise en cache par année. |
| `isWorkingDay(date)` | Du lundi au vendredi, et pas férié. |
| `rateAt(client, date)` | Montant du tarif dont `validFrom` est le plus grand ≤ `date`, sinon 0. |
| `rateStatus(rates, today)` | Classe chaque tarif en `PAST` (Ancien), `CURRENT` (Actuel) ou `FUTURE` (À venir). |
| `billableDays(client, month, leaves)` | Jours du mois remplissant les 4 conditions de SPEC §4.1. |
| `monthlyAmount(client, month, leaves \| null)` | TJM : somme des `rateAt` sur les jours facturables. Forfait : somme sur les jours actifs de `rateAt / daysInMonth` (SPEC §4.3). `leaves = null` calcule le montant sans congés. |
| `paymentDate(client, workMonth)` | Facture datée du dernier jour du mois, échéance selon SPEC §4.4, puis `+ averageDelayDays`. |
| `projectIncome(input, opts)` → `IncomeEntry[]` | Pour chaque client compté et chaque mois travaillé de `firstMonth − 8` à `lastMonth`, une entrée `{ clientId, workMonth, cashDate, cashMonth, amount, amountWithoutLeaves, leaveCost }`. On garde les entrées dont `cashMonth` tombe dans la fenêtre, et on écarte celles dont le montant sans congés vaut 0. `opts = { firstMonth, months, includeProspects?, extraClients? }`. |
| `projectCharges(input, month)` → `ChargeItem[]` | Charges MONTHLY, plus les YEARLY dont `month` correspond, plus en mode société deux lignes calculées `{ computed: true }` : « Salaire (net) » et « Cotisations sociales ». |
| `monthResults(input, opts)` → `MonthResult[]` | Sur 15 mois à partir du mois de `today` : encaissements avec et sans congés, charges, résultat avec et sans congés, solde avec et sans congés, état. Le solde initial (le snapshot, ou 0) s'applique au début du mois courant. |
| `monthState(r)` | `OVERDRAFT` si solde < 0, sinon `RED_DUE_TO_LEAVES` si résultat < 0 et résultat sans congés ≥ 0, sinon `RED` si résultat < 0, sinon `POSITIVE`. |
| `resultsSummary(results)` | `{ redCount, overdraftCount, lowestBalance, lowestBalanceMonth }`. Fournit le texte de synthèse « 3 mois dans le rouge, jamais à découvert ». |
| `leaveImpact(input, date)` | Pour chaque client TJM compté, actif et présent ce jour-là, et touché par un congé de ce jour (scope ALL ou CLIENT de ce client) : coût = `rateAt`, mois d'impact = `paymentDate(client, mois du congé).cashMonth`. |
| `groupLeaves(input)` → `LeavePeriod[]` | Regroupement selon SPEC §4.6 : même scope et même `clientId`, aucun jour ouvré non férié entre deux jours. Chaque période porte `{ from, to, dates, leaveIds, scope, clientId, dayCount, cost, impacts: { cashMonth, amount }[] }`. |
| `remunerationCost(net, status)` | `{ regime, total, contributions, totalLabel }` selon SPEC §4.8. |
| `remunerationComparison(net)` | Coût du même net dans les 3 régimes. |
| `microBreakdown(income, profile, params)` | `{ income, contributions, tax, proExpenses, forYou }` selon SPEC §4.9. |
| `ceilingGauge(input, year, opts)` | Encaissements de l'année civile : réel = mois avant le mois courant, prévu = mois courant et suivants. Rend `{ actual, planned, total, ceiling, pct, level: 'OK' \| 'WARN' \| 'OVER', overMonth, vatThreshold, vatMonth }`. Seuil WARN à 85 %. Option `testMission` (voir 3.4). |
| `smoothedIncome(input)` | Moyenne de `forYou` sur 12 mois à partir du mois courant, avec la liste des mois sous 60 % de la moyenne. |
| `missionTimeline(input, months = 12)` | Pour la frise : position de début et de fin de chaque client dans la fenêtre, ouverte à droite si pas de fin, piste. Plus les mois de « creux de CA » (montant facturé < 75 % du meilleur mois). |
| `billedVsCashed(input, months = 12)` | Par mois et par client : facturé (montant du mois travaillé) et encaissé (mois d'encaissement), pour les barres empilées. |
| `averageMonthly(client, input)` | Montant mensuel moyen facturé sur les 12 mois glissants. Sert à la colonne « Montant mensuel moyen » et au « CA / mois » des fiches. |
| `calendarDay(input, date, scopeFilter)` | `{ weekend, holidayName, clients: ClientColor[], leave: Leave \| null, clickable }` pour une case du calendrier. |
| `format.ts` | `euros(cents)` donne « −2 310 € » : arrondi à la dizaine, espace insécable fine, signe moins U+2212. `signedEuros` ajoute le « + ». `kEuros(cents)` donne « +5,3k ». S'y ajoutent `shortDate` (« 30 nov. », « 1er janv. »), `monthLabel`, `monthShort` et `relativeDays` (« il y a 12 jours »). |

### 3.4 Paramètres (`params/`)

`paramsFor(year)` renvoie les valeurs de l'année, ou à défaut celles de la dernière année connue. Valeurs 2026 et 2027 (SPEC §9.1) : `salarieCoef 1.80`, `tnsCoef 1.45`, `microContributionRate 0.261`, `microVersementLiberatoireRate 0.022`, `microCeiling 8_360_000`, `vatThreshold 3_750_000`.

**Mission test (micro)** : elle ajoute un client fictif en TJM, présent le lundi, à 650 €/j, du 1er du mois suivant `today` jusqu'à sans fin, payé à 30 jours sans retard. Le libellé reprend la maquette : « Tester une mission en plus : lundi, 650 €/j, dès novembre ».

### 3.5 Seed de démo (`seed.ts`)

Ce sont les données exactes des maquettes (`Main.dc.html`) :

- **Solde** : 48 320 € au 2026-10-04.
- **Client A** (indigo) : lundi et vendredi ; 650 € dès 2026-10-01, 700 € dès 2027-01-01 ; du 2026-10-01 au 2027-05-31 ; 30 jours fin de mois ; retard 0.
- **Client B** (orange, « Via ESN ») : mardi à jeudi ; 550 € dès 2026-03-02, 600 € dès 2026-09-01 ; à partir du 2026-03-02, sans fin ; 45 jours ; retard 10.
- **Client C** (violet, piste) : lundi et vendredi ; 700 € dès 2027-07-01 ; du 2027-07-01 au 2027-12-31 ; 30 jours ; retard 5.
- **Client D** (vert, « Maintenance ») : forfait ; 1 200 € dès 2026-11-01, 1 350 € dès 2027-04-01 ; à partir du 2026-11-01, sans fin ; 30 jours.
- **Congés** :
  - ALL du 2026-12-24 au 2026-12-31 (jours ouvrés non fériés) ;
  - CLIENT A le 2027-05-07 (pont de l'Ascension) ;
  - ALL du 2027-08-02 au 2027-08-20.
- **Profil** : SASU, net 4 000 €.
- **Charges** (8 saisies, les 2 lignes de rémunération étant calculées) :
  - mensuelles : Provision impôts 850 €, Véhicule (LLD) 420 €, Expert-comptable 180 €, Prévoyance et mutuelle 140 €, Logiciels 95 €, Banque pro 29 € ;
  - annuelles : Assurance RC Pro 660 € en janvier, CFE 600 € en décembre.

Test de référence : avec `today = 2026-10-04`, octobre 2026 donne un résultat de −2 314 € (affiché « −2 310 € ») et un solde de 46 006 € (affiché « 46 010 € »), dans l'état `RED`.

### 3.6 Tests

Vitest, couverture v8 avec un seuil de **90 %** (lignes et branches) sur `packages/engine/src`. Les tests couvrent toute la liste de SPEC §8.5, les critères de calcul de SPEC §9.3 (seed d'octobre, TJM de A sans effet avant mars 2027, forfait démarrant le 15, congés de fin décembre, EURL_IS → 5 800 €, dépassement du plafond par la mission test) et les fériés 2026/2027 (Pâques 2026-04-05, 2027-03-28).

## 4. API (`apps/api`)

### 4.1 Schéma (Drizzle, PostgreSQL 16)

Toutes les tables métier portent `user_id uuid not null references users on delete cascade`. Les montants sont des `integer` en centimes, les dates des `date` (mode `string` dans Drizzle), les identifiants des `uuid default gen_random_uuid()`.

| Table | Colonnes (hors id, user_id, created_at) |
| --- | --- |
| `users` | `email` (unique, en minuscules), `password_hash`, `first_name`, `company_name?`, `legal_status` (enum), `net_pay_monthly`, `micro_versement_liberatoire`, `micro_income_tax_provision_pct` (10 par défaut), `micro_pro_expenses_monthly` (18 000 par défaut), `include_prospects`, `alert_red_month`, `alert_late_payment` |
| `sessions` | `id` (hash SHA-256 du jeton), `expires_at` |
| `passkeys` | `credential_id` (unique, base64url), `public_key` (bytea), `counter` (bigint), `transports` (text[]), `device_name?` |
| `balance_snapshots` | `date`, `amount` |
| `clients` | `name`, `subtitle?`, `color` (enum de 6), `billing_mode`, `weekdays` (smallint[]), `start_date`, `end_date?`, `payment_term`, `average_delay_days`, `is_prospect`, `archived_at?`, `position` (ordre A/B/C/D) |
| `rates` | `client_id` (fk cascade), `valid_from`, `amount` ; unique `(client_id, valid_from)` |
| `leaves` | `date`, `scope`, `client_id?` (fk cascade) ; unique `(user_id, date, client_id) NULLS NOT DISTINCT` |
| `charges` | `name`, `amount`, `frequency`, `month?`, `category?` |

`faceIdEnabled` n'est pas stocké : il vaut « au moins une passkey enregistrée ». Les migrations sont générées par `drizzle-kit generate` et appliquées au démarrage de l'API (`migrate()`) avant l'écoute.

### 4.2 Endpoints

Tous les endpoints sont sous `/api`, en JSON. Ils exigent une session, sauf ceux marqués « public ». Les entrées sont validées avec **zod** via un pipe Nest. Les erreurs suivent le format `{ statusCode, code, message }`, avec `message` en français affichable tel quel.

| Méthode et chemin | Rôle |
| --- | --- |
| `GET /health` (public) | Santé et connexion à la base |
| `POST /auth/register` (public) | `{ email, password (≥ 8), firstName }` → crée l'utilisateur et la session (SASU et net 0 par défaut) |
| `POST /auth/login` (public) | `{ email, password }` |
| `POST /auth/logout` | Supprime la session |
| `GET /auth/me` | Utilisateur courant + `hasPasskey` |
| `PATCH /auth/password` | `{ currentPassword, newPassword }` |
| `POST /auth/passkeys/register/options` puis `/register/verify` | Enregistre une passkey (activer Face ID) |
| `POST /auth/passkeys/login/options` puis `/login/verify` (public) | Connexion par passkey (identifiants découvrables, sans saisir d'e-mail) |
| `DELETE /auth/passkeys` | Désactive Face ID en supprimant les passkeys de l'utilisateur |
| `GET /state` | `{ profile, balance: { latest, history }, clients (avec rates), leaves, charges, hasPasskey }` |
| `PATCH /profile` | Champs du profil et préférences (tous optionnels) |
| `POST /balance` | `{ amount, date? }` → nouveau snapshot (`date` = aujourd'hui par défaut) |
| `POST /clients` · `PATCH /clients/:id` · `DELETE /clients/:id` | CRUD client. La création exige un premier tarif `{ validFrom, amount }`. |
| `POST /clients/:id/rates` | Upsert sur `(clientId, validFrom)` |
| `DELETE /clients/:id/rates/:rateId` | Renvoie 409 `LAST_RATE` si c'est le dernier tarif |
| `POST /leaves` | `{ from, to?, scope, clientId? }` → crée un congé par jour ouvré non férié de l'intervalle, en ignorant les doublons. Renvoie 422 `NOT_A_WORKING_DAY` si aucun jour n'est valide (cas d'un jour unique tombant un week-end ou un férié). |
| `POST /leaves/delete` | `{ ids: string[] }` → supprime une période ou un jour |
| `POST /charges` · `PATCH /charges/:id` · `DELETE /charges/:id` | CRUD charge (`month` requis si YEARLY) |
| `GET /export` | `{ format: 'ma-treso', version: 1, exportedAt, profile, balanceSnapshots, clients, leaves, charges }` |
| `POST /import` | Même format. Validation zod, puis **remplacement complet** des données de l'utilisateur dans une transaction (les identifiants sont régénérés et les références remappées). |
| `DELETE /account` | `{ password }` → supprime le compte et toutes ses données |

Les règles métier côté serveur réutilisent `@matreso/engine` (`isWorkingDay`), pour que le front et l'API appliquent exactement la même règle.

### 4.3 Sessions et sécurité

- Mot de passe haché avec `@node-rs/argon2` (binaires précompilés, compatibles musl/alpine).
- Session : jeton aléatoire de 32 octets dans le cookie `mt_session` (`httpOnly`, `SameSite=Lax`, `Secure` en production, `Path=/`). La base stocke son hash. Durée de 30 jours, glissante.
- Challenges WebAuthn : cookie signé `httpOnly` de 5 minutes (aucune table). Bibliothèque `@simplewebauthn/server` côté serveur, `@simplewebauthn/browser` côté front. Les variables `WEBAUTHN_RP_ID` et `WEBAUTHN_ORIGIN` sont obligatoires en production. En local : `localhost` et `http://localhost:3000`.
- Les mutations n'acceptent que du `application/json`. Avec `SameSite=Lax`, cette vérification sert de protection CSRF suffisante pour une app servie depuis une seule origine.
- Limitation de débit sur `/auth/*` (`@nestjs/throttler`, 10 requêtes par minute et par IP).
- Pas de journalisation des montants ni des corps de requête.

### 4.4 Service statique

`@nestjs/serve-static` sert `apps/web/.output/public` (configurable par `WEB_DIST`), avec un repli SPA vers `index.html` pour tout chemin hors `/api`. Les assets fingerprintés ont un cache long, `index.html` et le service worker passent en `no-cache`.

### 4.5 Seed

Si `SEED_DEMO=true`, le démarrage crée le compte `demo@matreso.fr` (mot de passe `SEED_DEMO_PASSWORD`, `demo1234` par défaut) avec les données de `@matreso/engine/seed`, à condition que ce compte n'existe pas déjà. La commande `npm run seed -w @matreso/api` fait la même chose à la demande.

### 4.6 Tests

Les tests e2e (Vitest + `unplugin-swc` + supertest) tournent sur une vraie base PostgreSQL (`DATABASE_URL_TEST`, fournie par `docker compose up -d db`). Ils couvrent :

- inscription, connexion et déconnexion, isolation entre deux utilisateurs ;
- refus d'un congé un week-end ou un jour férié, interdiction de supprimer le dernier tarif, upsert d'un tarif ;
- aller-retour export → import identique, suppression du compte.

Pour les passkeys, on teste les endpoints d'options et le refus d'une réponse invalide. Le parcours complet se vérifie manuellement dans un navigateur.

## 5. Web (`apps/web`)

### 5.1 Routes

| Route | Desktop | Mobile (< 1024 px) |
| --- | --- | --- |
| `/login` | Carte centrée, contenu de « Mobile-Connexion » | Mobile-Connexion |
| `/` | Main (société) ou Main-Micro (selon `legalStatus`) | Mobile-Accueil ou Mobile-Accueil-Micro |
| `/clients` | Clients (frise, tableau, fiche dans le panneau droit, encaissements) | Mobile-Missions (semaine type + fiches) |
| `/clients/new`, `/clients/:id` | Ouvre `/clients` avec la fiche sélectionnée | Mobile-Client (écran poussé, bouton retour) |
| `/calendar` | Calendrier | Mobile-Conges |
| `/expenses` | Charges | Mobile-Charges |
| `/profile` | Profil dans le contenu principal, accessible par la pastille utilisateur en bas de la sidebar | Mobile-Profil (pastille GD en haut à droite) |

Le sélecteur Société / Micro-entreprise des en-têtes change `legalStatus` : Micro règle le statut sur `MICRO` ; Société restaure le dernier statut société utilisé, mémorisé en local (SASU par défaut).

Un middleware global redirige vers `/login` sans session, et vers `/` si l'utilisateur déjà connecté ouvre `/login`.

### 5.2 État et données

- `stores/auth.ts` : `me`, `login`, `register`, `logout`, `loginWithPasskey`, `enablePasskey`, `disablePasskey`.
- `stores/treso.ts` (Pinia) contient les données brutes renvoyées par `/api/state`. Ses getters `computed` appellent le moteur : `results`, `incomeByMonth`, `chargesByMonth`, `leavePeriods`, `micro`, `gauge(year)`, `timeline`, etc. `today` vient d'un `ref` initialisé à la date locale du navigateur au format ISO.
- Mutations **optimistes** : on applique localement, on appelle l'API, puis on réconcilie avec la réponse (identifiants créés). En cas d'erreur : rollback et toast `role="status"` avec le message de l'API.
- L'état d'interface (mois sélectionné, filtre « Poser chez », année de la jauge, mission test, case « Compter la piste » de l'écran congés) reste local aux pages et n'est pas persisté. Exception : « Compter les pistes » de l'écran Clients persiste `includeProspects`.
- Les composants ne font aucun calcul métier : ils formatent avec `format.ts` et affichent.

### 5.3 Design system

- `tokens.css` reprend en variables CSS les jetons de SPEC §7.1 (`--bg`, `--surface`, `--ink`, `--sun`, `--client-indigo`…). Palette client : indigo `#4B4BE0`, orange `#FF8A3D`, violet `#9B6BFF`, vert `#2E9E6A`, et deux couleurs ajoutées pour atteindre les 6 de la spec : rose `#D9467A`, teal `#1F8FA6`.
- `base.css` reprend les classes globales des maquettes (`.card`, `.lbl`, `.btn`, `.btn.pri`, `.tip`, `.ico`, `.field`, `.num`, tableaux, `input[type=range]`), à l'identique des blocs `<style>` des `.dc.html`.
- Polices auto-hébergées via `@fontsource-variable/bricolage-grotesque` et `@fontsource-variable/figtree`, pour l'usage hors ligne en PWA et pour éviter tout appel à Google Fonts.
- Composants `ui/` : `AppButton`, `SegmentedControl`, `ChoiceChips` (`aria-pressed`), `ToggleSwitch` (`role="switch"`, 56 × 34), `TipBubble`, `KpiCard`, `MoneyInput`, `FieldRow`, `ListRow`, `ClientBar`, `Badge`, `ToastHost`.
- Composants `charts/` (SVG ou HTML maison, avec un `aria-label` par barre, par exemple « février 2027 : −2 310 € ») : `ResultBars`, `MiniBars`, `MissionTimeline`, `CeilingGauge`, `StackedCashBars`, `LeaveImpactBars`, `SplitBar`, `SmoothedBars`.
- `icons/` : icônes SVG en trait de 2 px reprises des maquettes. Jamais d'emoji.
- Chaque écran est porté depuis sa maquette : même structure, mêmes textes, mêmes tailles. Les données de démo codées en dur sont remplacées par le store.
- Les estimations affichent la mention « Estimation simplifiée, à affiner avec ton expert-comptable » (SPEC §9.1).

### 5.4 Responsive et accessibilité

- Point de rupture à 1 024 px. Au-dessus : sidebar violette de 260 px et contenu limité à 1 180 px. En dessous : barre d'onglets fixe en bas (4 onglets, pastille jaune derrière l'actif), marges de 20 px, `env(safe-area-inset-*)`.
- `useBreakpoint()` choisit entre la variante desktop et la variante mobile des pages dont la structure diffère. Ailleurs, les media queries suffisent.
- Les règles de SPEC §6 et §7.6 s'appliquent : cibles ≥ 44 px, aucun défilement horizontal à 390 px, focus visible, états jamais portés par la couleur seule.

### 5.5 PWA

`@vite-pwa/nuxt` génère le manifest (nom « Ma Tréso », `theme_color` `#1F1A2E`, `background_color` `#FFF7EC`, icônes générées depuis le logo GD) et un service worker qui précache les assets. L'API n'est pas mise en cache. Si le module n'est pas compatible avec la version de Nuxt installée, on se replie sur un manifest statique et un service worker minimal écrit à la main.

### 5.6 Tests

- Playwright sur l'app construite (`docker compose up`) :
  - connexion au compte de démo ;
  - verdict d'octobre (« −2 310 € », « 46 010 € ») ;
  - pose puis retrait d'un congé depuis le calendrier ;
  - passage en EURL à l'IS (cotisations à 1 800 €) ;
  - passage en micro et mission test (mois de dépassement affiché).
- Projet mobile (390 × 844) : pour chaque route, `scrollWidth ≤ 390` et cibles ≥ 44 px sur les boutons visibles.
- La date de test est figée au 2026-10-04 avec `page.clock`.

## 6. Déploiement

- **Dockerfile** multi-étapes sur `node:24-alpine` :
  1. `deps` : `npm ci` ;
  2. `build` : engine (tsup), puis web (`nuxt generate`), puis api (`nest build`) ;
  3. `runtime` : dépendances de production de l'API, `apps/api/dist`, `apps/web/.output/public`, migrations Drizzle.
- L'image tourne avec l'utilisateur `node`, expose le port `3000` et déclare un `HEALTHCHECK` sur `/api/health`.
- **docker-compose.yml** : `db` (postgres:16-alpine, volume nommé) et `app` (build local, `depends_on` avec healthcheck).
- **Variables d'env** (`.env.example`) : `DATABASE_URL`, `SESSION_SECRET` (signature des cookies de challenge), `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`, `WEBAUTHN_RP_NAME=Ma Tréso`, `PORT=3000`, `NODE_ENV`, `SEED_DEMO`, `SEED_DEMO_PASSWORD`, `COOKIE_SECURE`.
- **Dev local** : `docker compose up -d db`, puis `npm run dev`, qui lance l'API Nest en watch sur le port 3001 et Nuxt sur le port 3000 avec un proxy `/api` → 3001.

## 7. Correspondance avec les critères d'acceptation (SPEC §9.3)

| Critère | Vérifié par |
| --- | --- |
| Seed : octobre −2 310 € / 46 010 € | test moteur + Playwright |
| TJM A à 700 € au 01/2027 : aucun effet avant mars 2027 | test moteur |
| Forfait démarrant le 15 ≈ moitié du montant | test moteur |
| 5 jours de congé fin décembre (ALL) : janvier et février baissent | test moteur |
| Congé sur un férié ou un week-end refusé | test moteur (`isWorkingDay`) + e2e API (422) + calendrier non cliquable |
| Suppression du dernier tarif impossible | e2e API (409) + bouton masqué dans l'UI |
| EURL_IS : 7 200 € → 5 800 €, le total suit | test moteur + Playwright |
| Micro : la mission test fait dépasser le plafond, mois du dépassement en rouge | test moteur + Playwright |
| 390 px sans défilement horizontal, cibles ≥ 44 px | Playwright, projet mobile |
| Couverture du moteur ≥ 90 % | seuil Vitest bloquant |

## 8. Hors périmètre de cette implémentation

Tout ce que SPEC §1 classe hors périmètre, plus :

- lien magique et réinitialisation du mot de passe par e-mail (« Mot de passe oublié » affiche « Bientôt disponible ») ;
- notifications : les préférences d'alerte sont stockées, mais rien n'est envoyé ;
- mode sombre.
