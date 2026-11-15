# Cresus — caisse de buvette pour APE (conception)

Date : 2026-11-15 · Remplace entièrement « Ma Tréso » sur https://cresus.gagnaire.dev

## 1. Intention

Pendant une kermesse, un marché de Noël ou une buvette de fin d'année, les bénévoles d'une APE (association de parents d'élèves) vendent des crêpes, des sodas, des tickets de tombola… et doivent savoir, à la fin, **combien ils ont vendu de quoi et pour combien**. Aujourd'hui c'est un carnet, des bâtons sur une feuille, ou rien.

Cresus est un compteur de ventes sur téléphone : **un gros bouton par article, un appui = une vente**. L'APE retrouve ensuite le chiffre de chaque évènement et l'exporte en Excel pour sa trésorerie.

Ce qui fait le succès :
- un bénévole qui n'a jamais vu l'appli s'en sert sans explication, en plein rush, avec une main ;
- le total à la fin est juste, même si le réseau a coupé dans la cour d'école ;
- le trésorier a son fichier Excel en un clic.

Ce qui serait un échec même si « ça marche » : des boutons petits ou serrés (fautes de frappe en rush), une vente perdue faute de réseau, un écran de caisse encombré de réglages, une saisie d'articles fastidieuse.

## 2. Décisions de Guillaume

- Caisse pour une ou plusieurs APE ; **un email = une asso** (un compte par asso).
- **Connexion par email + mot de passe**. Pas d'envoi d'email.
- **Les bénévoles partagent les identifiants de l'asso** et se connectent sur leur propre téléphone ; tous ont accès à tout. Plusieurs téléphones vendent en même temps sur le même évènement.
- **Compteur simple** : chaque appui sur un bouton enregistre une vente, tout de suite. Ni panier, ni total par client, ni moyen de paiement.
- **Gestion par évènement** ; **export Excel des recettes**.
- Front Vue, back NestJS, dans l'esprit de l'existant.
- **Pictos automatiques** selon le nom de l'article, tirés d'une base d'images libres de droit.
- Reset total sur le même domaine ; **déploiement sans sauvegarde** : la base actuelle (Ma Tréso) est vidée.

## 3. Non-objectifs (v1)

Panier, rendu de monnaie, moyens de paiement, fonds de caisse ; comptes bénévoles séparés, rôles, lien/QR de caisse ; envoi d'emails (lien magique, mot de passe oublié) ; gestion de stock chiffrée ; photos importées par l'utilisateur ; multi-devise ; mode sombre ; statistiques multi-évènements.

## 4. Le produit

### 4.1 Compte (asso)

- Inscription : nom de l'asso, email, mot de passe (≥ 8 caractères). Email unique (insensible à la casse). Inscription ouverte.
- Connexion : email + mot de passe. La session dure 24 h et se prolonge à l'usage : tant que l'appli est ouverte, elle est rallongée toutes les 5 minutes (demande de Guillaume, la sécurité n'étant pas critique).
- Réglages : modifier le nom de l'asso, changer le mot de passe (déconnecte les **autres** appareils), se déconnecter, supprimer le compte (mot de passe demandé, supprime tout).
- Mot de passe oublié : pas de parcours en v1. L'écran de connexion le dit. L'administrateur du serveur peut réinitialiser un mot de passe en ligne de commande (`npm run reset-password -w @cresus/api -- <email>`, utilisable depuis le terminal Coolify).

### 4.2 Évènements

- Un évènement : un nom (« Kermesse 2027 ») et une date.
- Liste des évènements, du plus récent au plus ancien, avec le total encaissé et le nombre de ventes.
- Créer un évènement : nom, date (aujourd'hui par défaut) et, en option, « Reprendre les articles de… » un évènement précédent (copie nom, prix, picto, ordre, en vente).
- Modifier nom/date ; supprimer (confirmation, supprime ses articles et ventes).

### 4.3 Articles (par évènement)

- Un article : nom (1–40 caractères), prix (0 € à 999,99 €, au centime), picto (automatique par défaut, ou choisi), ordre d'affichage, « en vente » (oui/non — non = masqué de la caisse, ex. épuisé).
- Les articles appartiennent à l'évènement. On ne gère pas de catalogue global : la copie depuis un évènement précédent tient ce rôle.
- Ajout rapide : on tape le nom et le prix ; le picto se choisit tout seul pendant la frappe et s'affiche en aperçu. Un appui sur l'aperçu ouvre le sélecteur de pictos (recherche + grille + « Automatique »).
- Réordonner par flèches monter/descendre (plus fiable au doigt que le glisser-déposer).
- Supprimer : si l'article n'a aucune vente, il disparaît ; sinon il est archivé (n'apparaît plus en caisse ni en gestion, reste dans le bilan et l'export).
- Changer le prix n'affecte pas les ventes passées (chaque vente garde le prix du moment).
- La gestion des articles demande du réseau (la caisse, non : voir 4.5).

### 4.4 L'écran de caisse

C'est l'écran principal, ouvert depuis la liste des évènements.

- En haut, sobre : nom de l'évènement, **total encaissé** et nombre de ventes de l'évènement (tous téléphones confondus), indicateur de synchronisation (à jour / N ventes en attente / hors ligne).
- Le reste : une **grille de grosses tuiles**, une par article en vente, dans l'ordre choisi. Chaque tuile : picto en grand, nom, prix, et le compteur de ventes de l'article.
- Taille : 2 colonnes sur téléphone en portrait, plus sur tablette ou en paysage ; tuile d'au moins 140 px de haut ; espacement suffisant pour éviter les fautes.
- **Un appui = une vente** : retour visuel immédiat (la tuile « pulse », le compteur et le total montent), petite vibration si l'appareil le permet.
- Après chaque appui, un bandeau « Crêpe nutella +1 · **Annuler** » reste quelques secondes. « Annuler » retire cette vente. Plusieurs appuis rapides : le bandeau porte sur le dernier, et l'annuler retire la vente la plus récente de ce téléphone.
- Liens discrets : Articles, Bilan. Aucun réglage sur l'écran de caisse.
- L'écran reste allumé pendant la caisse si le navigateur le permet (Wake Lock), sans erreur sinon.
- Évènement sans article : l'écran invite à ajouter des articles.
- Les compteurs se rafraîchissent seuls (toutes les ~10 s quand l'écran est visible et le réseau présent) pour refléter les ventes des autres téléphones.

### 4.5 Sans réseau

- L'appli s'installe (PWA) et son interface est en cache.
- Une vente est d'abord enregistrée sur le téléphone (identifiant unique généré sur place, prix et heure du moment), puis envoyée au serveur dès que possible : juste après l'appui, au retour du réseau, et périodiquement.
- Hors ligne, la caisse fonctionne avec les articles et compteurs connus au dernier passage en ligne ; les ventes en attente s'ajoutent aux compteurs affichés.
- L'envoi est idempotent : une vente renvoyée deux fois n'est comptée qu'une fois. Une annulation hors ligne est envoyée comme une annulation.
- Les ventes en attente survivent à la fermeture de l'onglet et au redémarrage du téléphone. Elles sont rattachées au compte : si la session a expiré, elles attendent la reconnexion au même compte.
- Hors ligne, les écrans qui demandent le serveur (gestion des articles, bilan, export) disent clairement qu'il faut du réseau.

### 4.6 Bilan et export

- Bilan de l'évènement : total encaissé, nombre de ventes, tableau par article (quantité, total, en ordre de caisse, archivés inclus), ventes par heure (barres simples).
- Historique : les dernières ventes (heure, article, prix), avec « Supprimer » sur chacune (confirmation) pour corriger une erreur venue de n'importe quel téléphone.
- **Export Excel** (`.xlsx`) de l'évènement, nommé `cresus-<évènement>-<date>.xlsx` :
  - « Récapitulatif » : asso, évènement, date, date d'export ; puis Article | Prix unitaire | Quantité | Total, une ligne par article et par prix pratiqué ; ligne de total.
  - « Ventes » : Date | Heure | Article | Prix, toutes les ventes non annulées, par ordre chronologique.
  - « Par heure » : Tranche horaire | Nombre de ventes | Montant.
  - Montants au format monétaire €, heures en Europe/Paris.

## 5. Les pictos

- Source : **Fluent Emoji** de Microsoft, style « Color », **licence MIT** (récupéré via le paquet npm `@iconify-json/fluent-emoji`). Mention de licence livrée avec les fichiers et affichée dans les réglages (« Pictos : Fluent Emoji © Microsoft, licence MIT »).
- Une base choisie d'environ 120 pictos couvrant buvettes, kermesses et ventes d'APE : sucré (crêpe, gaufre, gâteau, cookie, beignet, bonbons, glace, popcorn…), salé (hot-dog, sandwich, croque, pizza, frites, merguez, chips…), boissons (eau, soda, jus, café, thé, chocolat chaud, bière, vin, cidre, champagne…), fruits, kermesse (ticket, tombola, pêche à la ligne, chamboule-tout, maquillage, ballon, lot, peluche…), ventes diverses (sapin, plantes, fleurs, livres, t-shirt, calendrier, gourde…), et un picto générique (étiquette).
- Chaque picto a un nom affiché en français et une liste de mots-clés français (singulier, synonymes, marques courantes : « coca », « nutella », « oasis », « kinder »…).
- Choix automatique depuis le nom de l'article : minuscules, accents et ponctuation retirés, pluriels simples ramenés au singulier. Les expressions de plusieurs mots l'emportent (« barbe à papa », « pain au chocolat », « hot dog », « croque monsieur », « pomme d'amour »), puis le mot-clé trouvé le plus tôt dans le nom (« jus de pomme » → jus ; « gâteau au chocolat » → gâteau ; « crêpe nutella » → crêpe). Aucun mot-clé : picto générique.
- L'article stocke soit un picto choisi, soit « automatique » ; en automatique, renommer l'article met le picto à jour.
- Les SVG sont servis comme fichiers statiques (`<img>`, pas d'insertion dans le DOM : leurs dégradés portent des identifiants qui entreraient en collision) et mis en cache pour le hors ligne.

## 6. Comment c'est construit (choix de conception)

- **Monorepo npm workspaces** :
  - `packages/pictos` (`@cresus/pictos`) : catalogue (clé, libellé, mots-clés, catégorie), normalisation et appariement ; TypeScript pur, sans dépendance, testé avec Vitest.
  - `apps/api` (`@cresus/api`) : NestJS + Drizzle ; PGlite en dev et en tests, PostgreSQL en production ; sert aussi le front construit.
  - `apps/web` (`@cresus/web`) : Nuxt 4 en SPA + Pinia, PWA (`@vite-pwa/nuxt`), tests e2e Playwright.
  - `scripts/build-pictos.mjs` : extrait les SVG de la sélection depuis `@iconify-json/fluent-emoji` vers `apps/web/public/pictos/` (fichiers générés versionnés, avec la licence).
- **Image Docker unique**, Node 24, port 3000, `HEALTHCHECK` sur `/api/health`, migrations jouées au démarrage, utilisateur `node`, `TZ=Europe/Paris`.
- **Auth** : mot de passe haché Argon2 ; session = cookie `httpOnly`, `SameSite=Lax`, `Secure` en production, dont seul le hash est stocké ; limite de débit sur `/api/auth/*`. En-têtes de sécurité sur toutes les réponses.
- **Argent** en centimes entiers partout.
- **Données** : `accounts` (asso), `sessions`, `events`, `articles`, `sales` (id UUID fourni par le client, évènement, article, prix en centimes, heure de vente donnée par le client, heure de réception, annulée le). Tout est cloisonné par compte : un compte ne voit ni ne modifie jamais les données d'un autre (404).
- **API REST JSON** sous `/api` : auth (`signup`, `login`, `logout`, `me`), compte (nom, mot de passe, suppression), évènements (liste avec totaux, création avec copie, détail avec articles et compteurs, modification, suppression), articles (création, modification, réordonnancement, suppression/archivage), `POST /api/events/:id/sync` (lot ordonné d'opérations `sale`/`void`, idempotent, renvoie les compteurs à jour), `GET /api/events/:id/summary` (compteurs, léger, pour le rafraîchissement), historique paginé, export `.xlsx` (généré côté serveur avec `exceljs`).
- **File d'attente client** dans `localStorage`, par compte ; compteurs affichés = compteurs serveur + ventes en attente − annulations en attente ; la réponse de `sync` remplace les compteurs serveur et retire les opérations envoyées, en une fois.
- Une vente porte l'heure du téléphone ; une heure aberrante (plus d'un jour dans le futur, ou avant 2020) est remplacée par l'heure de réception : la vente est gardée, jamais perdue.

## 7. Mise en production

- Code sur la branche `escouade/reset-cresus-caisse`.
- Coolify (application « Cresus », Dockerfile, port 3000) est repointé sur cette branche ; les variables d'environnement obsolètes de Ma Tréso (WebAuthn, OAuth/MCP, démo) sont retirées, `SESSION_SECRET` et `DATABASE_URL` conservés.
- La base `cresus-db` est vidée (tables Ma Tréso supprimées), sans sauvegarde, puis l'appli est déployée et vérifiée en ligne (santé, inscription, vente, export).

## 8. Laissé au constructeur

Mise en page fine, palette et typographie (claire, fort contraste, lisible en plein soleil, ton chaleureux de kermesse), libellés exacts, détail des animations, liste exacte des pictos et mots-clés dans l'esprit du §5, découpage interne des modules.
