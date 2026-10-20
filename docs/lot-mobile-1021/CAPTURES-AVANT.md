# Retours de l'alpha mobile — captures AVANT (dev 7a7722ba7)

Session **testeur-mobile**, 20/10 matin, capot ouvert. Simulateurs « Testeur iPhone (Claude) »
(iPhone 17 Pro) et « Testeur iPad (Claude) » (iPad Pro 11 M5), iOS 26.3, app de dev partagée
(`~/.tentacle-lot-mob/builds/ios`, natif inchangé depuis), JS de `dev` par Metro. Serveur : le
backend de `dev` sur le Jellyfin JETABLE du banc Watch Together (comptes `compat-user*`, famille de
test : propriétaire compat-user, invités Léo — PIN — et Mia, sans photo ; sous-titres FR/EN ajoutés
aux épisodes du banc). Les deux bandeaux LogBox en bas sont propres au build de développement.

Images de l'ouverture : tirées d'un film du démarrage à froid (`simctl io recordVideo`), 6 i/s.

## Constats

| Point | AVANT |
|---|---|
| Ouverture : logo jamais déformé | ✘ L'écran du poulpe prend les proportions de l'appareil et le poulpe s'étire avec : très haut et étroit sur iPhone portrait (`ouverture-iphone-portrait-4`), écrasé en largeur en paysage (`ouverture-iphone-paysage-3`, `ouverture-ipad-paysage-3`). |
| Ouverture : plongée dans le VRAI premier écran | ✘ La plongée arrive sur l'ACCUEIL (`-6-accueil`), puis « Qui regarde ? » apparaît en fondu par-dessus (`-7`, `-8`) — sur les trois formats. |
| Ouverture en paysage iPhone | ◐ La première image est encore en portrait (`ouverture-iphone-paysage-0`) avant de basculer. |
| « Qui regarde ? » à chaque démarrage à froid | ✘ Une fois un profil choisi, le démarrage à froid suivant ouvre directement l'accueil (`demarrage-iphone-5-froid-apres-choix`). Texte du sélecteur : « Cet appareil retiendra votre choix ». |
| Photo proposée pour un profil sans photo | ◐ Propriétaire : étape 3/3 « Votre photo » du premier lancement (`demarrage-iphone-3`). ✘ Invitée Mia, sans photo : aucune proposition — son premier lancement n'a qu'« Étape 1 sur 1 · Votre accueil » (`demarrage-ipad-paysage-3`). |
| Lecteur iPhone paysage : barre du haut collée en haut | ✘ Lecture lancée en portrait puis tournée : la barre reste ~60 pt sous le bord (`lecteur-iphone-paysage-1a`). Lancée en paysage : plus haute mais avec la marge d'une zone sûre de portrait (`-1b`). |
| Lecteur iPad paysage : barre du haut | ◐ Sous la barre d'état, bandeau noir plein en haut et en bas de l'image (`lecteur-ipad-paysage-1`). |
| Feuille des épisodes | ✘ Feuille sombre sur un voile noir qui assombrit toute la vidéo ; sur iPad, une feuille centrée en bas, coupée (`lecteur-*-2-episodes`). |
| Réglages du lecteur | ◐ Panneau sombre ancré en bas à droite, petits caractères, pas de section sous-titres dedans (`-3-reglages`). |
| Sous-titres | ◐ Panneau sombre « Sous-titres » : Désactivé · English - SUBRIP · French - SUBRIP, étiquettes « External » techniques (`-5-sous-titres`, iPad `-4`). |
