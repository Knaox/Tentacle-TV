# À essayer sur une vraie machine Linux

Une ligne par cas : geste, puis ce qui est attendu. Chaque axe tient sa section.

## reseau (pochettes, greffons, CSP, relais, requêtes déléguées, préchargement)

- `pnpm dev:cef` sur le profil d'Electron, Octave ouvert → les pochettes s'affichent ; `ls ~/.local/share/com.tentacle.media/octave-art/*/` (ou `$XDG_DATA_HOME/…`) liste les fichiers ; relancé, les pochettes reviennent sans réseau (`X-Octave-Art: disk` dans les DevTools).
- `XDG_DATA_HOME=/chemin/absolu pnpm dev:cef` → le cache `octave-art/` naît sous `/chemin/absolu/com.tentacle.media/`, jamais sous `~/.config`.
- Se déconnecter d'Octave → `octave-art/` disparaît (POST `tentacle://art/clear`).
- Ouvrir la page d'une extension (Vigie, Sillon) → elle se charge (iframe `tentacle://plugin/<id>`), aucune « violation de CSP » de l'application dans la console.
- Lire un film sur un serveur à lecture directe (adresse privée de Jellyfin réglée) → la position de reprise est gardée par Jellyfin (relais `jellyfin_session_post`) ; `__shell.invoke('reseau.debug.trace')` liste `PlaybackInfo`, `Sessions/Playing…`.
- Sillon : une recherche passe par l'appareil (`window.tentacle.invoke('client_fetch_log', {})` montre l'hôte, 200) ; un titre « direct » joue par `http://127.0.0.1:<port>/d/…` (`reseau.debug.directRelay` : `direct` > 0).
- Ouvrir la fiche d'un film → la sortie de l'app dit `[reseau] préchargement <id> : … Kio · … Kio`.
# À tester sous Linux — Tentacle CEF

## Cycle de vie et fenêtre (axe systeme)

Écrit et vérifié en `-fsyntax-only` (g++ 12, conteneur `tentacle-cef-maj-cross`) ; jamais lancé.

- **Fermer la fenêtre** sans transfert → l'app quitte.
- **Fermer pendant un téléchargement** (réglage allumé) → la fenêtre part, une notification (libnotify) « Téléchargements en arrière-plan » s'affiche ; le processus finit puis sort ; `systemd-inhibit --list` montre « Tentacle TV » pendant le transfert, plus rien ensuite.
- **Relancer l'app pendant cette fin de transferts** → l'instance en cours se relance (une fenêtre, pas deux processus).
- **Quitter (menu du gestionnaire de fenêtres, `kill -TERM`) pendant un téléchargement** → boîte « Quitter quand même / Annuler » (zenity, sinon X11) ; Échap = Annuler.
- **Lien `tentacle://octave/…`** (`xdg-open`, une fois le `.desktop` déclarant le schéma installé) app ouverte → la page s'ouvre, la fenêtre passe devant ; app fermée → elle s'ouvre dessus.
- **Second lancement** (`pnpm dev:cef` une seconde fois sur le même profil) → la première fenêtre passe devant, le second sort aussitôt (code 0).
- **Réglages › Téléchargements › Changer de dossier** → sélecteur du portail XDG (ou zenity) ; le choix revient à la page.
- **Lecture d'un film** → `systemd-inhibit --list` : « Tentacle TV … idle:sleep » ; l'écran ne s'éteint pas ; rien hors lecture.
- **Icône de la fenêtre** (X11, et Wayland si le compositeur lit `xdg-toplevel-icon`) → le poulpe de Tentacle.
- **Mise en veille puis réveil pendant un téléchargement** → il reprend dans les 15 s (veille lue sur CLOCK_BOOTTIME).
- **Préférences › Session graphique › Relancer** (`window.tentacle.relaunch`) → l'app se ferme et revient seule sur le même profil.
Une ligne par cas : geste → attendu. Lancer par `pnpm dev:cef` (dépendance de build : gio-2.0,
`libglib2.0-dev` / `glib2-devel` / `glib2`).

## medias — « À l'écoute » (MPRIS), touches média, Octave

- GNOME : un morceau d'Octave → lecteur dans la liste des notifications avec titre, artiste, album et pochette ; boutons lecture/pause, suivant, précédent qui agissent.
- KDE Plasma : widget « Lecteur multimédia » et écran verrouillé → même fiche, barre de position qui avance seule et suit un saut.
- Touches média du clavier (gsd-media-keys, KGlobalAccel) → pause/reprise, suivant, précédent sur la source montrée (film ou musique).
- `playerctl metadata` / `playerctl position` → fiche juste, `mpris:artUrl` en `file://` (jamais d'adresse http), position qui avance.
- Un film → la fiche dit le titre du film ; suivant/précédent grisés sauf épisode suivant ; quitter le lecteur → le lecteur MPRIS disparaît.
- Deux instances (Electron fermé, deux CEF) → la seconde prend `org.mpris.MediaPlayer2.tentacle.instance<pid>`.
- Sans bus de session (TTY, conteneur) → l'app démarre sans erreur, rien ne s'affiche.
- Octave : « Sortie audio » → PipeWire (sans le doublon PulseAudio), ALSA `hw:` proposé exclusif ; mode exclusif → son bit pour bit, houle arrêtée.
- Octave : transition douce à 6 s entre deux albums → fondu sans blanc ; même album dans l'ordre → enchaînement sans blanc.
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
