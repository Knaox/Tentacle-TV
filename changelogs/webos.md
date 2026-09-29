# Changelog — LG webOS

Blocs `## [X.Y.Z]` avec sous-sections `### FR` / `### EN`. Lu par
`.github/workflows/webos.yml` pour les notes de la Release GitHub (illimité).
Renommer `[Unreleased]` en `[X.Y.Z]` au moment d'envoyer (la version vient de
`versions.json` → `webos`).

**Le paquet ne contient que la coquille** : le client React est servi par le
serveur Tentacle sur `/tv`. La plupart des corrections partent donc avec une
mise à jour du SERVEUR, sans nouvel IPK — n'ajouter ici que ce qui touche
réellement la coquille (icône, titre, splash, identifiant, comportement de
lancement), ou une version de référence.

## [Unreleased]
### FR
- …
### EN
- …

## [1.1.0]
### FR
- **Le nouveau logo de Tentacle** sur l'icône et l'écran de lancement
- **Installation sans prérequis** : l'installateur apporte sa propre copie de Node.js, sans droits d'administrateur, et le mode d'emploi illustré se trouve sur tentacletv.app/webos
- L'interface du téléviseur est servie par le serveur Tentacle : avec le serveur 1.22.0, elle reçoit aussi
  - **le focus tient lieu de survol**, et un appui long sur une carte ouvre ses actions, avec l'affiche du titre : Ma liste, favori, vu et votre note en étoiles. Un titre jugé quitte « Pour vous » quand la feuille se referme
  - **la saga d'un film** sur sa fiche, atteignable à la télécommande
  - **des saisons plus rapides** : la saison en cours d'emblée, des pastilles lisibles, des vignettes chargées à l'approche de l'écran
  - **avec Jellyfin 12** : le choix de la version, les filtres de langue audio et de sous-titres, et la VO parmi vos langues audio préférées
  - un lien discret sur la fiche quand le serveur n'est pas réglé pour les bandes-annonces

### EN
- **Tentacle's new logo** on the icon and the launch screen
- **No prerequisites to install**: the installer brings its own copy of Node.js, without administrator rights, and the illustrated guide lives at tentacletv.app/webos
- The TV interface is served by the Tentacle server: with server 1.22.0, it also gets
  - **focus stands in for hover**, and a long press on a card opens its actions, with the title's poster: My list, favorite, watched and your star rating. A judged title leaves "For you" when the sheet closes
  - **a movie's saga** on its page, reachable with the remote
  - **faster seasons**: the current season right away, readable pills, thumbnails loaded as they approach the screen
  - **with Jellyfin 12**: version choice, audio and subtitle language filters, and original language among your preferred audio languages
  - a discreet link on the title page when the server is not set up for trailers

## [1.0.0]
### FR
- Première version pour téléviseurs LG (webOS 4 et ultérieurs)
- Navigation entièrement à la télécommande, dessinée pour être lue à trois mètres
- Lecture directe privilégiée : le téléviseur lit vos fichiers tels quels, sans que le serveur ait à les convertir
- Dolby Vision pris en charge sur les conteneurs qui le transportent ; ailleurs, l'image reste en HDR
- Reprise de lecture, déplacement dans le film et changement de piste audio ou de sous-titres
- Installation depuis un Mac, un PC Windows ou une machine Linux : décompressez l'archive ci-dessous, double-cliquez, répondez à deux questions

### EN
- First release for LG TVs (webOS 4 and later)
- Full remote-control navigation, designed to be read from three metres away
- Direct play first: the TV reads your files as they are, with no server-side conversion
- Dolby Vision supported in the containers that carry it; elsewhere the picture stays HDR
- Resume, in-movie seeking, and audio or subtitle track switching
- Install from a Mac, a Windows PC or a Linux machine: unzip the archive below, double-click, answer two questions
