# Changelog — Desktop (macOS + Windows + Linux)

Blocs `## [X.Y.Z]` avec `### FR` / `### EN`. Lu par `.github/workflows/desktop.yml` :
Mac App Store / TestFlight (max 4000 caractères), Microsoft Store (max 1500),
Release GitHub Linux (illimité). Une seule version pour les trois OS
(`versions.json` → `desktop`), un seul tag `desktop-vX.Y.Z`.

## [Unreleased]
### FR
- …
### EN
- …

## [1.13.0]
### FR
- Lecture : les sous-titres s'affichent de nouveau pendant le transcodage, avec leur mise en forme complète (identique à la lecture directe)
- Watch Together : le chat ne disparaît plus pendant qu'on l'utilise — survol, saisie, émojis en rafale, défilement des GIFs et redimensionnement le gardent visible ; sans interaction, il s'estompe avec les contrôles comme avant
- macOS : « Ouvrir l'App Store » ouvre désormais la fiche Tentacle TV sans fermer l'application — cliquez sur « Mettre à jour » dans l'App Store, il s'occupe du reste
- Windows : les nouveautés s'affichent enfin dans la fenêtre de mise à jour, comme sur macOS et Linux
- La fenêtre de mise à jour suit le thème de l'application (bouton principal blanc)
- Les descriptions de films, séries et épisodes interprètent leur mise en forme (gras, italique, retours à la ligne) au lieu d'afficher le code brut
- Bannière d'accueil : bouton « Reprendre S2 · E5 » compact (numéro de saison/épisode sur le bouton, plus de titre d'épisode qui déborde) — harmonisé sur toutes les fiches
### EN
- Playback: subtitles show up again while transcoding, with their full styling (identical to direct play)
- Watch Together: the chat no longer vanishes while you're using it — hovering, typing, rapid-fire emojis, GIF scrolling and resizing keep it visible; when idle it still fades with the controls
- macOS: "Open the App Store" now opens the Tentacle TV page without closing the app — click "Update" in the App Store and it handles the rest
- Windows: release notes finally show in the update window, just like on macOS and Linux
- The update window follows the app theme (white primary button)
- Movie, series and episode descriptions render their formatting (bold, italics, line breaks) instead of showing raw markup
- Home banner: compact "Resume S2 · E5" button (season/episode number on the button, no more overflowing episode title) — harmonized across all detail pages

## [1.12.2]
### FR
- Watch Together : nouveau sélecteur de réactions dans le chat — ~470 emojis en 8 catégories, envoi en un clic, spam bienvenu (le sélecteur reste ouvert)
- Watch Together : GIFs dans le chat (recherche + tendances, propulsés par KLIPY) — un clic et le GIF s'anime à l'écran pour tout le groupe (nécessite un serveur 1.6.0+)
- Watch Together : panneau de chat redimensionnable (poignée en haut à gauche, taille mémorisée)
- Windows : correction d'un gel de l'application pendant la lecture (interblocage du moteur vidéo)
- À propos : la version affichée pouvait rester bloquée sur un numéro antérieur (Windows et développement) — corrigé
### EN
- Watch Together: new reaction picker in the chat — ~470 emojis across 8 categories, one-click send, spam-friendly (the picker stays open)
- Watch Together: GIFs in the chat (search + trending, powered by KLIPY) — one click and the GIF animates on screen for the whole group (requires a 1.6.0+ server)
- Watch Together: resizable chat panel (top-left handle, size remembered)
- Windows: fixed an application freeze during playback (video engine deadlock)
- About: the displayed version could stay stuck on an older number (Windows and development builds) — fixed

## [1.12.1]
### FR
- Watch Together : correction du démarrage de l'épisode suivant à ~1/3 au lieu du début (la position de reprise du premier épisode ne fuit plus vers les suivants)
### EN
- Watch Together: fixed the next episode starting at ~1/3 instead of the beginning (the first episode's resume position no longer leaks into subsequent episodes)

## [1.12.0]
### FR
- Versions unifiées : macOS, Windows et Linux partagent désormais le même numéro de version et sortent ensemble
### EN
- Unified versions: macOS, Windows and Linux now share the same version number and ship together

---
