# À essayer sur une vraie machine Linux

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
