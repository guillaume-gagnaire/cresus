---
name: Cresus
description: Compteur de ventes de buvette d'APE, chaleureux et lisible en plein soleil, où seul ce qui se touche est en couleur.
colors:
  coral: "#CF3519"
  coral-pressed: "#A82A13"
  coral-tint: "#FFF6F3"
  error-ink: "#8F2410"
  ok: "#1E9E57"
  wait: "#B45309"
  ground: "#FBE9E3"
  ground-deep: "#F6E3DC"
  card: "#FFFFFF"
  ink: "#1F1512"
  text: "#3B2A26"
  muted: "#6B4F48"
  placeholder: "#8A6E66"
  rule: "#F3DED6"
  field: "#E8CFC6"
  bar: "#8C5A4D"
  track-off: "#D9C3BB"
typography:
  display:
    fontFamily: "Nunito Variable, Nunito, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 900
    lineHeight: 1.05
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Nunito Variable, Nunito, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 900
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Nunito Variable, Nunito, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 800
    lineHeight: 1.15
  body:
    fontFamily: "Nunito Variable, Nunito, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontFamily: "Nunito Variable, Nunito, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 800
    lineHeight: 1.4
  button:
    fontFamily: "Nunito Variable, Nunito, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 900
    lineHeight: 1.4
rounded:
  bar: "8px"
  field: "14px"
  button: "16px"
  card: "24px"
  big: "28px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "10px"
  base: "12px"
  gutter: "14px"
  card: "16px"
  roomy: "18px"
  wide: "20px"
components:
  button-primary:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.card}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "0 20px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.coral-pressed}"
    textColor: "{colors.card}"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "0 20px"
    height: "52px"
  button-quiet:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "0 20px"
    height: "52px"
  button-text:
    textColor: "{colors.coral}"
    rounded: "{rounded.button}"
    padding: "0 10px"
    height: "44px"
  icon-button:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    size: "44px"
  input-field:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0 16px"
    height: "52px"
  caisse-tile:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.card}"
    padding: "16px"
    height: "140px"
  tile-badge:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    height: "38px"
  tile-badge-touched:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.card}"
  tab:
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
  tab-active:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.card}"
  sync-pill:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
    height: "36px"
  sale-toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
    rounded: "20px"
    padding: "8px 8px 8px 18px"
    height: "64px"
  sheet:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    rounded: "{rounded.big}"
    padding: "10px 18px 22px"
    width: "560px"
---

# Design System: Cresus

## Overview

**Creative North Star: "La buvette en plein soleil"**

Cresus est une appli grand public chaleureuse, pas une caisse enregistreuse. Le monde est un fond rose pâle chaud sur lequel reposent des cartes blanches très arrondies, une encre brun chaud au lieu du noir, une seule famille de caractères ronde et grasse (Nunito, 600 à 900) et des pictos Fluent Emoji en couleur qui portent toute la gaieté. La couleur vive n'est jamais décorative : le corail désigne ce qui se touche, le vert et l'ambre disent l'état de la synchronisation, et rien d'autre ne crie.

La densité est celle d'un outil de rush tenu d'une main : cibles de 44 px au minimum, 52 px pour les boutons et les champs, tuiles de caisse de 140 px de haut, textes rarement sous 14 px et presque toujours en 800 ou 900 pour tenir au soleil. Les montants sont en chiffres tabulaires et dominent l'écran (44 px sur téléphone, 60 px dans la colonne de la tablette). La matière est douce : ombres diffuses brun chaud, aucun trait de bordure sur les cartes, des séparateurs à peine teintés dans les listes.

Le mouvement est un ressort. Une tuile s'enfonce à 0,96 puis revient en dépassant légèrement, la pastille compteur passe au corail et rebondit au +1, les panneaux montent du bas en décélérant. Cette élasticité est la signature tactile du monde ; elle est coupée net quand l'utilisateur demande moins de mouvement.

**Key Characteristics:**
- Fond rose pâle, cartes blanches à 24 px de rayon, ombre brune diffuse, pas de bordures de carte.
- Une seule famille, Nunito Variable, en graisses lourdes ; chiffres tabulaires pour tout montant ou compteur.
- Corail réservé à l'actionnable ; vert = à jour, ambre = en attente.
- Couleur apportée par les pictos Fluent Emoji, icônes d'interface au trait de 2,2 px aux bouts arrondis.
- Ressort doux à l'appui (`--spring`), entrées en décélération (`--ease-out`).
- Téléphone d'abord, une colonne de 640 px max ; tablette en grille de 4 avec une colonne de résumé.

## Colors

Une palette chaude et peu saturée de roses et de bruns, percée d'un seul corail franc et de deux couleurs d'état.

