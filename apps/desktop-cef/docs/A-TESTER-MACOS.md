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
