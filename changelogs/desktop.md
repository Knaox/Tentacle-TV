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

## [1.17.0]
### FR
- Nouvelle interface : bannière d'accueil retravaillée, affiches au liseré lumineux et halo qui suit le curseur
- Aperçu au survol des épisodes : la vignette déplie sous elle un volet avec lecture, résumé, note, durée, qualité et progression
- Le bouton Lecture d'une série lance directement l'épisode à reprendre, ou le premier si vous la commencez
- Ouverture d'une fiche animée : l'affiche cliquée rejoint sa place sur la fiche, qui se charge par anticipation dès le survol
- Fiche média revue : le visuel d'un épisode s'affiche enfin au bon format, actions plus lisibles, et la page s'ouvre sur la bannière au lieu de sauter à la liste des épisodes
- Filtres de bibliothèque en menus déroulants (tri, genres cherchables, année, note, plateformes) : la grille reste visible pendant le filtrage
- Bannière encadrée : ses couleurs débordent du cadre en un halo qui suit l'image et son zoom, sur l'accueil comme sur la fiche média
- Survol des épisodes : plus de à-coup à l'ouverture de l'aperçu, qui prolonge désormais la vignette au lieu de s'y superposer
- L'aperçu s'ouvre sur toutes les cartes : quand la place manque en bas, ou quand la carte touche le bord de la rangée, les informations se posent sur la carte elle-même en voile translucide plutôt que de déborder
- L'aperçu suit sa carte quand vous faites défiler la page au lieu de disparaître, et retrouve son déroulé complet dès qu'il y a de nouveau la place
- Les rangées se calent sur des cartes entières : plus de carte coupée en deux au bord du carrousel
- Ouverture d'une fiche : le visuel garde son format pendant tout le trajet, et la bannière d'accueil ouvre la fiche avec la même animation que les cartes
- Transitions raccourcies dans toute l'application : l'ouverture d'une fiche passe de 0,7 à 0,45 s, et les textes apparaissent d'une même cascade sur toutes les pages
- La fiche média s'ouvre toujours en haut, sur sa bannière, et la bande noire qui masquait l'affiche sous le titre a disparu
- Halo lumineux également sur la bannière des bibliothèques
- Tri « Derniers ajouts » : il listait en fait les plus anciens ajouts — chaque tri part désormais dans son sens naturel
- Photo de profil sans liseré : sur un si petit disque, il rognait l'image
- Votre photo de profil reste affichée hors ligne : elle est conservée sur l'appareil et mise à jour à chaque retour en ligne
- Thème clair : dégradés de défilement des carrousels corrigés, ils viraient au noir
### EN
- New interface: reworked home banner, posters with a glowing edge and a highlight that follows the cursor
- Episode hover preview: the thumbnail unfolds a panel with playback, synopsis, rating, runtime, quality and progress
- A series' Play button now starts the episode to resume, or the first one if you are beginning it
- Animated detail opening: the poster you clicked travels to its place on the page, which preloads on hover
- Revised media page: an episode's artwork finally uses the right format, clearer actions, and the page opens on the banner instead of jumping to the episode list
- Library filters as dropdown menus (sort, searchable genres, year, rating, platforms): the grid stays visible while filtering
- Framed banner: its colours spill out of the frame as a glow that follows the artwork and its zoom, on the home page and the media page alike
- Episode hover: no more jolt when the preview opens — it now continues the thumbnail instead of stacking on top of it
- The preview opens on every card: when there is no room below, or when the card touches the edge of the row, the information settles onto the card itself as a translucent veil rather than spilling out
- The preview follows its card as you scroll instead of vanishing, and regains its full unfold as soon as there is room again
- Rows settle on whole cards: no more card cut in half at the edge of the carousel
- Opening a media page: the artwork keeps its shape for the whole journey, and the home banner opens the page with the same animation as the cards
- Shorter transitions throughout: opening a media page goes from 0.7 s to 0.45 s, and text now appears with the same cascade on every page
- The media page always opens at the top, on its banner, and the black band that hid the artwork under the title is gone
- Glow effect on the library banner too
- "Recently added" sort: it actually listed the oldest additions — every sort now starts in its natural direction
- Profile picture without its outline: on such a small disc it was cropping the image
- Your profile picture stays visible offline: it is kept on the device and refreshed every time you come back online
- Light theme: carousel scroll gradients fixed, they turned black

