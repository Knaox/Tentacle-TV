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
