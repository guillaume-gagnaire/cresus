# Ma Tréso — Spécification produit et design

Oct 4, 2026 · @Guillaume

## 1. Vision et périmètre

Ma Tréso répond à une seule question : **« Ce mois-ci, avec mes rentrées et mes charges, est-ce que ça passe ? »** C'est un outil de projection grossière pour un freelance, pas un logiciel comptable.

### Problème

Un freelance travaille un mois et est payé un ou deux mois plus tard, selon chaque client. Ses congés font baisser le CA, mais l'effet ne se voit qu'au moment où le client aurait payé. La banque montre le passé ; personne ne montre les mois à venir.

### Utilisateur cible

- **Profil principal** : freelance en société (SASU, EURL, SARL…), un à quatre clients en parallèle, souvent en régie au TJM.
- **Profil secondaire** : micro-entrepreneur, avec un tableau de bord adapté (mode micro).
- **Usage** : quelques minutes par semaine, surtout sur mobile ; plus long sur desktop pour paramétrer.

### Ce que l'app fait (v1)

1. Projeter, mois par mois sur 15 mois, les rentrées (selon les délais de paiement de chaque client) et les charges.
2. Dire pour chaque mois : positif, dans le rouge (rentrées < charges) ou à découvert (solde < 0).
3. Gérer plusieurs clients en parallèle : jours de présence par jour de semaine, dates de début et de fin, TJM historisé, forfait mensuel.
4. Simuler l'impact des congés sur chaque mois, client par client.
5. Estimer le coût total de la rémunération du dirigeant selon le statut juridique.
6. En micro-entreprise : revenu disponible, part à mettre de côté, jauge du plafond de CA, revenu lissé.

### Hors périmètre v1

- Calendrier fiscal détaillé : acomptes et solde d'IS, échéances de TVA, CFE datée. Ces sorties sont saisies comme de simples charges.
- Simulation comparative SASU / EURL avec dividendes et IS.
- Barèmes versionnés et panneau d'administration.
- Synchronisation bancaire (prévue en v3, voir la roadmap).
- Facturation, devis, comptabilité, déclarations.
- Gestion multi-utilisateur ou multi-société.

### Principes produit

- **Grossier mais juste dans le timing** : l'ordre de grandeur suffit, mais le mois d'encaissement doit être exact.
- **Une réponse avant des chiffres** : chaque écran commence par un verdict lisible en deux secondes.
- **Pédagogique** : chaque calcul non évident est expliqué en une bulle, en tutoiement.
- **Saisie minimale** : un solde à mettre à jour de temps en temps, des clients, des charges, des congés.

## 2. Concepts métier et glossaire

Toute l'app repose sur une chaîne simple : **jour travaillé → facture de fin de mois → encaissement après le délai de paiement → résultat du mois → solde**.

| Terme | Définition dans l'app |
| --- | --- |
| Client | Entité qui paie. Porte un nom, une couleur, un délai de paiement et un retard moyen. |
| Mission | Relation de travail avec un client, entre une date de début et une date de fin (ou sans fin). En v1, un client = une mission. |
| Mode de facturation | « Au temps passé » (jours travaillés × TJM) ou « Forfait mensuel » (montant fixe par mois). |
| Jours de présence | Jours de la semaine (lundi à vendredi) où l'utilisateur travaille pour ce client. Exemple : Client A le lundi et le vendredi, Client B du mardi au jeudi. |
| Tarif | TJM ou montant de forfait, historisé : chaque valeur s'applique à partir d'une date. |
| Délai de paiement | À réception, 30 jours, 45 jours, 30 jours fin de mois ou 60 jours, compté depuis la facture du dernier jour du mois travaillé. |
| Retard moyen | Nombre de jours que le client ajoute habituellement à l'échéance (0 à 30). |
| Encaissement | Date estimée de l'arrivée de l'argent : échéance + retard moyen. |
| Piste | Mission envisagée mais pas signée. Affichée hachurée et comptée seulement si l'option « Compter les pistes » est active. |
| Congé | Jour ouvré non travaillé, posé chez tous les clients ou chez un seul. Il réduit l'encaissement du mois où ce client aurait payé. |
| Jour férié | Jour légal français. Jamais facturé en mode TJM. |
| Charge | Sortie d'argent récurrente : mensuelle, ou annuelle avec un mois de prélèvement. Inclut le salaire et les cotisations calculés. |
| Résultat du mois | Encaissements du mois − charges du mois. |
| Dans le rouge | Résultat du mois négatif, solde toujours positif. |
| Découvert | Solde de fin de mois négatif. |
| Solde | Montant sur le compte. Saisi par l'utilisateur, puis projeté : solde du mois précédent + résultat du mois. |
| Statut juridique | SASU, SAS, SASU à l'IR, SARL, EURL à l'IS, EURL à l'IR, EI ou micro-entreprise. Détermine le calcul du coût de la rémunération et le tableau de bord affiché. |
| Régime social | Assimilé salarié, indépendant (TNS) ou micro. Regroupe les statuts pour le calcul des cotisations. |

