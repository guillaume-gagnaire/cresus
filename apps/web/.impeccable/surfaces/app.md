---
version: 1
slug: "app"
primary_target: "app"
related_targets: []
---

# Surface : l'appli Cresus (caisse, évènements, articles, bilan)

Mode : Operate. Téléphone d'abord (390 px), tablette paysage sur comptoir probable (1180 × 820).
Public : bénévoles de buvette en plein rush, en plein air ; trésorier le soir. Tâche : compter une vente d'un appui, sans formation.
Temps réel : les compteurs et le total se mettent à jour sur tous les appareils (socket.io), file locale hors ligne.

## Direction contract

THESIS : une appli grand public chaleureuse, en langage courant, où la seule couleur vive est ce qui se touche. Refuse la grille grise de caisse enregistreuse et le tableau de bord SaaS.

OWN-WORLD : fond rose pâle #FBE9E3 ; cartes blanches, coins 24 px, ombre douce ; encre brun chaud #1F1512, texte #3B2A26, secondaire #6B4F48 ; corail #D9381E réservé à l'actionnable (onglet actif, bouton principal, compteur de l'article touché) ; vert #1E9E57 = à jour, ambre #B45309 = en attente ; Nunito 500–900, chiffres tabulaires ; icônes au trait de 2,2 px arrondi ; pictos Fluent Emoji en couleur.

STORY : le bénévole voit le total, touche un article, voit « +1 » et peut annuler ; le trésorier prépare les articles (picto choisi tout seul) et lit le bilan, puis exporte.

FIRST VIEWPORT : caisse. En haut le nom de l'évènement et une pastille de synchro (pleine verte « À jour », creuse ambre « 3 en attente », barrée « Hors ligne ») ; total en 44 px et ventes ; grille de cartes sur 2 colonnes (picto 56 px, nom, prix, pastille compteur) ; bandeau « Vente n°266 · Ticket tombola +1 · Annuler » au-dessus de la barre d'onglets Caisse / Articles / Bilan. Sur tablette : 4 colonnes, plus une colonne latérale avec le total, la synchro et les dernières ventes.

FORM : appli grand public chaleureuse (prétendant comp. n°3 du tirage, choisi par Guillaume), seed 206e6a17. Interaction signature : un ressort doux à l'appui (la carte s'enfonce à 0,96 puis revient), et la pastille compteur passe au corail et rebondit au +1.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
