# À tester sous Linux — Tentacle CEF

## Hors ligne (axe horsligne)

Cœur construit et testé sous Linux (Debian 12, GCC 12.2, conteneur `tentacle-cef-maj-cross`,
50/50, AddressSanitizer) ; la colle CEF jamais lancée sous Linux. Build : `libsqlite3-dev`
(SQLite du système) en plus des prérequis du lanceur.

- **Premier lancement sur un profil d'Electron existant** → « Téléchargements » montre les
  titres gardés par Electron (`~/.local/share/com.tentacle.media/tentacle-local.db`, ou
  `$XDG_DATA_HOME/com.tentacle.media` si la variable est absolue), affiches comprises.
- **Garder un film** (Original) → la barre avance, le fichier final apparaît sous
  `…/downloads/media/<id>/original-<source>.<ext>`, sans `.part`, de la taille annoncée.
- **Pause puis reprise** pendant le transfert → rien ne bouge en pause ; la reprise continue
  là où elle s'était arrêtée (taille du `.part` jamais revenue à zéro).
- **Couper le réseau** (Wi-Fi coupé, `nmcli networking off`) pendant un transfert → « en
  pause » (pas en erreur) ; réseau rétabli → reprise seule en ≤ 5 s.
- **Fermer l'app pendant un transfert**, la relancer → le transfert reprend à son octet.
- **Garder un épisode en Allégé** (720p) → le fichier `light-<source>-p720.mp4` se lit.
- **Garder un album dans Octave** → trois titres à la fois, pochettes ; « Sur cet appareil »
  les liste.
- **Hors ligne** (serveur injoignable) → « Sur cet appareil » liste les titres ; un film se
  lit depuis le disque ; un titre d'Octave gardé se lit (le mpv de la musique sur le fichier).
- **Progression hors ligne** → au retour du réseau, Jellyfin a la position (rapports
  resynchronisés).
- **Auto-suppression après visionnage** (délai « immédiatement ») → le titre vu disparaît à la
  fin de la lecture.
- **Réglages › Téléchargements › Changer de dossier** vers un dossier sans droit d'écriture →
  « pas accessible en écriture » (cause `EACCES …` dans le détail) ; vers un dossier valide sans
  titre gardé → accepté.
- **Anti-suspension** pendant un transfert → `systemd-inhibit --list` montre l'inhibiteur,
  plus rien à la fin.