## [mac-1.17.0]
### FR
- Nouvelle interface : bannière encadrée dont les couleurs débordent en un halo qui suit l'image, affiches au liseré lumineux, halo qui suit le curseur
- Aperçu au survol des épisodes : la vignette déplie un volet avec lecture, résumé, note, durée, qualité et progression — sans à-coup, sur toutes les cartes (celles du bord de rangée s'y calent, celles du bas de l'écran déplient vers le haut), et il suit sa carte quand vous faites défiler la page
- Les rangées se calent sur des cartes entières : plus de carte coupée en deux au bord du carrousel
- Ouverture d'une fiche animée : le visuel cliqué rejoint sa place sur la fiche en gardant son format, la bannière d'accueil comprise, et la page s'ouvre en haut
- Fiche média revue : le visuel d'un épisode s'affiche au bon format, actions plus lisibles
- Filtres de bibliothèque en menus déroulants (tri, genres cherchables, année, note, plateformes) : la grille reste visible pendant le filtrage
- Le bouton Lecture d'une série lance directement l'épisode à reprendre, ou le premier si vous la commencez
- Votre photo de profil reste affichée hors ligne, mise à jour à chaque retour en ligne
- Lecture hors ligne : aucune donnée réseau consommée pendant la lecture — fiche, chapitres, « passer l'intro » / « passer le générique », préférences de langues et épisode suivant fonctionnent de bout en bout
- Sélecteur d'épisodes du lecteur disponible hors ligne, groupé par saison
- Préférences de langues et langue de l'interface modifiables hors ligne : enregistrées localement puis synchronisées au retour en ligne, sans écrasement
- La progression vue hors ligne est envoyée à Jellyfin dès le retour en ligne (reprise à jour sur vos autres appareils)
- Chat de groupe (Watch Together) : les contrôles du lecteur ne restent plus bloqués à l'écran après avoir écrit un message
- Thème clair : dégradés de défilement des carrousels corrigés, ils viraient au noir
### EN
- New interface: framed banner whose colours spill out as a glow that follows the artwork, posters with a glowing edge and a highlight that follows the cursor
- Episode hover preview: the thumbnail unfolds a panel with playback, synopsis, rating, runtime, quality and progress — without a jolt, on every card (those at the edge of a row line up against it, those near the bottom unfold upwards), and it follows its card as you scroll
- Rows settle on whole cards: no more card cut in half at the edge of the carousel
- Animated page opening: the artwork you clicked travels to its place keeping its shape, home banner included, and the page opens at the top
- Revised media page: an episode's artwork uses the right format, clearer actions
- Library filters as dropdown menus (sort, searchable genres, year, rating, platforms): the grid stays visible while filtering
- A series' Play button starts the episode to resume, or the first one if you are beginning it
- Your profile picture stays visible offline, refreshed every time you come back online
- Offline playback: no network data used during playback — details, chapters, "skip intro" / "skip credits", language preferences and next episode all work end to end
- In-player episode picker available offline, grouped by season
- Language preferences and interface language editable offline: saved locally, then synced once back online, with no overwrite
- Progress watched offline is sent to Jellyfin as soon as you are back online (up-to-date resume on your other devices)
- Group chat (Watch Together): player controls no longer stay stuck on screen after typing a message
- Light theme: carousel scroll gradients fixed, they turned black

