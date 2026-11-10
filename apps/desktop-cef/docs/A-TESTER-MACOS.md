# À tester sous macOS, à la main — Tentacle CEF

Ce que les bancs ne prouvent pas sans voler le focus ni faire surgir une fenêtre du système
(`--background`). Une ligne par cas : le geste, l'attendu (Electron 1.42.0 fait de même).

## Cycle de vie et fenêtre (axe systeme)

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
# À essayer sur le Mac, à la main

Ce que les bancs ne peuvent pas prouver (ils relisent ce que macOS tient, sans presser de touche).

## medias — « À l'écoute », touches média

- Touche lecture/pause du clavier (son ouvert, un morceau d'Octave) → pause et reprise ; F7/F9 → précédent/suivant.
- Centre de contrôle › « À l'écoute » → titre, artiste, pochette ; la barre avance seule ; la glisser → le morceau saute à la position.
- AirPods : retirer un écouteur → pause (si l'option est active) ; double tape → suivant.
- Un film → « À l'écoute » montre le titre du film, la barre sans saut ; Suivant grisé sauf épisode suivant ; quitter le lecteur → la fiche disparaît.
- Musique (Apple) joue, puis Tentacle → les touches vont à Tentacle ; Tentacle quitté → elles reviennent à Musique.
# À essayer sur le Mac, à la main (lot cef-parite)

Ce que les bancs ne prouvent pas sans le vrai curseur ni le vrai clavier. Une ligne par cas :
geste → attendu (le comportement d'Electron).

## PiP (axe pip)

Lancer `pnpm dev:cef`, ouvrir un film, « Lecture en incrustation » (bouton du lecteur, ou `I`).

- [ ] Survoler le PiP, application au premier plan → les contrôles paraissent ; la souris quitte le PiP → ils s'effacent.
- [ ] Survoler le PiP alors qu'une AUTRE application est au premier plan → les contrôles paraissent aussi (aucun clic).
- [ ] Premier clic sur « Pause » du PiP, Tentacle en arrière-plan → la lecture se met en pause du premier coup.
- [ ] Après un clic dans le PiP, cliquer un bouton de la fenêtre principale → il répond du premier clic (le focus est revenu à la fenêtre principale).
- [ ] Glisser l'image du PiP (flottant) → la fenêtre suit la main, le point saisi reste sous le curseur ; relâcher → elle reste là.
- [ ] Tirer un coin du PiP (poignée de la page) → il grandit ou rétrécit au ratio de l'image, le coin opposé fixe.
- [ ] Tirer un BORD ou un coin extérieur (zone du système, ~4 à 8 points) → le curseur de redimensionnement paraît sans clic ; le ratio et les bornes tiennent (256 × 144 au moins, 60 % de l'écran au plus).
- [ ] Molette / pincement du pavé sur le PiP → la taille glisse, le coin le plus proche du bord reste fixe.
- [ ] Double-clic sur l'image → retour au lecteur, l'image regagne sa place sans saut.
- [ ] Ancré, réduire la fenêtre principale dans le Dock → le PiP disparaît ; la rouvrir → il revient à son coin.
- [ ] Ancré, déplacer ou redimensionner la fenêtre principale → le PiP la suit, collé à son coin bas-droit.
- [ ] Flottant, passer la fenêtre principale en plein écran puis changer de bureau → le PiP reste visible, au-dessus.
- [ ] Ancré, Tentacle en arrière-plan sous une autre application → l'autre application couvre aussi le PiP.
- [ ] Deux écrans d'échelles différentes : le PiP glissé sur l'autre écran → image nette, cadre à la bonne taille.
- [ ] Cmd+Q pendant le PiP → l'app se ferme sans boîte d'erreur ; relancée, aucune lecture fantôme.
- [ ] « Réduire les animations » (Réglages › Accessibilité › Affichage) → le PiP entre et revient sans animation.
- [ ] PiP d'une vidéo HDR10 / Dolby Vision → l'image reste en HDR (plus lumineuse que l'interface), comme dans le lecteur.