Montants exprimés hors taxes. La TVA n'entre pas dans les calculs en v1.

## 3. Modèle de données

Six entités suffisent. Tous les montants sont stockés en **centimes (entiers)**, toutes les dates en `YYYY-MM-DD` sans fuseau horaire.

### User

| Champ | Type | Règle |
| --- | --- | --- |
| id | uuid |  |
| email | string | unique |
| firstName | string | affiché dans « Salut Guillaume ! » |
| companyName | string | optionnel |
| legalStatus | enum | SASU, SAS, SASU\_IR, SARL, EURL\_IS, EURL\_IR, EI, MICRO |
| netPayMonthly | int (centimes) | rémunération nette mensuelle du dirigeant ; ignoré en micro |
| microVersementLiberatoire | bool | micro uniquement |
| microIncomeTaxProvisionPct | int (0–30) | micro sans versement libératoire, défaut 10 |
| microProExpensesMonthly | int (centimes) | frais pro en micro, défaut 18 000 |
| includeProspects | bool | compter les pistes, défaut false |
| faceIdEnabled, alertRedMonth, alertLatePayment | bool | préférences |

### BalanceSnapshot

| Champ | Type | Règle |
| --- | --- | --- |
| id | uuid |  |
| date | date | jour de la saisie |
| amount | int (centimes) | peut être négatif |

La projection part du snapshot le plus récent. L'historique sert à afficher « Mis à jour il y a 12 jours ».

### Client

| Champ | Type | Règle |
| --- | --- | --- |
| id | uuid |  |
| name | string | requis |
| subtitle | string | ex. « Via ESN », « Maintenance » |
| color | enum de palette | 6 couleurs, voir le design system |
| billingMode | enum | TJM, FORFAIT |
| weekdays | int\[\] | 0 = lundi … 4 = vendredi ; vide si FORFAIT |
| startDate | date | requis |
| endDate | date ou null | null = sans fin ; ≥ startDate |
| paymentTerm | enum | RECEPTION, NET\_30, NET\_45, EOM\_30, NET\_60 |
| averageDelayDays | int (0–30) | défaut 0 |
| isProspect | bool | piste non signée |
| archivedAt | datetime ou null |  |

### Rate (historique des tarifs)

| Champ | Type | Règle |
| --- | --- | --- |
| id | uuid |  |
| clientId | uuid |  |
| validFrom | date | unique par client |
| amount | int (centimes) | TJM si TJM, montant mensuel si FORFAIT |

Un client a toujours au moins un tarif. Le tarif d'un jour J = celui dont `validFrom` est le plus grand ≤ J. Avant le premier tarif, le montant vaut 0.

### Leave (jour de congé)

| Champ | Type | Règle |
| --- | --- | --- |
| id | uuid |  |
| date | date | jour ouvré, non férié |
| scope | enum | ALL ou CLIENT |
| clientId | uuid ou null | requis si scope = CLIENT |

Un congé est stocké jour par jour. Les « périodes » affichées sont reconstruites à l'affichage (section 4.6).

### Charge

| Champ | Type | Règle |
| --- | --- | --- |
| id | uuid |  |
| name | string |  |
| amount | int (centimes) | montant prélevé à chaque échéance |
| frequency | enum | MONTHLY, YEARLY |
| month | int (0–11) ou null | requis si YEARLY |
| category | string | optionnel, pour l'icône |

Les deux lignes de rémunération (net + cotisations) ne sont pas stockées : elles sont calculées depuis `User.netPayMonthly` et `User.legalStatus`.

### Paramètres réglementaires

Constantes regroupées dans un module `params.ts`, versionnées par année : jours fériés, coefficients de cotisations, taux micro, plafond micro, seuil de TVA. Pas d'interface d'édition en v1.

## 4. Règles de calcul

Tous les calculs vivent dans un module pur (`engine/`), sans accès base ni interface, testé unitairement. L'horizon affiché est de **15 mois à partir du mois courant** ; le calcul remonte 8 mois en arrière pour capter les encaissements de travaux passés.

