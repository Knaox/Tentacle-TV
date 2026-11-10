# À essayer sur une vraie machine Linux (Damien)

Ce que le conteneur du lot (Fedora 44 **arm64**, sans écran, Mesa logiciel) ne peut pas prouver.
Une ligne par cas : le geste, puis l'attendu. Lancer : `pnpm dev:cef` à la racine du monorepo
(le lanceur vérifie les prérequis et donne LA commande d'installation de la distribution).

## Lanceur

| Geste | Attendu |
|---|---|
| `pnpm dev:cef` sur une machine neuve (Fedora 44 x86_64) | liste des paquets manquants en UNE commande `sudo dnf install …`, puis arrêt |
| relancer après l'installation | CEF linux64 téléchargé (~333 Mo, SHA-1 vérifiée, SHA-256 imprimée à recopier dans `scripts/dev/cef.mjs`), libmpv du fork construite (meson), build, app lancée |
| `pnpm dev:cef` avec Tentacle TV (Electron) ouvert | refus : « le profil d'Electron est ouvert par un autre processus », avec son PID |
| `pnpm dev:cef` sous Ubuntu 24.04 (pas de libsdl3-dev) | SDL3 3.4.16 construite depuis l'archive épinglée, puis l'app |
| `TENTACLE_MPV=system pnpm dev:cef` | avertissement « libmpv de la distribution… correctifs 0002/0003 absents… pas de HDR », l'app part quand même |
| se connecter dans CEF, quitter, ouvrir Electron (`pnpm dev:electron`) | déjà connecté (même `Local Storage`, `~/.local/share/com.tentacle.media`) |

## Fenêtre et page

| Geste | Attendu |
|---|---|
| session GNOME Wayland, écran HiDPI 200 % | page nette, à la bonne taille ; `[session] bureau=wayland … montage=wayland` au journal |
| GNOME en échelle fractionnaire (125 %, 150 %) | page nette, pas floue, pas décalée ; clics au bon endroit |
| KDE Plasma 6 Wayland | idem ; pas de bordure noire autour de la page |
| session X11 (ou `TENTACLE_LINUX_SESSION=x11`) | fenêtre sous XWayland/X.Org, page affichée ; `montage=x11` |
| X11 HiDPI (`Xft.dpi: 192`) | **à vérifier** : échelle de la page (SDL compte en pixels sous X11 ; voir `shell/window_scale.h` de l'axe windows) |
| redimensionner la fenêtre à la souris, vite | la page suit sans trou noir durable ni plantage |
| F11, puis Échap | plein écran du compositeur, retour à la taille d'avant |
| clavier AZERTY : `é`, `è`, `ç`, `à`, Maj+chiffres, AltGr+`e` (€) | caractères justes dans la recherche |
| touches de direction, Tab, Retour arrière, Entrée, Ctrl+A/C/V dans un champ | comportement d'un navigateur |
| IME (ibus, japonais ou pinyin) dans la recherche | fenêtre de candidats près du curseur, texte composé puis validé |
| molette à crans, pavé tactile à deux doigts | défilement fluide, vitesse proche d'Electron |
| survol d'un lien, d'un champ | curseur main, curseur texte |

## Vidéo

| Geste | Attendu |
|---|---|
| lire un film (Wayland, GPU Intel/AMD, Mesa ≥ 25) | image sous la page (sous-surface), contrôles par-dessus, `[vidéo] sous-surface Wayland sous la page (wlhostvk…)` |
| même chose sur NVIDIA (pilote propriétaire) | idem ; démarrage de la vidéo sans long gel (mesure du premier titre) |
| film HDR10 sur un écran HDR, HDR activé dans GNOME 48+/KDE 6 | panneau de diagnostic : sortie PQ (`video-target-params/gamma`), image HDR réelle |
| même film, HDR désactivé dans le bureau | tone-mapping SDR propre, pas d'image délavée |
| fenêtré pendant la lecture, déplacer/redimensionner la fenêtre | la vidéo suit la fenêtre, toujours sous les contrôles |
| plein écran pendant la lecture, puis sortie | vidéo plein cadre, aucun décalage au retour |
| session X11 : lire un film | vidéo dans la fenêtre (API de rendu OpenGL), SDR |
| décodage matériel VA-API (Intel/AMD) | `hwdec-current` non vide dans le panneau de diagnostic |
| changer de piste audio/sous-titres en lecture | pas de vidage du cache ni d'image figée (correctifs 0002/0003) |

## Système

| Geste | Attendu |
|---|---|
| Préférences › Session graphique : choisir X11, relancer | l'app revient sous XWayland (`montage=x11`), le réglage relu par Electron aussi |
| écrire `{ "session": "wayland" }` à la main dans `session-graphique.json` | relu au lancement suivant |
| langue du système en allemand (`LANG=de_DE.UTF-8`) | `navigator.languages` = `["de-DE", "de"]` |
| Octave : écouter un album, verrouiller la session | la musique continue (pas de veille pendant la lecture : axe systeme, logind) |

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

## reseau (pochettes, greffons, CSP, relais, requêtes déléguées, préchargement)

- `pnpm dev:cef` sur le profil d'Electron, Octave ouvert → les pochettes s'affichent ; `ls ~/.local/share/com.tentacle.media/octave-art/*/` (ou `$XDG_DATA_HOME/…`) liste les fichiers ; relancé, les pochettes reviennent sans réseau (`X-Octave-Art: disk` dans les DevTools).
- `XDG_DATA_HOME=/chemin/absolu pnpm dev:cef` → le cache `octave-art/` naît sous `/chemin/absolu/com.tentacle.media/`, jamais sous `~/.config`.
- Se déconnecter d'Octave → `octave-art/` disparaît (POST `tentacle://art/clear`).
- Ouvrir la page d'une extension (Vigie, Sillon) → elle se charge (iframe `tentacle://plugin/<id>`), aucune « violation de CSP » de l'application dans la console.
- Lire un film sur un serveur à lecture directe (adresse privée de Jellyfin réglée) → la position de reprise est gardée par Jellyfin (relais `jellyfin_session_post`) ; `__shell.invoke('reseau.debug.trace')` liste `PlaybackInfo`, `Sessions/Playing…`.
- Sillon : une recherche passe par l'appareil (`window.tentacle.invoke('client_fetch_log', {})` montre l'hôte, 200) ; un titre « direct » joue par `http://127.0.0.1:<port>/d/…` (`reseau.debug.directRelay` : `direct` > 0).
- Ouvrir la fiche d'un film → la sortie de l'app dit `[reseau] préchargement <id> : … Kio · … Kio`.

## Ce que le conteneur ne pouvait pas prouver (axe linux)

| Geste | Attendu |
|---|---|
| machine **x86_64** (le banc est arm64) : `pnpm dev:cef` | même déroulé ; CEF linux64 épinglé (SHA-256 6873f975…) |
| vrai GPU Intel/AMD (Mesa) | `shell.debug.layers` (console DevTools : `__shell.invoke('shell.debug.layers')`) dit `dmabuf oui (N images)` avec N qui monte : la page passe par le GPU, sans copie CPU |
| NVIDIA (pilote propriétaire) | idem ; si la page reste NOIRE : relancer avec `TENTACLE_NO_SHARED_TEXTURE=1` et le signaler (import dmabuf refusé) |
| vidéo sur vrai GPU, Wayland | pas de `gpu-sw` (réservé au banc) ; décodage `hwdec-current` vaapi ou nvdec |
| HDR (GNOME 48+ ou KDE 6, écran HDR, HDR allumé) | `video-target-params/gamma` = `pq` dans le panneau de diagnostic pendant un film HDR10 (WSI Vulkan de Mesa ≥ 25.1 ou NVIDIA récent) |
| copier un lien (bouton « Copier »), le coller dans un autre logiciel | le texte arrive ; et Ctrl+V d'une adresse de serveur dans la connexion |
| IME réel (ibus) sous Wayland et X11 | composition visible près du curseur, texte validé |
| GNOME : décorations de la fenêtre | barre de titre (libdecor) ; déplacer, agrandir, fermer |
| deux écrans d'échelles différentes, glisser la fenêtre de l'un à l'autre | la page se redessine nette à la nouvelle échelle |
| mise en veille du système pendant la lecture | refusée (inhibition logind de l'axe systeme) |
