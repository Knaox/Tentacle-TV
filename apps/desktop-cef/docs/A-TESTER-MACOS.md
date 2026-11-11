# À essayer à la main sous macOS

Ce que les bancs du lot (fenêtre en arrière-plan, `--background`, sans le vrai curseur ni le vrai
clavier, sans voler le focus) ne pouvaient pas prouver. Une ligne par cas : le geste, puis l'attendu
— le comportement d'Electron 1.42.0. Une section par axe ; chaque axe tient la sienne. Lancer :
`pnpm dev:cef` à la racine du monorepo.

## systeme — cycle de vie et fenêtre

- **Glisser la fenêtre** par la bande du haut (38 pt) → la fenêtre suit ; les boutons de la bande (et les feux) restent cliquables ; double-clic sur la bande → l'action du système (Zoom par défaut).
- **Feux** : à gauche dans la bande, à 16 pt du bord, centrés ; après un plein écran (⌃⌘F puis sortie) et un redimensionnement, ils reviennent au même endroit.
- **Fenêtre inactive** (cliquer une autre app) → la barre se ternit (`data-window-inactive`), puis revient en reprenant le focus.
- **Bouton rouge** sans transfert → l'app quitte (pas de fenêtre fantôme dans le Dock).
- **Bouton rouge pendant un téléchargement**, réglage « Continuer en arrière-plan » allumé → la fenêtre disparaît, une notification « Téléchargements en arrière-plan » s'affiche (autorisation demandée la première fois), l'icône reste dans le Dock ; l'app quitte d'elle-même quand la file est vide.
- **Clic sur l'icône du Dock pendant cette fin de transferts** → l'app se RELANCE (nouvelle fenêtre, transferts repris).
- **⌘Q pendant un téléchargement** → feuille « Un téléchargement est en cours. » sur la fenêtre ; Échap ou « Annuler » → rien ne change ; « Quitter quand même » → l'app quitte.
- **Lien `tentacle://octave/…`** (Safari, Notes) app fermée → l'app s'ouvre sur la page d'Octave ; app ouverte → la page s'ouvre et la fenêtre passe devant.
- **Menu Tentacle TV › À propos de Tentacle TV** → « Tentacle TV », la version de l'app, l'icône ; un seul numéro de version.
- **Réglages › Téléchargements › Changer de dossier** → panneau en feuille, « Nouveau dossier » présent ; le choix est rendu à la page.
- **Lecture d'un film, ne rien toucher 10 min** → l'écran ne s'éteint pas ; en pause/hors lecture il s'éteint au délai du système (`pmset -g assertions` : « Prevent display sleep » pendant la lecture seulement).
- **Quitter en pleine lecture** → dans Jellyfin, la session n'est plus « en lecture » et la position de reprise est celle de la sortie (relais `jellyfin_session_post` de l'axe reseau branché).

## medias — « À l'écoute », touches média

