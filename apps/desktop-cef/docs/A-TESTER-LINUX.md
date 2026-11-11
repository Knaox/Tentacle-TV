# À essayer sur une vraie machine Linux

Ce que le conteneur du lot (Fedora 44 **arm64**, sans écran, Mesa logiciel : `bench/linux/`)
ne pouvait pas prouver. Une ligne par cas : le geste, puis l'attendu. Une section par axe ;
chaque axe tient la sienne. Lancer : `pnpm dev:cef` à la racine du monorepo — le lanceur vérifie
les prérequis et donne LA commande d'installation de la distribution (SQLite, GLib/GIO compris).

## linux — lanceur, fenêtre, page, vidéo, session graphique

### Lanceur

- `pnpm dev:cef` sur une machine neuve (Fedora 44 **x86_64** : le banc est arm64) → liste des paquets manquants en UNE commande `sudo dnf install …`, puis arrêt.
- Relancer après l'installation → CEF linux64 téléchargé (~333 Mo, épinglé SHA-256 `6873f975…`), libmpv du fork construite (meson), build, app lancée.
- `pnpm dev:cef` avec Tentacle TV (Electron) ouvert → refus : « le profil d'Electron est ouvert par un autre processus », avec son PID.
- `pnpm dev:cef` sous Ubuntu 24.04 (pas de `libsdl3-dev`) → SDL3 3.4.16 construite depuis l'archive épinglée, puis l'app.
- `TENTACLE_MPV=system pnpm dev:cef` → avertissement « libmpv de la distribution… correctifs 0002/0003 absents… pas de HDR », l'app part quand même.
- Se connecter dans CEF, quitter, ouvrir Electron (`pnpm dev:electron`) → déjà connecté (même `Local Storage`, `~/.local/share/com.tentacle.media`).

### Fenêtre et page

- Session GNOME Wayland, écran HiDPI 200 % → page nette, à la bonne taille ; `[session] bureau=wayland … montage=wayland` au journal.
- GNOME en échelle fractionnaire (125 %, 150 %) → page nette, pas floue, pas décalée ; clics au bon endroit.
- KDE Plasma 6 Wayland → idem ; pas de bordure noire autour de la page.
- Session X11 (ou `TENTACLE_LINUX_SESSION=x11`) → fenêtre sous XWayland/X.Org, page affichée ; `montage=x11`.
- X11 HiDPI (`Xft.dpi: 192`) → **à vérifier** : échelle de la page (SDL compte en pixels sous X11, `shell/window_scale.h`).
- Redimensionner la fenêtre à la souris, vite → la page suit sans trou noir durable ni plantage.
- F11, puis Échap → plein écran du compositeur, retour à la taille d'avant.
- GNOME : décorations de la fenêtre → barre de titre (libdecor) ; déplacer, agrandir, fermer.
- Deux écrans d'échelles différentes, glisser la fenêtre de l'un à l'autre → la page se redessine nette à la nouvelle échelle.
- Vrai GPU Intel/AMD (Mesa) → `__shell.invoke('shell.debug.layers')` (console DevTools) dit `dmabuf oui (N images)`, N qui monte : la page passe par le GPU, sans copie CPU.
- NVIDIA (pilote propriétaire) → idem ; si la page reste NOIRE : relancer avec `TENTACLE_NO_SHARED_TEXTURE=1` et le signaler (import dmabuf refusé).

### Clavier, saisie, presse-papiers

- Clavier AZERTY : `é`, `è`, `ç`, `à`, Maj+chiffres, AltGr+`e` (€) → caractères justes dans la recherche.
- Touches de direction, Tab, Retour arrière, Entrée, Ctrl+A/C/V dans un champ → comportement d'un navigateur.
- IME réel (ibus, japonais ou pinyin) sous Wayland et X11 → candidats près du curseur, texte composé puis validé.
- Copier un lien (bouton « Copier »), le coller dans un autre logiciel → le texte arrive ; Ctrl+V d'une adresse de serveur dans la connexion → collée.
- Molette à crans, pavé tactile à deux doigts → défilement fluide, vitesse proche d'Electron.
- Survol d'un lien, d'un champ → curseur main, curseur texte.

