# Changelog — Desktop (macOS + Windows + Linux)

Blocs `## [X.Y.Z]` avec `### FR` / `### EN`. Lu par `.github/workflows/desktop.yml` :
Mac App Store / TestFlight (max 4000 caractères), Microsoft Store (max 1500),
Release GitHub Linux (illimité). Une seule version pour les trois OS
(`versions.json` → `desktop`), un seul tag `desktop-vX.Y.Z`.
Variante par canal : un bloc `## [mac-X.Y.Z]` remplace le bloc nu pour App
Store Connect uniquement (`asc-release-notes.mjs`, CHANNEL=mac) — utile quand
les notes Apple doivent rester génériques.

## [Unreleased]
### FR
- …
### EN
- …

## [mac-1.16.0]
### FR
- Améliorations de la lecture et de la stabilité
- Optimisations de performance et corrections diverses
- Interface affinée dans les thèmes clair et sombre
### EN
- Playback and stability improvements
- Performance optimizations and various fixes
- Interface refinements in light and dark themes

## [1.16.0]
### FR
- Téléchargements : enregistrez un film, un épisode ou une saison entière sur l'ordinateur depuis sa fiche, en qualité Originale (fichier source) ou Allégée (1080p, 720p ou 480p, taille estimée avant lancement, sous-titres inclus)
- Mode Hors ligne : bascule automatique quand le serveur ne répond plus, retour automatique dès qu'il répond, bascule manuelle possible — catalogue local avec affiches, fiches et lecture sans aucune connexion
- Écran Téléchargements : progression en direct, pause/reprise (y compris après une coupure ou un redémarrage), suppression avec confirmation, espace occupé et espace libre, option « supprimer après visionnage »
- Lecture locale prioritaire : un contenu téléchargé est toujours lu depuis le disque, même connecté ; la position est conservée hors ligne et resynchronisée avec le serveur au retour en ligne
- Multi-comptes : chaque compte ne voit que ses téléchargements ; un même contenu téléchargé par deux comptes n'occupe l'espace qu'une seule fois
- Droits pilotés par le serveur : l'administrateur choisit qui peut télécharger et qui a droit au mode Allégé (écrit directement dans Jellyfin)
### EN
- Downloads: save a movie, an episode or a whole season to your computer from its page, as Original (source file) or Light quality (1080p, 720p or 480p, size estimated up front, subtitles included)
- Offline mode: automatic switch when the server stops responding, automatic return as soon as it responds, manual switch available — local catalog with artwork, pages and playback without any connection
- Downloads screen: live progress, pause/resume (including after a network cut or an app restart), confirmed deletion, used and free space, per-item "delete after watching" option
- Local playback first: downloaded content always plays from disk, even while online; position is kept offline and resynced with the server when back online
- Multi-account: each account only sees its own downloads; the same content downloaded by two accounts only uses disk space once
- Server-driven rights: the administrator chooses who can download and who gets Light mode (written directly into Jellyfin)

## [1.15.1]
### FR
- Thème clair refondu sur les bannières et les fiches : l'affiche reste vive (plus de voile nacré ni de flou), le texte posé sur l'image est blanc dans les deux thèmes, sur un dégradé sombre lisible même quand l'affiche est claire
- Micro-interactions raffinées : boutons à ressort, pastille de navigation qui glisse entre les onglets, entrée en cascade de la bannière, survol des affiches avec élévation douce — « réduire les animations » respecté
- Ombres des cartes et liseré de la barre de navigation harmonisés avec le thème (fini les traits blancs et ombres noires figés en clair)
- Espacement des rangées de l'accueil resserré
### EN
- Light theme reworked on banners and detail pages: artwork stays vivid (no more pearly veil or blur), on-image text is white in both themes, over a dark gradient that stays readable even on bright posters
- Refined micro-interactions: springy buttons, navigation pill sliding between tabs, cascading banner entrance, soft card hover lift — "reduce motion" honored
- Card shadows and navigation bar border aligned with the theme (no more fixed white lines and black shadows in light mode)
- Tighter spacing between home rows

## [1.15.0]
### FR
- Thème clair, sombre ou automatique : l'application suit le réglage de votre système en direct, sur Windows comme sur macOS — choix dans Réglages, section Apparence
- Réglages repensés en navigation latérale (Apparence, Sécurité, Lecture) : mot de passe, appareils jumelés et changement de serveur sont enfin regroupés dans Sécurité
- Administration repensée sur le même modèle : chaque section accessible d'un clic, sans défilement, avec sa propre icône — et sans les boutons redondants
- Bannières d'accueil et fiches : en thème clair, un flou progressif remplace les voiles — l'affiche garde ses couleurs, le texte reste lisible
- Effet Liquid Glass activable dans Apparence : réfraction sur les surfaces translucides, repli automatique sur l'effet verre classique quand le moteur ne le permet pas
- Les plugins suivent désormais le thème de l'application, clair compris
- Barre de navigation modernisée : état actif en pastille sobre, navigation au clavier visible
- Confirmations : plus aucune boîte de dialogue système muette sur macOS
- Notifications de mise à jour : correction d'un enchaînement qui pouvait laisser macOS et Windows sans annonce alors qu'une version était disponible
- macOS : « Ouvrir l'App Store » ouvre réellement la fiche Tentacle TV — le lien vers le store était bloqué silencieusement par la liste d'autorisations d'ouverture d'URL
- macOS : la notification de mise à jour n'apparaît plus avant que la version soit réellement en ligne sur l'App Store
### EN
- Light, dark or automatic theme: the app follows your system setting live, on Windows and macOS alike — pick yours in Settings, Appearance section
- Settings redesigned with side navigation (Appearance, Security, Playback): password, paired devices and server switching are finally grouped under Security
- Administration redesigned on the same model: every section one click away, no scrolling, each with its own icon — and without the redundant buttons
- Home banners and detail pages: in light theme, a progressive blur replaces the veils — artwork keeps its colors, text stays readable
- Liquid Glass effect available in Appearance: refraction on translucent surfaces, automatic fallback to the classic glass effect when the engine cannot render it
- Plugins now follow the app theme, light included
- Modernized navigation bar: sober pill active state, visible keyboard navigation
- Confirmations: no more silent system dialogs on macOS
- Update notifications: fixed a sequence that could leave macOS and Windows unannounced while a version was available
- macOS: "Open the App Store" really opens the Tentacle TV page — the store link was silently blocked by the URL-opening allowlist
- macOS: the update notification no longer shows before the version is actually live on the App Store

## [1.13.1]
### FR
- Corrections mineures de l'interface

### EN
- Minor UI bug fixes

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