- Touche lecture/pause du clavier (son ouvert, un morceau d'Octave) → pause et reprise ; F7/F9 → précédent/suivant.
- Centre de contrôle › « À l'écoute » → titre, artiste, pochette ; la barre avance seule ; la glisser → le morceau saute à la position.
- AirPods : retirer un écouteur → pause (si l'option est active) ; double tape → suivant.
- Un film → « À l'écoute » montre le titre du film, la barre sans saut ; Suivant grisé sauf épisode suivant ; quitter le lecteur → la fiche disparaît.
- Musique (Apple) joue, puis Tentacle → les touches vont à Tentacle ; Tentacle quitté → elles reviennent à Musique.

## pip — l'image dans l'image

Lancer `pnpm dev:cef`, ouvrir un film, « Lecture en incrustation » (bouton du lecteur, ou `I`).

- Survoler le PiP, application au premier plan → les contrôles paraissent ; la souris quitte le PiP → ils s'effacent.
- Survoler le PiP alors qu'une AUTRE application est au premier plan → les contrôles paraissent aussi (aucun clic).
- Premier clic sur « Pause » du PiP, Tentacle en arrière-plan → la lecture se met en pause du premier coup.
- Après un clic dans le PiP, cliquer un bouton de la fenêtre principale → il répond du premier clic (le focus est revenu à la fenêtre principale).
- Glisser l'image du PiP (flottant) → la fenêtre suit la main, le point saisi reste sous le curseur ; relâcher → elle reste là.
- Tirer un coin du PiP (poignée de la page) → il grandit ou rétrécit au ratio de l'image, le coin opposé fixe.
- Tirer un BORD ou un coin extérieur (zone du système, ~4 à 8 points) → le curseur de redimensionnement paraît sans clic ; le ratio et les bornes tiennent (256 × 144 au moins, 60 % de l'écran au plus).
- Molette / pincement du pavé sur le PiP → la taille glisse, le coin le plus proche du bord reste fixe.
- Double-clic sur l'image → retour au lecteur, l'image regagne sa place sans saut.
- Ancré, réduire la fenêtre principale dans le Dock → le PiP disparaît ; la rouvrir → il revient à son coin.
- Ancré, déplacer ou redimensionner la fenêtre principale → le PiP la suit, collé à son coin bas-droit.
- Flottant, passer la fenêtre principale en plein écran puis changer de bureau → le PiP reste visible, au-dessus.
- Ancré, Tentacle en arrière-plan sous une autre application → l'autre application couvre aussi le PiP.
- Deux écrans d'échelles différentes : le PiP glissé sur l'autre écran → image nette, cadre à la bonne taille.
- Cmd+Q pendant le PiP → l'app se ferme sans boîte d'erreur ; relancée, aucune lecture fantôme.
- « Réduire les animations » (Réglages › Accessibilité › Affichage) → le PiP entre et revient sans animation.
- PiP d'une vidéo HDR10 / Dolby Vision → l'image reste en HDR (plus lumineuse que l'interface), comme dans le lecteur.

## navigateur — fichiers, glisser-déposer, bulles, sélecteurs

- Glisser un fichier audio du Finder sur Octave → la boîte d'import s'ouvre avec ce fichier ; le glisser hors de la fenêtre puis le lâcher dans le Finder → rien ne change dans l'app.
- Glisser une affiche ou un lien de Tentacle et le lâcher ailleurs dans la page → rien (ni navigation, ni onglet) ; Échap pendant un glisser d'un titre d'Octave → le glisser s'arrête, l'image fantôme disparaît.
- App au premier plan : survoler un bouton-icône sans bouger ~1 s → bulle macOS (même délai que les autres apps) ; la bulle part au clic et quand l'app passe derrière.
- Réglages › photo de profil › « Importer une photo » → feuille NSOpenPanel attachée à la fenêtre, « Afficher les options » → « Format: Image Files / All Files ».

## verre — Liquid Glass (macOS 26, Apple Silicon)

`pnpm dev:cef`, Réglages › Apparence › « Liquid Glass dans Tentacle » allumé, puis un film.

- Contrôles du lecteur affichés → capsules en verre (retour, son, ±10/30 s, pause, vitesse, réglages, PiP, plein écran) : la vidéo se voit À TRAVERS, déformée au bord, comme sous Electron.
- Bouger la souris après quelques secondes d'immobilité → les capsules MONTENT et s'allument en même temps que leurs glyphes (aucun décalage verre / icône) ; elles s'effacent plus vite qu'elles ne viennent.
- Passage d'une scène très claire (neige) à une scène sombre → les glyphes des capsules passent du sombre au clair en une à deux secondes.
- Fenêtre active puis inactive (cliquer une autre app) → le verre fonce et pâlit comme le verre du système, rien ne clignote.
- Plein écran et retour, redimensionner la fenêtre pendant la lecture → les capsules restent collées à leurs boutons.
- Film HDR10 ou Dolby Vision, verre posé → l'image reste en HDR (plus lumineuse que l'interface).
- « Lecture en incrustation » (PiP) → aucun verre dans la fenêtre PiP ; retour au lecteur → le verre revient.
- Réglage coupé → plus aucun verre natif, le lecteur d'avant ; macOS < 26 ou Intel : l'option n'existe pas / pas de verre du lecteur.
- Coût, FENÊTRE VISIBLE (le banc refuse une fenêtre cachée) : `PONT_CDP_PORT=<port> node bench/glass/gpu.mjs 12 3` → WindowServer avec/sans verre (Electron : +3 à +5 points), 0 image perdue.

## lecture — ce qui reste à voir de ses yeux (lot rf2)

Prouvé le 11/11 par l'état des `<video>` et des captures CDP, fenêtre en arrière-plan et son coupé :

- Le SON d'un aperçu au survol, sans avoir rien cliqué depuis le lancement (la politique
  d'autoplay le permet ; le banc tournait en `--mute`) : il doit monter en fondu, pas d'un coup.
- Le lecteur de secours sur un film AV1 HDR (image COPIÉE, Chromium ramène le HDR à l'écran) :
  couleurs et hautes lumières à juger — le banc n'a vu qu'un carton de générique.
- `TENTACLE_MPV_FAIL=fatal pnpm dev:cef -- --mute`, fenêtre ACTIVE : la bascule doit se faire
  sans éclair (la surface de mpv part, la page reprend) — non jugé image par image.
