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