### Vidéo

- Lire un film (Wayland, GPU Intel/AMD, Mesa ≥ 25) → image sous la page (sous-surface), contrôles par-dessus, `[vidéo] sous-surface Wayland sous la page (wlhostvk…)` ; pas de `gpu-sw` (réservé au banc).
- Même chose sur NVIDIA → idem ; démarrage de la vidéo sans long gel (premier titre).
- Décodage matériel (VA-API Intel/AMD, NVDEC) → `hwdec-current` non vide dans le panneau de diagnostic.
- Fenêtré pendant la lecture, déplacer puis redimensionner la fenêtre → la vidéo suit la fenêtre, toujours sous les contrôles, à la nouvelle taille.
- Plein écran pendant la lecture, puis sortie → vidéo plein cadre, aucun décalage au retour (le compositeur recadre : prouvé au banc, 1920×1080 puis retour).
- Session X11 : lire un film → vidéo dans la fenêtre (API de rendu OpenGL), SDR.
- Changer de piste audio ou de sous-titres en lecture → pas de vidage du cache ni d'image figée (correctifs 0002/0003).
- Film HDR10, écran HDR, HDR allumé (GNOME 48+, KDE 6) → panneau de diagnostic : `espaceCouche` « contenu pq → sortie pq/bt.2020 · pic N× », `transmission` vrai, image HDR réelle (WSI Vulkan de Mesa ≥ 25.1 ou NVIDIA récent).
- Même film, HDR éteint dans le bureau → « … — TONE-MAPPÉ », `transmission` faux, tone-mapping SDR propre, pas d'image délavée.
- Écran laissé en HDR, film SDR → « contenu bt.1886 → sortie pq/… — SDR converti », `enabled` vrai, `transmission` null.
- X11, film HDR → `espaceCouche` null : l'API de rendu de libmpv ne renseigne pas `video-target-params` (vu au banc) — null, jamais un faux « non ».

### Session graphique et système

- Préférences › Session graphique : choisir X11, relancer → l'app revient sous XWayland (`montage=x11`), le réglage relu par Electron aussi.
- Écrire `{ "session": "wayland" }` à la main dans `session-graphique.json` → relu au lancement suivant.
- Langue du système en allemand (`LANG=de_DE.UTF-8`) → `navigator.languages` = `["de-DE", "de"]`.

## systeme — cycle de vie et fenêtre

Écrit et vérifié en `-fsyntax-only` (g++ 12, conteneur `tentacle-cef-maj-cross`) ; jamais lancé hors du banc.

- Fermer la fenêtre sans transfert → l'app quitte.
- Fermer pendant un téléchargement (réglage allumé) → la fenêtre part, une notification (libnotify) « Téléchargements en arrière-plan » s'affiche ; le processus finit puis sort ; `systemd-inhibit --list` montre « Tentacle TV » pendant le transfert, plus rien ensuite.
- Relancer l'app pendant cette fin de transferts → l'instance en cours se relance (une fenêtre, pas deux processus).
- Quitter (menu du gestionnaire de fenêtres, `kill -TERM`) pendant un téléchargement → boîte « Quitter quand même / Annuler » (zenity, sinon X11) ; Échap = Annuler.
- Lien `tentacle://octave/…` (`xdg-open`, le `.desktop` déclarant le schéma installé), app ouverte → la page s'ouvre, la fenêtre passe devant ; app fermée → elle s'ouvre dessus.
- Second lancement (`pnpm dev:cef` une seconde fois sur le même profil) → la première fenêtre passe devant, le second sort aussitôt (code 0).
- Réglages › Téléchargements › Changer de dossier → sélecteur du portail XDG (ou zenity) ; le choix revient à la page.
- Lecture d'un film → `systemd-inhibit --list` : « Tentacle TV … idle:sleep » ; l'écran ne s'éteint pas ; rien hors lecture.
- Octave : écouter un album, verrouiller la session → la musique continue (pas de veille pendant la lecture, logind).
- Mise en veille du système pendant la lecture → refusée (inhibition logind).
- Icône de la fenêtre (X11, et Wayland si le compositeur lit `xdg-toplevel-icon`) → le poulpe de Tentacle.
- Mise en veille puis réveil pendant un téléchargement → il reprend dans les 15 s (veille lue sur CLOCK_BOOTTIME).
- Préférences › Session graphique › Relancer (`window.tentacle.relaunch`) → l'app se ferme et revient seule sur le même profil.