## [1.16.2]
### FR
- Chat de groupe (Watch Together) : les contrôles du lecteur ne restent plus bloqués à l'écran après avoir écrit un message ou cliqué dans le chat — ils s'estompent dès que vous ne touchez plus à rien et reviennent en tapant ou en bougeant la souris
- Lecture d'un fichier téléchargé : zéro donnée réseau consommée pendant la lecture, même en ligne — fiche, chapitres, « passer l'intro » / « passer le générique », préférences de langues et épisode suivant fonctionnent entièrement depuis le disque (le sélecteur d'épisodes, ouvert volontairement, affiche toute la série quand vous êtes en ligne)
- « Passer l'intro » et « passer le générique » fonctionnent désormais hors ligne sur les contenus téléchargés (enregistrés au téléchargement, récupérés automatiquement pour les téléchargements existants)
- Sélecteur d'épisodes du lecteur disponible hors ligne : il liste les épisodes téléchargés de la série, groupés par saison
- Préférences de langues et langue de l'interface entièrement consultables et modifiables hors ligne : enregistrées localement puis synchronisées automatiquement au retour en ligne, sans écrasement
- Suppression après visionnage : choisissez un délai (immédiatement, 1 h, 6 h, 12 h ou 24 h) ; le téléchargement affiche quand il sera supprimé, et la suppression a lieu même si l'application était fermée à l'échéance
- La progression d'un fichier lu localement est envoyée à Jellyfin en fin de lecture (reprise à jour sur vos autres appareils)
### EN
- Group chat (Watch Together): player controls no longer stay stuck on screen after typing a message or clicking in the chat — they fade as soon as you stop interacting and come back when you type or move the mouse
- Playing a downloaded file: zero network data used during playback, even while online — details, chapters, "skip intro" / "skip credits", language preferences and next episode all work entirely from disk (the episode picker, opened deliberately, shows the full series while you are online)
- "Skip intro" and "skip credits" now work offline on downloaded content (saved at download time, fetched automatically for existing downloads)
- In-player episode picker available offline: it lists the downloaded episodes of the series, grouped by season
- Language preferences and interface language fully viewable and editable offline: saved locally, then synced automatically once back online, with no overwrite
- Delete after watching: pick a delay (immediately, 1 h, 6 h, 12 h or 24 h); the download shows when it will be removed, and deletion happens even if the app was closed when the time came
- Progress of a locally played file is sent to Jellyfin at the end of playback (up-to-date resume on your other devices)

## [1.16.1]
### FR
- Coupure de connexion détectée en quelques secondes : l'application réagit immédiatement au lieu d'attendre
- La lecture démarre sans délai quand le serveur est injoignable
- Fiabilité du mode hors ligne renforcée et corrections diverses
### EN
- Connection loss now detected within seconds: the app reacts immediately instead of waiting
- Playback starts without delay when the server is unreachable
- Improved offline mode reliability and various fixes

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
- Catalogue hors ligne organisé par saison, avec page dédiée : bannière, résumé et épisodes triés par numéro
- Hors ligne comme en ligne : aperçus de la barre de progression, affiche au chargement, sous-titres, menu des langues lisible et préférences de langues appliquées
### EN
- Downloads: save a movie, an episode or a whole season to your computer from its page, as Original (source file) or Light quality (1080p, 720p or 480p, size estimated up front, subtitles included)
- Offline mode: automatic switch when the server stops responding, automatic return as soon as it responds, manual switch available — local catalog with artwork, pages and playback without any connection
- Downloads screen: live progress, pause/resume (including after a network cut or an app restart), confirmed deletion, used and free space, per-item "delete after watching" option
- Local playback first: downloaded content always plays from disk, even while online; position is kept offline and resynced with the server when back online
- Multi-account: each account only sees its own downloads; the same content downloaded by two accounts only uses disk space once
- Server-driven rights: the administrator chooses who can download and who gets Light mode (written directly into Jellyfin)
- Offline catalog organized by season, with a dedicated page: banner, summary and episodes sorted by number
- Offline as online: seek bar previews, loading artwork, subtitles, readable language menu and language preferences applied

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
