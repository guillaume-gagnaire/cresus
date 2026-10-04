# Ma Tréso — maquettes

13 écrans conçus dans un canvas de design (claude.ai) :

- Desktop (1440 px) : Main (tableau de bord société), Main-Micro (tableau de bord micro-entreprise), Clients, Calendrier (congés), Charges.
- Mobile (390 × 844) : Mobile-Accueil, Mobile-Accueil-Micro, Mobile-Missions, Mobile-Client (fiche mission), Mobile-Conges, Mobile-Charges, Mobile-Profil, Mobile-Connexion.

Chaque fichier contient le balisage de l'écran (styles en ligne) et, dans le bloc
`<script type="text/x-dc">`, la logique de démonstration (calculs, données d'exemple).
Les fichiers s'appuient sur le runtime du canvas (`support.js`) : ils servent de référence
visuelle et fonctionnelle, pas de code à déployer tel quel.

Les règles de calcul et le modèle de données sont dans la spec produit (à exporter en Markdown).