### Primary
- **Corail de buvette** (#CF3519) : l'actionnable et seulement lui. Onglet actif, bouton principal, pastille compteur de l'article qui vient d'être touché et anneau de la tuile touchée, contour de focus, curseur de saisie, sélection de texte, bordure d'un champ actif, lien d'action textuel. Foncé depuis le #D9381E de la maquette pour atteindre 5:1 avec le texte blanc.
- **Corail appuyé** (#A82A13) : survol du bouton principal.
- **Voile corail** (#FFF6F3) : fond d'un encart d'erreur et de l'option de picto choisie automatiquement ; jamais de texte corail vif dessus en petit corps, on y écrit en encre d'erreur.
- **Encre d'erreur** (#8F2410) : texte des messages d'erreur, lisible sur le voile corail et sur le fond rose.

### Secondary
- **Vert à jour** (#1E9E57) : pastille pleine « À jour » et interrupteur activé. Jamais pour un bouton.
- **Ambre en attente** (#B45309) : texte et pastille creuse « n en attente » ; état, pas alarme.

### Neutral
- **Rose de fond** (#FBE9E3) : fond de l'appli, des boutons discrets, des pastilles compteur au repos et des boutons-icônes.
- **Rose profond** (#F6E3DC) : rail des barres horaires du bilan.
- **Blanc carte** (#FFFFFF) : cartes, tuiles, panneaux, barre d'onglets, champs ; texte sur corail et sur encre.
- **Encre brun chaud** (#1F1512) : titres, montants, noms d'articles, fond des bandeaux de vente et des messages flottants.
- **Brun texte** (#3B2A26) : texte courant.
- **Brun secondaire** (#6B4F48) : prix, nombre de ventes, heures, aides de champ, lien de retour.
- **Brun indice** (#8A6E66) : texte indicatif des champs uniquement.
- **Filet rosé** (#F3DED6) : séparateurs de 1 px entre lignes de liste.
- **Bord de champ** (#E8CFC6) : bordure de 2 px des champs au repos, poignée des panneaux.
- **Brun barre** (#8C5A4D) : remplissage des barres du bilan par heure.
- **Rail éteint** (#D9C3BB) : interrupteur désactivé.

### Named Rules
**The Seul-ce-qui-se-touche Rule.** Le corail ne sert qu'à ce qu'on peut toucher ou qui vient d'être touché. Un titre, un fond, un graphique ou une illustration en corail est une faute.

**The Brun-pas-noir Rule.** Aucun noir ni gris neutre : l'encre est #1F1512, les ombres et voiles sont des rgba de ce brun ou de #3B2A26.

**The État-sans-alarme Rule.** La synchronisation se dit en vert et en ambre, avec une forme distincte (pastille pleine, creuse, barrée) pour ne jamais dépendre de la couleur seule ; le corail n'annonce jamais un état réseau.

## Typography

**Display Font:** Nunito Variable (avec Nunito, system-ui, sans-serif)
**Body Font:** Nunito Variable
**Label/Mono Font:** Nunito Variable, chiffres tabulaires (`font-variant-numeric: tabular-nums`) pour les montants et compteurs

**Character:** Une seule ronde humaniste poussée dans ses graisses lourdes : amicale sans être enfantine, et assez épaisse pour se lire en plein soleil sur un téléphone tenu à bout de bras.

### Hierarchy
- **Display** (900, 44 px, 1.05, -0.02em) : le total de l'évènement en caisse. Monte à 48 px dans la carte du bilan et à 60 px dans la colonne de résumé de la tablette.
- **Headline** (900, 28 px, 1.15, -0.01em) : titre de page (évènements, articles, bilan, réglages). Le titre de caisse, sous la barre du haut, descend à 22 px (24 px dans la colonne tablette) pour laisser la place au total.
- **Title** (800, 18 px, 1.15) : nom d'article dans une tuile (22 px sur tablette), intertitres de section en 900.
- **Body** (600 à 700, 16 px, 1.4) : texte courant, prix (700, brun secondaire), ventes.
- **Label** (800, 14 à 15 px) : onglets, pastille de synchro, libellés de champ, heures, aides (600).
- **Button** (900, 17 px ; 18 px en grand bouton) : tous les boutons.

### Named Rules
**The Gras-au-soleil Rule.** Rien d'interactif ni de chiffré sous 800 ; le 600 est réservé aux paragraphes et aux aides. Rien sous 12 px, et 12 px seulement pour un sous-compte secondaire.

**The Chiffres-alignés Rule.** Tout montant, compteur ou numéro de vente porte les chiffres tabulaires.

**The Titre-seul Rule.** Un titre se suffit à lui-même : pas de surtitre, pas de petite ligne en capitales au-dessus.

## Layout

Téléphone d'abord, en une colonne : contenu limité à 640 px, gouttière de 14 px, écart de 14 px entre blocs, marges hautes et basses qui respectent les zones sûres (`env(safe-area-inset-*)`). Les écrans d'un évènement utilisent une barre d'onglets fixe en bas (82 px plus la zone sûre) et réservent cette hauteur sous le contenu ; le bandeau de vente flotte 14 px au-dessus d'elle.

La caisse est une grille de tuiles en 2 colonnes égales, 12 px d'écart. À partir de 900 px (tablette sur comptoir) : conteneur de 1 280 px, les onglets passent en haut à droite dans une gélule blanche, la grille passe à 4 colonnes avec 14 px d'écart et des rangées hautes (`clamp(168px, (100dvh - 150px) / 3, 260px)`, environ trois rangées par écran), et une colonne de résumé de 340 px, collante, porte le titre, la synchro, le total, le bandeau de vente et les dernières ventes. Les panneaux (dialog) montent du bas sur téléphone et se centrent à partir de 720 px.

Rythme d'espacement observé : 4, 8, 10, 12, 14, 16, 18, 20 px ; 14 px est la gouttière et l'écart par défaut, 16 à 18 px le rembourrage des cartes.

## Elevation & Depth

Profondeur par ombres douces et diffuses teintées de brun, jamais par bordures. Les cartes flottent à peine sur le fond rose ; la colonne de résumé et les panneaux montent d'un cran ; les messages sombres flottent nettement au-dessus. L'état « touché » remplace l'ombre par un anneau corail.

### Shadow Vocabulary
- **Carte** (`box-shadow: 0 4px 14px rgba(59, 42, 38, 0.08)`) : cartes, tuiles, bouton secondaire.
- **Relevé** (`box-shadow: 0 8px 24px rgba(59, 42, 38, 0.1)`) : colonne de résumé de la tablette.
- **Message** (`box-shadow: 0 12px 28px rgba(31, 21, 18, 0.3)`) : bandeau de vente flottant et messages en haut d'écran.
- **Touché** (`box-shadow: 0 0 0 3px #CF3519, 0 8px 18px rgba(207, 53, 25, 0.2)`) : tuile qui vient d'être touchée.
- **Barre d'onglets** (`box-shadow: 0 -6px 18px rgba(59, 42, 38, 0.08)`) et **panneau** (`box-shadow: 0 -12px 32px rgba(31, 21, 18, 0.2)`), voile de fond `rgba(31, 21, 18, 0.42)`.

### Named Rules
**The Ombre-chaude Rule.** Toute ombre est une rgba de #3B2A26 ou #1F1512 (ou du corail pour l'état touché), floue et sans décalage latéral ; jamais d'ombre dure ni d'ombre grise neutre.

## Shapes

Formes pleines et très arrondies, sans trait. Rayons : 24 px pour les cartes et tuiles, 28 px pour les grands conteneurs (colonne de résumé, carte de total du bilan, panneaux), 16 px pour les boutons et onglets, 14 px pour les champs et boutons-icônes, 8 px pour les barres de graphique, gélule complète pour pastilles et interrupteurs. Les seules bordures sont fonctionnelles : 2 px #E8CFC6 autour d'un champ (corail au focus) et un filet de 1 px #F3DED6 entre lignes de liste. Les icônes d'interface sont dessinées au trait de 2,2 px, bouts et angles arrondis, sur une grille de 24.

## Components

### Buttons
Pleins, gras et généreux, ils s'enfoncent au doigt.
- **Shape:** coins doux (16 px), hauteur 52 px (56 px en grand bouton), 20 px de côté, icône et texte séparés de 10 px.
- **Primary:** fond corail, texte blanc en 900. Un seul par écran ou par panneau.
- **Hover / Focus:** survol en corail appuyé ; à l'appui, `scale(0.97)` en 90 ms puis retour sur le ressort (220 ms) ; focus par contour corail de 3 px décalé de 3 px. Désactivé : opacité 0.55.
- **Secondary / Quiet / Text:** secondaire blanc à ombre de carte, encre ; discret sur fond rose, encre ; textuel transparent en corail, 15 px, 44 px de haut, pour une action d'appoint dans un en-tête.
- **Icon button:** carré de 44 px, rayon 14 px, fond rose, icône au trait.

### Chips
- **Sync pill:** gélule blanche (rose dans la colonne tablette), 14 px en 800, pastille de 10 px : pleine verte « À jour », creuse ambre « n en attente » (texte ambre), barrée « Hors ligne ». Devient un bouton souligné de 44 px quand elle propose une action.
- **Badge compteur:** gélule de 38 px (42 px sur tablette), fond rose, 18 px en 900 ; passe en corail sur blanc quand l'article vient d'être touché.

### Cards / Containers
- **Corner Style:** 24 px (28 px pour les grands conteneurs).
- **Background:** blanc sur fond rose.
- **Shadow Strategy:** ombre « Carte », « Relevé » pour la colonne de résumé.
- **Border:** aucune.
- **Internal Padding:** 16 à 18 px ; 20 à 22 px pour les grands conteneurs.

### Inputs / Fields
- **Style:** 52 px de haut, fond blanc, bordure 2 px #E8CFC6, rayon 14 px, saisie en 17 px 700 encre ; libellé au-dessus en 15 px 800, aide en 14 px 600 brun secondaire.
- **Focus:** la bordure passe au corail, pas d'anneau supplémentaire ; curseur corail.
- **Error / Disabled:** message en encre d'erreur, en 800, sur fond voile corail quand il est encarté.
- **Switch:** rail gélule 52 × 32 px, éteint #D9C3BB, allumé vert ; pastille blanche qui glisse sur le ressort.

### Navigation
- **Téléphone :** barre fixe blanche en bas, trois onglets égaux (icône au-dessus, 14 px 800), l'actif en bloc corail à 16 px de rayon, texte blanc.
- **Tablette (≥ 900 px) :** gélule blanche de 18 px de rayon en haut à droite, onglets en ligne de 44 px, actif en corail à 14 px de rayon.
- **Retour :** lien « ‹ Évènements » en 15 px 800 brun secondaire, 44 px de haut.

### Caisse Tile (signature)
La tuile est le bouton de vente : blanche, 24 px de rayon, 140 px de haut minimum (168 px et plus sur tablette), picto Fluent Emoji de 56 px (80 px sur tablette) en haut à gauche, badge compteur en haut à droite, nom (18 px 800 encre) et prix (16 px 700 brun secondaire) en bas. À l'appui elle s'enfonce à `scale(0.96)` en 90 ms puis revient sur le ressort en 260 ms ; touchée, elle prend l'anneau corail et son badge rebondit (`scale(1.38)` à 35 % d'une animation de 380 ms).

### Sale Toast (signature)
Bandeau sombre en encre, 20 px de rayon, 64 px de haut : « Vente n°266 » en 13 px, l'article et « +1 » en 17 px 800 blanc, et un bouton blanc « Annuler » de 48 px. Il flotte au-dessus de la barre d'onglets sur téléphone et se range dans la colonne de résumé sur tablette ; il entre en montant de 14 px en 320 ms.

### Sheet
Panneau `dialog` blanc, poignée de 44 × 5 px en bord de champ, rayon 28 px en haut seulement sur téléphone, entrée `sheet-up` en 340 ms ; centré et arrondi partout à partir de 720 px, largeur maximale 560 px.

## Do's and Don'ts

### Do:
- **Do** réserver le corail (#CF3519) à l'onglet actif, au bouton principal, à la tuile touchée et à son compteur, au focus et aux actions textuelles.
- **Do** écrire montants et compteurs en Nunito 900 à chiffres tabulaires, le total à 44 px minimum sur l'écran de caisse.
- **Do** garder des cibles de 44 px au minimum et de 52 px pour les boutons et champs.
- **Do** utiliser le ressort (`cubic-bezier(0.34, 1.56, 0.64, 1)`) pour ce qui répond au doigt, et la décélération (`cubic-bezier(0.16, 1, 0.3, 1)`) pour ce qui entre à l'écran.
- **Do** illustrer les articles avec les pictos Fluent Emoji en couleur de `public/pictos/`, et l'interface avec les icônes au trait de 2,2 px.
- **Do** dire la synchro par forme et couleur à la fois : pastille pleine verte, creuse ambre, barrée.

### Don't:
- **Don't** poser du corail sur un titre, un fond de section, une barre de graphique ou un élément décoratif.
- **Don't** utiliser de noir pur, de gris neutre ni d'ombre grise : encre et ombres restent brun chaud.
- **Don't** ajouter de bordure aux cartes ni d'ombre dure décalée ; la profondeur vient des ombres diffuses.
- **Don't** mettre un surtitre ou une ligne en petites capitales au-dessus d'un titre.
- **Don't** mettre de dégradés, de verre dépoli ni de couleurs bonbon dans l'interface ; seuls les pictos Fluent Emoji gardent leurs propres dégradés et couleurs.
- **Don't** descendre sous 14 px pour un texte à lire en rush (13 et 12 px restent réservés aux mentions secondaires : numéro de vente, sous-compte), ni sous 800 pour un libellé interactif.