### 4.1 Jours facturables

Pour un client en mode TJM et un mois donné, un jour J est facturable si toutes ces conditions sont vraies :

1. startDate ≤ J et (endDate est null ou J ≤ endDate) ;
2. le jour de semaine de J est dans `weekdays` ;
3. J n'est pas un jour férié ;
4. J n'est pas un congé de scope ALL, ni un congé de scope CLIENT pour ce client.

Montant du mois = somme, sur les jours facturables, du tarif en vigueur à ce jour (4.2). Un changement de TJM en milieu de mois est donc proratisé au jour près.

### 4.2 Tarif historisé

`rateAt(client, J)` = montant du Rate dont `validFrom` est le plus grand ≤ J, ou 0. Ajouter un tarif avec une date déjà présente remplace l'ancien. Supprimer un tarif est interdit s'il est le dernier.

Affichage : tarif « Actuel » = celui en vigueur aujourd'hui ; « À venir » = validFrom > aujourd'hui ; « Ancien » = les autres, barrés.

### 4.3 Forfait mensuel

Montant du mois = somme, sur chaque jour calendaire actif du mois (entre start et end), de `rateAt(client, J) / nombre de jours du mois`. Le premier et le dernier mois sont donc proratisés. Les congés et les jours fériés n'ont **aucun effet** sur un forfait.

### 4.4 Date d'encaissement

La facture d'un mois est datée du dernier jour de ce mois (F).

| Délai | Échéance |
| --- | --- |
| À réception | F |
| 30 jours | F + 30 j |
| 45 jours | F + 45 j |
| 30 jours fin de mois | dernier jour du mois de (F + 30 j) |
| 60 jours | F + 60 j |

Encaissement = échéance + averageDelayDays. Le montant tombe dans le mois de la date d'encaissement. Conséquence voulue : avec « 30 jours fin de mois », les factures de janvier et de février peuvent arriver toutes deux fin mars.

### 4.5 Charges du mois

Une charge MONTHLY compte chaque mois. Une charge YEARLY compte uniquement le mois `month`. S'y ajoutent les deux lignes calculées de rémunération (4.8) en mode société.

### 4.6 Congés : coût et regroupement

- **Coût d'un jour de congé** = tarif du client qui aurait été facturé ce jour-là. Un congé posé un jour où aucun client TJM n'est actif coûte 0.
- **Mois d'impact** = mois d'encaissement de ce client pour le mois du congé (4.4).
- **Périodes affichées** : jours de congé triés, regroupés tant qu'ils ont le même scope et qu'aucun jour ouvré non férié ne les sépare. Chaque période affiche : dates, nombre de jours, scope, coût total, et « Se voit en janv. (−650 €), févr. (−2 400 €) ».
- **Comparaison** : le calcul tourne deux fois, avec et sans congés, pour chaque mois.

### 4.7 Résultat et solde

```latex
\text{résultat}_m = \text{encaissements}_m - \text{charges}_m
```

```latex
\text{solde}_m = \text{solde}_{m-1} + \text{résultat}_m
```

Le solde initial est le dernier BalanceSnapshot, appliqué au début du mois courant. États d'un mois :

| État | Condition | Couleur |
| --- | --- | --- |
| Positif | résultat ≥ 0 | vert |
| Dans le rouge | résultat < 0 et solde ≥ 0 | orange |
| Rouge à cause des congés | dans le rouge avec congés, positif sans | orange surligné |
| Découvert | solde < 0 | rouge |

### 4.8 Coût de la rémunération (mode société)

Le statut juridique donne un régime social, qui donne un coefficient appliqué au net mensuel.

| Statut | Régime | Calcul | Libellé du total |
| --- | --- | --- | --- |
| SASU, SAS, SASU à l'IR | Assimilé salarié | net × 1,80 | Coût pour la société |
| SARL (gérant majoritaire), EURL à l'IS | Indépendant (TNS) | net × 1,45 | Coût pour la société |
| EURL à l'IR, EI | Indépendant (TNS) | net × 1,45 | Bénéfice nécessaire |
| Micro-entreprise | Micro | net ÷ (1 − 0,261) | CA à encaisser |

Deux charges calculées en découlent : « Salaire (net) » = net, et « Cotisations sociales » = total − net. L'écran affiche aussi le coût du même net dans les trois régimes. L'impôt sur le revenu n'est jamais compté.

### 4.9 Mode micro-entreprise

