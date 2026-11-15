# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Bénévoles de buvette** d'une APE (association de parents d'élèves) : des parents, pas des professionnels de la caisse, qui tiennent la buvette d'une kermesse, d'un marché de Noël ou d'une fête d'école. Souvent en plein air, en plein soleil, sur leur propre téléphone tenu d'une main, la monnaie dans l'autre, pendant un rush. Une tablette posée sur le comptoir est possible. Ils n'ont jamais vu l'appli avant le jour J et ne seront pas formés.
- **Le trésorier ou la trésorière de l'APE** : prépare les articles avant l'évènement, puis fait le bilan et l'export Excel le soir, au calme.
- Une asso = un compte (un email) ; les bénévoles partagent ses identifiants. Plusieurs téléphones vendent en même temps sur le même évènement.

## Product Purpose

Cresus est un compteur de ventes : un gros bouton par article, un appui = une vente. L'APE sait, à la fin de chaque évènement, combien elle a vendu de quoi et pour combien, et l'exporte en Excel pour sa trésorerie. Succès : un bénévole s'en sert sans explication en plein rush ; le total est juste même si le réseau a coupé ; le trésorier a son fichier en un clic.

## Positioning

Pas une caisse enregistreuse ni un terminal de paiement : ni panier, ni rendu de monnaie, ni moyen de paiement. Juste compter, très vite, à plusieurs, même sans réseau, avec des pictos qui se choisissent tout seuls d'après le nom de l'article (« crêpe nutella » → une crêpe).

## Operating Context

- Gestion par évènement (nom + date) ; articles propres à chaque évènement, recopiables depuis un évènement précédent.
- Écran de caisse : grille de grosses tuiles (picto, nom, prix, compteur), total de l'évènement en haut, bandeau « +1 · Annuler » après chaque appui, indicateur de synchronisation.
- Hors ligne : les ventes sont gardées sur le téléphone et envoyées au retour du réseau.
- Bilan (total, par article, par heure, historique avec suppression) et export `.xlsx`.
- Connexion email + mot de passe ; pas d'envoi d'email.

## Capabilities and Constraints

- Front Vue (Nuxt 4 en SPA, PWA installable), back NestJS ; site unique sur cresus.gagnaire.dev, jamais indexé (noindex, nofollow).
- Interface en français, au vouvoiement.
- Pictos : Fluent Emoji (Microsoft, licence MIT), style couleur, environ 130 pictos de buvette, kermesse et ventes d'APE ; picto générique « étiquette » quand rien ne correspond.
- Non-objectifs v1 : panier, moyens de paiement, fonds de caisse, comptes bénévoles séparés, mode sombre.

## Brand Commitments

- Nom : **Cresus**. Pas d'identité existante : identité nouvelle, propre à Cresus (l'artefact « Design System » du compte n'est pas utilisé).
- À éviter, confirmé par Guillaume : illisible au soleil (contrastes faibles, petits textes, couleurs pâles) ; « appli de startup » (dégradés, glassmorphism, look SaaS) ; enfantin (couleurs bonbon partout, typo de BD) ; austère (logiciel de caisse ou de compta, gris et froid).

## Evidence on Hand

- Pictos SVG : `apps/web/public/pictos/` (licence dans `LICENSE.txt`).
- Aucune asso cliente, aucun témoignage, aucun chiffre réel : rien de tout cela ne doit être inventé comme réel. Les données de maquette (« APE Jules Ferry », « Kermesse 2027 ») sont fictives.

## Product Principles

1. Le rush d'abord : l'écran de caisse se comprend en un coup d'œil et s'utilise d'une main, sans viser.
2. Ne jamais perdre une vente : l'état de synchronisation est toujours visible, sans alarmer.
3. Zéro formation : chaque écran se suffit à lui-même, les mots sont ceux de la buvette.
4. Le soir, la vérité : le bilan est juste, lisible et exportable tel quel.

## Accessibility & Inclusion

- Lisible en plein soleil : contrastes forts (AA au minimum, viser AAA pour les montants et compteurs), textes grands.
- Cibles tactiles larges et espacées (fautes de frappe en rush) ; utilisable d'une main.
- Bénévoles de tous âges, à l'aise ou non avec le numérique.