## medias — « À l'écoute » (MPRIS), touches média, Octave

Au banc (sway et X11, bus de session du conteneur) : `bench/linux/prove-integ.mjs mpris` — fiche lue par `gdbus`, Pause / Next / Previous jusqu'à la page, SetPosition appliqué, nom retiré à l'arrêt. Reste le bureau réel :

- GNOME : un morceau d'Octave → lecteur dans la liste des notifications avec titre, artiste, album et pochette ; boutons lecture/pause, suivant, précédent qui agissent.
- KDE Plasma : widget « Lecteur multimédia » et écran verrouillé → même fiche, barre de position qui avance seule et suit un saut.
- Touches média du clavier (gsd-media-keys, KGlobalAccel) → pause/reprise, suivant, précédent sur la source montrée (film ou musique).
- `playerctl metadata` / `playerctl position` → fiche juste, `mpris:artUrl` en `file://` (jamais d'adresse http), position qui avance.
- Un film → la fiche dit le titre du film ; suivant/précédent grisés sauf épisode suivant ; quitter le lecteur → le lecteur MPRIS disparaît.
- Deux instances (Electron fermé, deux CEF) → la seconde prend `org.mpris.MediaPlayer2.tentacle.instance<pid>`.
- Sans bus de session (TTY) → l'app démarre sans erreur, rien ne s'affiche.
- Octave : « Sortie audio » → PipeWire (sans le doublon PulseAudio), ALSA `hw:` proposé exclusif ; mode exclusif → son bit pour bit, houle arrêtée.
- Octave : transition douce à 6 s entre deux albums → fondu sans blanc ; même album dans l'ordre → enchaînement sans blanc.

## horsligne — titres gardés

Cœur construit et testé sous Linux (50/50, AddressSanitizer) ; au banc (sway et X11), un album gardé puis relu par Octave depuis le fichier (`bench/linux/prove-integ.mjs kept`). Build : SQLite du système (`sqlite-devel` / `libsqlite3-dev`), dans les prérequis du lanceur.

- Premier lancement sur un profil d'Electron existant → « Téléchargements » montre les titres gardés par Electron (`~/.local/share/com.tentacle.media/tentacle-local.db`, ou `$XDG_DATA_HOME/com.tentacle.media` si la variable est absolue), affiches comprises.
- Garder un film (Original) → la barre avance, le fichier final apparaît sous `…/downloads/media/<id>/original-<source>.<ext>`, sans `.part`, de la taille annoncée.
- Pause puis reprise pendant le transfert → rien ne bouge en pause ; la reprise continue là où elle s'était arrêtée (taille du `.part` jamais revenue à zéro).
- Couper le réseau (`nmcli networking off`) pendant un transfert → « en pause » (pas en erreur) ; réseau rétabli → reprise seule en ≤ 5 s.
- Fermer l'app pendant un transfert, la relancer → le transfert reprend à son octet.
- Garder un épisode en Allégé (720p) → le fichier `light-<source>-p720.mp4` se lit.
- Garder un album dans Octave → trois titres à la fois, pochettes ; « Sur cet appareil » les liste.
- Hors ligne (serveur injoignable) → « Sur cet appareil » liste les titres ; un film se lit depuis le disque ; un titre d'Octave gardé se lit (le mpv de la musique sur le fichier).
- Progression hors ligne → au retour du réseau, Jellyfin a la position (rapports resynchronisés).
- Auto-suppression après visionnage (délai « immédiatement ») → le titre vu disparaît à la fin de la lecture.
- Réglages › Téléchargements › Changer de dossier vers un dossier sans droit d'écriture → « pas accessible en écriture » (cause `EACCES …` dans le détail) ; vers un dossier valide sans titre gardé → accepté.
- Anti-suspension pendant un transfert → `systemd-inhibit --list` montre l'inhibiteur, plus rien à la fin.

## navigateur — boîtes, fichiers, liens, bulles, curseurs

Au banc : `confirm()` → boîte GTK (sway : flottante, au focus ; X11 : dialogue transitoire de la fenêtre de l'app), Échap → annuler, Entrée → OK (`bench/linux/prove-integ.mjs dialog`).

- Réglages › Profil › « Changer la photo » › « Importer une photo » → le sélecteur de fichiers du bureau (portail XDG : GNOME/KDE) s'ouvre, filtre images ; choisir une image → elle devient la photo.
- Octave › Importer › fichiers audio → le sélecteur s'ouvre en sélection MULTIPLE, filtre audio ; Annuler → rien ne change.
- Fenêtre étroite (< 768 px) › Profil › « Se déconnecter » → boîte GTK « OK » / « Annuler » (libellés traduits par GTK), modale à la fenêtre (X11) ; « Annuler » → rien, « OK » → déconnexion.
- Même geste sous Wayland → la boîte GTK s'ouvre (sans parenté : normal), répond aux clics et au clavier.
- Machine SANS GTK 3 → boîte de SDL à la place (X11 : dessinée par SDL ; Wayland : zenity/kdialog), mêmes réponses.
- Un lien externe (Crédits › un lien) → s'ouvre dans le navigateur par défaut (xdg-open), l'app reste sur sa page.
- Glisser un fichier audio depuis le gestionnaire de fichiers sur Octave → la boîte d'import s'ouvre avec ce fichier.
- Survoler un bouton-icône (Octave, lecteur) sans bouger ½ s → une bulle sombre avec le texte de `title=`, sous le curseur ; un clic la retire. Sans Pango/Cairo : aucune bulle (attendu).
- Survoler la poignée du chat de Watch Together (`cursor-grab`) → une main (approchée : SDL n'a pas de « grab ») ; `cursor: none` pendant la lecture → curseur caché.

## reseau — pochettes, greffons, CSP, relais, requêtes déléguées, préchargement

- `pnpm dev:cef` sur le profil d'Electron, Octave ouvert → les pochettes s'affichent ; `ls ~/.local/share/com.tentacle.media/octave-art/*/` (ou `$XDG_DATA_HOME/…`) liste les fichiers ; relancé, les pochettes reviennent sans réseau (`X-Octave-Art: disk` dans les DevTools).
- `XDG_DATA_HOME=/chemin/absolu pnpm dev:cef` → le cache `octave-art/` naît sous `/chemin/absolu/com.tentacle.media/`, jamais sous `~/.config`.
- Se déconnecter d'Octave → `octave-art/` disparaît (POST `tentacle://art/clear`).
- Ouvrir la page d'une extension (Vigie, Sillon) → elle se charge (iframe `tentacle://plugin/<id>`), aucune « violation de CSP » de l'application dans la console.
- Lire un film sur un serveur à lecture directe (adresse privée de Jellyfin réglée) → la position de reprise est gardée par Jellyfin (relais `jellyfin_session_post`) ; `__shell.invoke('reseau.debug.trace')` liste `PlaybackInfo`, `Sessions/Playing…`.
- Sillon : une recherche passe par l'appareil (`window.tentacle.invoke('client_fetch_log', {})` montre l'hôte, 200) ; un titre « direct » joue par `http://127.0.0.1:<port>/d/…` (`reseau.debug.directRelay` : `direct` > 0).
- Ouvrir la fiche d'un film → la sortie de l'app dit `[reseau] préchargement <id> : … Kio · … Kio`.

## pip — l'image dans l'image (Wayland seulement)

Au banc (sway) : `bench/linux/prove-pip.mjs` — réduire, vidéo vue DANS la fenêtre PiP, marge transparente, revenir au lecteur, réduire encore, fermer ; la lecture ne s'arrête jamais. X11 : pas de PiP (comme Electron), « Réduire » absent.

- GNOME Wayland : lire un film, « Lecture en incrustation » → une petite fenêtre avec la vidéo, cadre arrondi et ombre ; la fenêtre principale revient à la fiche. Sa PLACE est celle que choisit mutter (un client Wayland ne place pas ses fenêtres) : la noter.
- KDE Plasma 6 Wayland → idem ; la place et le maintien au premier plan (KWin) : les noter.
- Film HDR10, écran HDR → l'image reste HDR dans le PiP (la même surface de mpv change de parent : panneau de diagnostic, `espaceCouche` inchangé).
- Molette sur le PiP, tirer un coin → il grandit ou rapetisse ; la vidéo suit, cadre net.
- « Revenir au lecteur » → la vidéo revient plein cadre dans la fenêtre principale, sans coupure ni nouvelle mise en mémoire tampon.
- « Fermer la vidéo » depuis le PiP → la fenêtre part, la lecture s'arrête, la fiche reste.
- Vrai GPU : `__shell.invoke('pip.debug.state')` → `layers` de la pile du PiP « sous-surface (18,18 … DIP) », `dmabuf oui (N images)` qui monte (la page du PiP passe par le GPU).
- libmpv de la distribution (`TENTACLE_MPV=system`, API de rendu) sous Wayland → le PiP montre aussi la vidéo (textures partagées entre les deux contextes EGL) ; le signaler s'il reste noir.

## lecture — aperçus, bande-annonce de la fiche, lecteur de secours (lot rf2)

Prouvé sur macOS seulement (11/11) ; rien de ce qui suit n'a tourné sous Linux depuis ce lot. Il
faut un serveur qui déclare `trailers.openCodecs` (version ≥ 1.41.0) : sans lui, AUCUN aperçu et
le lecteur officiel de YouTube sur la fiche — c'est voulu.

- Juste après le lancement, SANS rien cliquer : survoler une carte de l'accueil → la mini-carte s'ouvre, la bande-annonce AVANCE (pas une image figée) et le son part (`--autoplay-policy=no-user-gesture-required`).
- Fiche d'un film → « Bande-annonce » → le lecteur joue (VP9 + Opus), Échap le ferme.
- `TENTACLE_MPV_FAIL=init pnpm dev:cef` → lancer un film : bandeau « Lecteur de secours », l'image vient du lecteur web, à la position de reprise de la fiche.
- `TENTACLE_MPV_FAIL=fatal pnpm dev:cef` → la lecture part dans mpv, tombe dix secondes plus tard, le lecteur web reprend AU MÊME ENDROIT (à une seconde près).
- Autres modes : `stall` (bascule après 8 s), `load`, `absent` ; en route : `tentacle.invoke("mpv_debug_fail", { mode: "fatal" })`.
- Lecteur préchauffé (sous-surface Wayland) + `TENTACLE_MPV_FAIL=init` → l'instance préchauffée ne ressort pas à l'écran ; la noter si une fenêtre vidéo vide reste.
- À noter : décodage de l'AV1 par le lecteur web (VA-API ou logiciel) — images perdues sur un film 4K, charge du processeur.