Pour chaque mois m, à partir des encaissements (même moteur que 4.1 à 4.4) :

- cotisations = encaissements × 26,1 % ;
- impôt = encaissements × 2,2 % si versement libératoire, sinon × taux de provision choisi ;
- frais pro = montant mensuel fixe ;
- **pour toi** = encaissements − cotisations − impôt − frais pro.

Indicateurs :

- **Jauge du plafond** pour l'année civile choisie : encaissé réel (mois passés) + prévu (mois futurs), comparé au plafond. Couleur verte sous 85 %, jaune au-delà, rouge si dépassé, avec le mois du dépassement.
- **Seuil de TVA** : marqueur sur la jauge et mois de franchissement.
- **Revenu lissé** : moyenne de « pour toi » sur les 12 prochains mois. Un mois sous 60 % de cette moyenne est signalé en orange.
- **Mission test** : une case ajoute temporairement une mission hypothétique pour voir son effet sur le plafond.

### 4.10 Jours fériés

Liste française par année, dont les fêtes mobiles (lundi de Pâques, Ascension, lundi de Pentecôte) calculées depuis la date de Pâques. Le lundi de Pentecôte est considéré férié par défaut.

## 5. Écrans desktop

Cinq écrans, une barre latérale violette à gauche (Tableau de bord, Clients & missions, Calendrier & congés, Charges) et un contenu limité à 1 180 px de large. Maquettes de référence : [canvas Design](https://claude.ai/artifact/UCSYRwnbPQfSwqyjgwHwg3).

### 5.1 Tableau de bord (mode société)

**Rôle** : dire en deux secondes si le mois choisi passe.

- **En-tête** : « Salut Guillaume ! Ce mois-ci, ça passe ? », sélecteur Société / Micro-entreprise, champ « Solde du compte » éditable (crée un BalanceSnapshot).
- **Carte verdict** pleine largeur, couleur selon l'état (4.7) : flèches mois précédent / suivant ; titre « Tu es dans le positif » ou « Tu es dans le rouge ce mois-ci » ; résultat en 72 px ; phrase d'explication ; trois tuiles Rentrées, Charges, Sur le compte fin de mois.
- **Ce qui rentre** : une ligne par encaissement du mois : barre couleur client, nom, « Facture d'octobre · vers le 30 nov. », montant, et « −650 € de vacances déjà retirés » si concerné. État vide : « Aucun paiement client attendu ce mois-ci. »
- **Ce qui sort** : charges du mois triées par montant, fréquence en sous-titre, lien « Modifier mes charges ».
- **Mois par mois** : 15 barres cliquables, verte au-dessus d'un axe zéro si positive, rouge en dessous sinon, libellé « +5,3k ». Mois sélectionné encadré. Pastille de synthèse : « 3 mois dans le rouge, jamais à découvert ».
- **Bulle** : « Pourquoi certains mois sont dans le rouge ? »

### 5.2 Tableau de bord (mode micro-entreprise)

Affiché à la place de 5.1 quand le statut est MICRO.

- **Carte « Pour toi ce mois-ci »** : montant en 72 px, « sur X € encaissés », barre horizontale découpée en Cotisations (orange), Impôt (violet), Frais pro (gris), Pour toi (vert), et quatre tuiles chiffrées.
- **À mettre de côté** : cotisations URSSAF (« Déclarées et payées fin novembre »), impôt (« À garder pour ta déclaration au printemps » ou versement libératoire), case « Versement libératoire (2,2 %) », curseur de provision d'impôt (0–30 %) si décochée.
- **Ton plafond de CA** : sélecteur d'année, montant cumulé sur le plafond, jauge (réel plein + prévu hachuré), marqueur « Seuil TVA », message coloré, encart TVA, case « Tester une mission en plus ».
- **Combien te verser chaque mois** : bandeau « Revenu lissé sur 12 mois : 3 090 € / mois », 15 barres de « pour toi » avec la moyenne en pointillés, bulle « Pourquoi lisser ? ».

### 5.3 Clients & missions

- **Frise des missions** sur 12 mois : une ligne par client, barre positionnée de start à end (ouverte à droite si sans fin, hachurée si piste), ligne « Creux de CA » en dessous (mois sous 75 % du meilleur mois), message de creux. Case « Compter les pistes ».
- **Tableau Missions** : client (barre couleur, jours ou « Forfait mensuel »), période, tarif actuel + prochaine hausse, délai + retard, montant mensuel moyen. Clic = sélection.
- **Fiche mission** (panneau droit) :
  - bascule Au temps passé / Forfait mensuel avec phrase d'aide ;
  - bloc tarif : valeur actuelle, historique (badges Ancien barré / Actuel / À venir, suppression sauf dernier), formulaire « Nouveau TJM + À partir du + Ajouter » ;
  - jours de présence (5 pastilles L M M J V), masqué en forfait ;
  - début, fin, case « Mission sans date de fin » ;
  - délai de paiement (5 pastilles), curseur de retard moyen ;
  - « Le chemin d'une facture » : Tu factures le 31 oct. → Échéance → L'argent arrive vers, et « Soit 30 jours d'attente ».
- **Ce qui rentre vraiment** : 12 barres empilées par client (encaissements), pastilles Facturé / Encaissé, bulle explicative.

### 5.4 Calendrier & congés

- **Quatre KPI** : jours posés, CA perdu, point bas du solde, mois dans le rouge.
- **Calendrier mensuel** navigable sur 15 mois : chaque case montre le client du jour (couleur), « Vacances » en jaune, férié nommé, week-end grisé. Sélecteur « Poser chez : Tous / Client A / Client B ». Un clic pose ou retire un congé.
- **Poser des vacances** : Du, Au, Chez qui, bouton « Ajouter et simuler », message immédiat (« 5 jours ajoutés : −3 100 € encaissés »), liste des périodes avec coût, mois d'impact et suppression.
- **Ce que tes vacances font à chaque mois** : bandeau d'alerte, 15 colonnes à deux barres (gris = sans congés, vert / rouge = avec), mois surlignés quand les congés les font passer dans le rouge, case « Compter la piste ».
- **Mois par mois** (tableau) : encaissé sans congés, avec congés, coût des congés, charges, résultat, solde, badge d'état.

### 5.5 Charges

- **Ta rémunération** : 8 pastilles de statut, phrase d'aide du statut, curseur du net (0–8 000 €), équation Net + Cotisations = Coût, comparaison des trois régimes, alerte rouge si micro et CA annuel au-dessus du plafond.
- **KPI** : moyenne mensuelle (annuelles lissées), total annuel.
- **Tableau** : nom, fréquence, montant éditable, montant mensualisé, suppression. Les deux lignes de rémunération sont en lecture seule avec la mention « calculé ».
- **Ajouter une charge** : nom, montant, Mensuelle / Annuelle, mois si annuelle, bouton Ajouter.

## 6. Écrans mobile

L'app mobile reprend les mêmes données et calculs, en version condensée pour une largeur de 390 px. Barre d'état en haut, contenu qui défile, **barre d'onglets fixe en bas** (fond violet nuit, coins supérieurs arrondis, onglet actif = pastille jaune derrière l'icône).

| Onglet | Écran | Accès secondaires |
| --- | --- | --- |
| Accueil | Verdict du mois (société) ou « Combien il te reste ? » (micro) | Profil (pastille GD en haut à droite) |
| Missions | Semaine type + fiches clients | Fiche mission (écran poussé, bouton retour) |
| Congés | Calendrier + impact | — |
| Charges | Rémunération + liste des charges | — |

### 6.1 Accueil (société)

- En-tête « Ce mois-ci, ça passe ? » et sélecteur Société / Micro.
- Carte verdict : flèches de mois, titre, résultat en 52 px, phrase, tuiles Rentrées / Charges, bandeau « Sur le compte fin de mois ».
- « Les 15 prochains mois » : mini-barres vert / rouge cliquables.
- Listes « Ce qui rentre » et « Ce qui sort », bulle explicative.

### 6.2 Accueil (micro)

Mêmes blocs que 5.2 empilés : carte « Pour toi ce mois-ci » avec barre de répartition et 4 tuiles ; « À mettre de côté » avec interrupteur Versement libératoire ; jauge du plafond avec sélecteur d'année ; revenu lissé et mini-barres.

### 6.3 Missions

- **Semaine type** : 5 grosses cases L à V ; toucher une case fait tourner Client A → Client B → libre. CA moyen mensuel recalculé.
- **Fiches clients** (une carte par client) : bandeau couleur avec nom et TJM, jours / mois, CA / mois, période, délai, lien « Modifier la mission ».
- Bouton « Ajouter un client ».

### 6.4 Fiche mission

Écran poussé depuis Missions, avec bouton retour. Sélecteur A / B / C / D, bandeau client, puis trois cartes : **Tarif** (mode, tarif actuel, historique, formulaire d'ajout), **Dates** (début, fin, interrupteur Sans date de fin), **Paiement** (5 délais, retard moyen, chemin de la facture), et mini-graphe des encaissements sur 12 mois.

### 6.5 Congés

Bandeau d'alerte, 4 KPI en grille 2 × 2, calendrier navigable avec sélecteur Tous / A / B (toucher un jour pose ou retire un congé), « Mois par mois » en mini-barres avec les mois concernés surlignés, liste des mois impactés, liste des périodes avec suppression.

### 6.6 Charges

Carte « Ta rémunération » (8 statuts en pastilles, phrase d'aide, curseur du net, détail, coût total, comparaison des trois régimes, alerte micro), bascule Par mois / Par an, total, liste, bouton « Ajouter une charge ».

### 6.7 Profil

Pastille GD, prénom, e-mail ; sections Mon compte (société, solde du compte), Sécurité (Face ID, mot de passe), Alertes (mois dans le rouge, paiement en retard), Mes données (exporter, importer) ; boutons Se déconnecter et Supprimer mon compte.

### 6.8 Connexion

Logo GD incliné, bascule Se connecter / Créer un compte (le prénom apparaît à l'inscription), e-mail, mot de passe avec bouton afficher / masquer, lien Mot de passe oublié, bouton principal, Face ID, lien magique par e-mail, mention de confidentialité.

### Règles mobiles

- Cibles tactiles d'au moins 44 × 44 px.
- Une seule colonne, aucun défilement horizontal de la page.
- Respect des zones sûres (encoche, barre d'accueil) via `env(safe-area-inset-*)`.
- Les graphiques à 15 mois utilisent des barres de 1 à 2 lettres de libellé.

## 7. Design system

Le ton visuel est **chaleureux, gros et pédagogique** : fond crème, gros chiffres, coins très arrondis, bulles jaunes d'explication. L'inverse d'un tableur bancaire.

### 7.1 Couleurs

| Jeton | Valeur | Usage |
| --- | --- | --- |
| bg | #FFF7EC | fond de page (crème) |
| surface | #FFFFFF | cartes |
| border | #F0E6D6 | bordure des cartes (1,5 px) |
| ink | #1F1A2E | texte principal, boutons principaux, barre latérale et barre d'onglets |
| ink-2 | #4E4762 | texte secondaire |
| muted | #6B6478 | libellés, sous-titres |
| sun | #FFD84D | onglet actif, congés, logo |
| tip-bg / tip-ink | #FFF4C2 / #4A3B00 | bulles explicatives |
| client-1 | #4B4BE0 (indigo) | Client A, accent principal, curseurs |
| client-2 | #FF8A3D (orange) | Client B, cotisations en micro |
| client-3 | #9B6BFF (violet) | pistes, impôt en micro |
| client-4 | #2E9E6A (vert) | forfait, « pour toi » |
| positive-bg / positive-ink | #DDF3E5 / #12452A | verdict positif |
| red-bg / red-ink | #FFE6CF / #6E2E05 | mois dans le rouge |
| danger-bg / danger-ink | #FBD2CE / #7A1A13 | découvert, alerte |
| bar-up / bar-down | #2E9E6A / #E5484D | barres de résultat |

Mode sombre : prévu en v2, avec les mêmes jetons redéfinis.

### 7.2 Typographie

- **Titres et chiffres** : Bricolage Grotesque, graisses 500 / 700 / 800, chiffres tabulaires.
- **Texte** : Figtree, 400 à 700, 16 px par défaut sur desktop, 15–16 px sur mobile.
- Échelle desktop : H1 46 px, H2 24–26 px, chiffre verdict 72 px, KPI 34–40 px, libellé 15 px, mention 13–14 px.
- Échelle mobile : H1 32 px, H2 18–19 px, chiffre verdict 52 px.
- Polices de secours : system-ui, sans-serif.

### 7.3 Formes et espacements

- Rayons : carte 26 px, carte verdict 28–30 px, pastille 999 px, case de calendrier 13–16 px.
- Ombre unique très légère sous les cartes : 0 4px 0 rgba(31,26,46,.05).
- Espacement entre blocs : 18–28 px desktop, 14–18 px mobile ; marge de page 44 px desktop, 20 px mobile.

### 7.4 Composants

| Composant | Description |
| --- | --- |
| Bouton principal | pastille 50 px de haut, fond ink, texte blanc |
| Bouton secondaire | pastille 50 px, bordure 2 px ink ou border, fond blanc |
| Sélecteur segmenté | pastilles dans un rail arrondi, option active en fond ink |
| Pastilles de choix | statuts, délais, jours : bordure 2 px, active en fond ink ou couleur client |
| Carte verdict | grande carte colorée selon l'état, flèches de mois, chiffre géant, tuiles blanches translucides |
| KPI | carte teintée sans bordure, libellé, chiffre, sous-titre |
| Barres de résultat | colonne cliquable, barre verte au-dessus ou rouge sous un axe noir |
| Frise | piste crème, barre de mission colorée, hachures pour une piste |
| Jauge | rail crème, réel plein, prévu hachuré, marqueur vertical nommé |
| Bulle « Comment ça marche ? » | fond tip-bg, tuile jaune avec ampoule, titre en Bricolage, texte court |
| Interrupteur | 56 × 34 px, actif en indigo |
| Ligne de liste | icône ou barre couleur, titre + sous-titre, montant aligné à droite |
| Barre d'onglets mobile | 4 onglets, icône + libellé 12 px, pastille jaune derrière l'actif |

Icônes : SVG en trait (2 px, bouts arrondis), dans des tuiles colorées de 40–48 px. Jamais d'emoji.

### 7.5 Ton éditorial

- Tutoiement, phrases courtes, vocabulaire du quotidien : « Ce mois-ci, ça passe ? », « Ton solde absorbe le choc », « Cet argent n'est pas à toi ».
- Chaque verdict donne la raison en une phrase.
- Chiffres arrondis à la dizaine, format français (espace insécable, virgule décimale, « € » après le nombre) ; « 5,3k » dans les graphiques.
- Pas de jargon comptable sans explication.

### 7.6 Accessibilité

- Contraste AA minimum pour tout texte ; les états ne reposent jamais sur la couleur seule (titre, badge, signe + / −).
- Cibles tactiles ≥ 44 px, focus visible au clavier.
- Libellés `aria` sur les boutons icône, `aria-pressed` sur les pastilles, `role="switch"` sur les interrupteurs, `role="status"` sur les messages d'alerte.
- Graphiques : chaque barre a un libellé lisible (« février 2027 : −2 310 € »).

## 8. Architecture technique

Une seule application web responsive (desktop + mobile), installable en PWA, avec un moteur de calcul pur partagé par tous les écrans.

### 8.1 Stack proposée

| Couche | Choix | Pourquoi |
| --- | --- | --- |
| Langage | TypeScript strict | types partagés entre moteur et interface |
| Application | Next.js (App Router) | un seul projet, rendu serveur, PWA possible |
| Interface | Tailwind CSS + composants maison | jetons du design system en variables CSS |
| Graphiques | SVG maison (barres, frise, jauge) | formes simples, contrôle total du style |
| Base | PostgreSQL (ou SQLite en local) via Drizzle ORM | schéma typé, migrations |
| Auth | Better Auth ou Supabase Auth | e-mail + mot de passe, lien magique, passkey / Face ID |
| Tests | Vitest (moteur), Playwright (parcours clés) |  |
| Dates | date-fns, aucune heure ni fuseau | dates civiles uniquement |

Cette stack est une proposition : elle peut être adaptée tant que le moteur reste pur et testé.

### 8.2 Organisation du code

- `engine/` : fonctions pures sans dépendance à la base. `billableDays`, `rateAt`, `monthlyAmount`, `paymentDate`, `projectIncome`, `projectCharges`, `monthResults`, `leaveImpact`, `groupLeaves`, `remunerationCost`, `microBreakdown`, `ceilingGauge`.
- `engine/params/2026.ts`, `2027.ts` : jours fériés, coefficients, taux et seuils.
- `db/` : schéma Drizzle et requêtes.
- `app/` : routes et écrans ; aucun calcul métier dans les composants.

### 8.3 Données et confidentialité

- Une base par déploiement, données isolées par `userId` sur chaque table.
- Montants en centimes entiers ; arrondi à la dizaine uniquement à l'affichage.
- Export et import JSON complets (v1) pour sauvegarder ou migrer.
- Pas de données bancaires stockées en v1.

### 8.4 Performance

Le moteur recalcule 23 mois × quelques clients à chaque modification : quelques millisecondes, côté client, sans aller-retour serveur. Les écritures partent en arrière-plan avec mise à jour optimiste.

### 8.5 Tests obligatoires du moteur

- Jours facturables : jour férié, week-end, congé ALL, congé CLIENT, mission démarrant un mercredi.
- Tarif : changement de TJM en milieu de mois, tarif futur, premier tarif postérieur au début de mission.
- Forfait : prorata du premier et du dernier mois, insensibilité aux congés.
- Délais : chaque délai, y compris « 30 jours fin de mois » qui regroupe deux factures sur le même mois.
- Résultat et solde : enchaînement sur 15 mois, états positif / rouge / découvert.
- Congés : coût et mois d'impact par client, regroupement en périodes à travers un week-end et un jour férié.
- Rémunération : un cas par régime social.
- Micro : répartition, jauge, mois de dépassement, seuil de TVA, revenu lissé.

### 8.6 Seed de démonstration

Reprendre les données des maquettes : solde 48 320 €, Client A (lundi et vendredi, 650 € puis 700 € au 1er janvier 2027, 30 jours fin de mois, fin le 31 mai 2027), Client B (mardi à jeudi, 550 € puis 600 €, 45 jours + 10 jours de retard, sans fin), Client C (piste, 700 €, à partir de juillet 2027), Client D (forfait 1 200 € puis 1 350 € en avril 2027), congés de Noël, du pont de l'Ascension et d'août, dix charges dont 4 000 € de salaire net en SASU.

## 9. Paramètres, roadmap et critères d'acceptation

Les valeurs réglementaires ci-dessous sont des approximations à vérifier avant la mise en production ; elles vivent dans `engine/params` et se mettent à jour sans toucher au code des écrans.

### 9.1 Paramètres à vérifier

| Paramètre | Valeur utilisée | Remarque |
| --- | --- | --- |
| Coût d'un net en assimilé salarié | × 1,80 | moyenne grossière, varie selon le niveau de salaire |
| Coût d'un net en TNS | × 1,45 | idem, varie selon le revenu et la première année |
| Cotisations micro (prestations de services) | 26,1 % du CA | à confirmer pour l'année en cours ; taux différent pour certaines professions libérales |
| Versement libératoire micro | 2,2 % du CA | sous condition de revenu du foyer |
| Plafond de CA micro (services) | ≈ 83 600 € | sortie du régime après deux années de dépassement |
| Seuil de franchise de TVA (services) | ≈ 37 500 € | seuil majoré et règles de sortie à préciser |
| Jours fériés | liste française, lundi de Pentecôte inclus |  |

Toutes les estimations affichent la mention « Estimation simplifiée, à affiner avec ton expert-comptable ».

### 9.2 Roadmap

| Version | Contenu |
| --- | --- |
| v1 | Tout ce document : clients, tarifs historisés, forfait, délais, congés, charges, rémunération, projection 15 mois, mode micro, desktop + mobile, export / import JSON |
| v1.1 | Case « Payée » sur chaque encaissement attendu, alerte de retard, mise à jour guidée du solde |
| v2 | Import de relevé CSV / OFX avec rapprochement automatique, mode sombre, notifications push |
| v3 | Synchronisation bancaire via un agrégateur (consentement à renouveler tous les 180 jours) ou API de banque pro |
| Plus tard | TVA simplifiée (reversement le mois suivant), plusieurs missions par client, scénarios enregistrés |

### 9.3 Critères d'acceptation v1

- [ ] Avec le seed, octobre 2026 s'affiche « dans le rouge » à −2 310 € et le solde fin de mois à 46 010 €.
- [ ] Passer le TJM du Client A à 700 € au 1er janvier 2027 ne change aucun mois encaissé avant mars 2027.
- [ ] Un forfait démarrant le 15 d'un mois facture la moitié du montant ce mois-là, environ.
- [ ] Poser 5 jours de congé fin décembre chez tous les clients réduit les encaissements de janvier et février 2027 du TJM de chaque jour concerné.
- [ ] Un congé posé sur un jour férié ou un week-end est refusé.
- [ ] Supprimer le dernier tarif d'un client est impossible.
- [ ] Changer le statut en EURL à l'IS fait passer le coût de 4 000 € net de 7 200 € à 5 800 € par mois, et le total des charges suit.
- [ ] En micro, une mission test qui fait dépasser le plafond affiche le mois du dépassement en rouge.
- [ ] Chaque écran est utilisable à 390 px de large sans défilement horizontal, avec des cibles d'au moins 44 px.
- [ ] Le moteur atteint 90 % de couverture de tests.

### 9.4 Questions ouvertes

- Faut-il intégrer la TVA dès la v1 pour que le solde projeté colle au solde bancaire ?
- La rémunération doit-elle pouvoir changer en cours d'année (historique du net, comme pour les tarifs) ?
- L'app est-elle strictement personnelle, ou faut-il prévoir d'autres utilisateurs plus tard ?
