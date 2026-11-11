# Parité bureau Electron → Tentacle CEF — inventaire (axe `inventaire`, 04/11/2026)

**Rien n'est porté** : décision de Damien, porte RAM (axe `ram`). Ce document dit ce que le bureau
Electron 1.42.0 offre au front, ce que le proto CEF fait déjà, ce qui manque, où le porter, à quel
coût et avec quel effet attendu sur la RAM.

Sources lues (copie `git archive dev`, `7434d90f` = release desktop 1.42.0, dans
`~/.cache/tentacle-cef/inventaire/tv-dev`) : `apps/desktop-electron/src/{preload,main}` (≈ 33 500 l.
hors tests), `apps/web/src/desktop/*` et tous les appels `invoke(…)` du front ; côté proto,
`web/shim/tentacle-bridge.js`, `src/bridge/`, `src/music/`, `src/shell/input.cpp`.

Coût : **S** ≤ 1 jour, **M** 2–5 jours, **L** > 1 semaine (natif + bancs + trois OS à terme).
RAM : effet attendu sur l'empreinte au repos (`docs/MESURES-ELECTRON-CEF.md`), **non mesuré** ici.

## 1. Le fait qui commande tout : l'origine de la page

| | Electron 1.42.0 | Proto CEF |
|---|---|---|
| Front chargé depuis | `tentacle://app` (build web **embarqué**, `TENTACLE_SHELL=electron`, version `desktop`) | l'URL du serveur (`--url=http://127.0.0.1:3471`), build web **du serveur**, version `server` |
| `localStorage` (jeton `tentacle_token`, réglages) | origine `tentacle://app`, dans `userData` = dossier de l'ex-app Tauri | origine du serveur, dans le profil CEF |
| CSP | posée par le principal (`csp.ts`, empreintes des scripts inline) | celle du serveur |
| CORS vers Jellyfin | impossible depuis `tentacle://app` → relais natifs `jellyfin_*` | origine HTTP ordinaire (comme Tauri) : relais sans doute inutiles — **à vérifier sur le banc** |
| Serveur injoignable | l'app démarre (front local) et passe hors ligne | **la page ne charge pas du tout** |

Conséquences :
1. **Le hors ligne exige d'abord un front local** : servir le build web embarqué sous un schéma à
   nous (`CefSchemeHandlerFactory` pour `tentacle://app`, comme `main/appProtocol.ts`). Le front sait
   déjà vivre ainsi (c'est le build Electron). Avec lui reviennent les besoins propres à cette
   origine : CSP (`csp.ts`), `plugin_document_set`, relais `jellyfin_*`, `tentacle://local` et
   `tentacle://art`. Effet de bord utile : version et canal (`__DIST_CHANNEL__=appstore`) redeviennent
   ceux de l'app, ce dont l'axe `maj` a besoin (`supportsAppUpdates()` est vrai sur un build appstore).
2. **Passer d'Electron à CEF déconnecte tout le monde** tant que rien ne reprend le `localStorage` de
   `tentacle://app` (LevelDB de Chromium dans `~/Library/Application Support/com.tentacle.media/`).
   Electron a fait la même chose pour Tauri (`ipc/migration.ts` : dump rendu UNE fois, en synchrone,
   avant le premier script, sans écraser une clé présente). À reproduire : lecture du LevelDB au
   premier lancement (ou export par une dernière version d'Electron), puis injection par
   `registerInjectedScript` avant la page. Les **téléchargements** (`tentacle-local.db` + médias) se
   reprennent tels quels si le moteur CEF garde le même schéma SQLite et le même dossier.

## 2. Surface `window.tentacle` (preload) — propriétés

| Propriété | Electron | CEF aujourd'hui | Manque / remarque |
|---|---|---|---|
| `invoke`, `on` (liste fermée) | `channels.ts` (83 commandes + 4 canaux hors liste, 10 évènements) | ✅ générique, liste = ce que le natif déclare | — |
| `version`, `platform`, `capabilities` | args de fabrication | ✅ (`ShimConfig`) | `version` à aligner sur celle de l'app |
| `titleBarHeight` | 38 pt sur macOS (barre masquée, feux placés, `macosTitleBar.ts`) | 0 (barre standard) | choix de design ; M si on veut l'aspect Electron |
| `openExternal(url)` | `tentacle:open-external`, liste blanche http/https/mailto/macappstore/itms-apps/ms-windows-store | ✅ http/https seulement (`window_channels.cpp`) | **S** : ajouter `macappstore:`/`itms-apps:` (mise à jour App Store, axe `maj`) et `mailto:` |
| `pickFolder()` | `dialog.showOpenDialog` | rend `null` | S (NSOpenPanel), lié aux téléchargements |
| `relaunch()` | `app.relaunch` | rejet | S ; sert à Linux et à la fin d'une MAJ MSIX |
| `liquidGlass` | macOS 26, `NSGlassEffectView` par koffi | absent (option cachée) | voir § 3 |
| `windowFocus` | focus/blur relayés (macOS) | absent (repli `document.hasFocus()`) | S |
| `montage`, `fenetrage` | Linux | ✅ (cef-parite) : `wayland`+`libre` sous Wayland (la vidéo, sous-surface, suit la fenêtre : jamais le plein écran forcé), `x11` sous X11 | `src/platform/linux/graphics_session.h` |
| restauration synchrone du `localStorage` | `migration-take` (Tauri) | `tentacle_server_url` posé par le shim | voir § 1.2 |

## 3. Commandes et fonctions, par domaine

Statut front : **G** = gardé par une capacité (absent = section cachée, rien ne casse) ; **!** =
appelé sans garde ou indispensable.

| Domaine | Commandes / mécanisme Electron | Front | CEF aujourd'hui | Module CEF qui le porterait | Coût | RAM attendue |
|---|---|---|---|---|---|---|
| **Front local + CSP** | `appProtocol.ts` (`tentacle://app`, repli SPA, anti-traversée), `csp.ts` | ! (hors ligne) | ❌ (URL serveur) | `src/shell/` : `CefSchemeHandlerFactory` + build web embarqué dans `Resources/web` | M | ≈ 0 (fichiers servis à la demande) ; paquet +≈ 10 Mo (build web : 10 Mo mesuré) |
| **Migration de session** | `ipc/migration.ts`, preload `restoreLocalStorage` | ! | ❌ | `src/app/` (1er lancement) + script injecté | M | nul après le 1er lancement |
| **Instance unique** | `requestSingleInstanceLock`, `second-instance` | ! | ❌ (deux lancements = deux profils qui se battent) | `src/platform/<os>/app*` (macOS : un seul par bundle via LaunchServices ; `open -n` à refuser) ; CEF : profil verrouillé | S | nul |
| **Hors ligne — session** | `session_cache_get/set/clear`, `avatar_cache_put/get` (SQLite + fichiers) | G | ❌ | `src/offline/` (nouveau) : SQLite système (`libsqlite3` de macOS) | S | ≈ 1–2 Mo (sqlite) |
| **Hors ligne — moteur** | `downloads_engine_start`, `enqueue`, `pause`, `resume`, `cancel`, `delete`, `list`, `state_for_item`, `set_auto_delete` ; évènements `downloads://progress`, `downloads://changed`. Cœur = copie de `packages/offline-core/src/{core,node}` (≈ 6 400 l. TS) : `.part` à écritures positionnelles, reprise `Range`, 3 transferts musique en parallèle, persistance toutes les 4 Mio / 700 ms | G | ❌ | `src/offline/` en C++ : réseau par `CefURLRequest` (pile Chromium déjà chargée, proxy et certificats système) ou `NSURLSession` ; **ne pas embarquer Node** | L | Electron le fait tourner dans son processus principal Node (déjà payé). En C++ : quelques Mo + tampons ; c'est le poste où CEF peut **gagner** sur Electron |
| **Hors ligne — stockage** | `downloads_get_root/set_root/disk_free/disk_usage/asset_base`, `background_get/set`, `pick-folder` | G | ❌ | `src/offline/` | S | nul |
| **Hors ligne — lecture locale** | `downloads_local_source`, `playback_set/restart`, `reports_pending/mark_synced`, `purge_due` ; `tentacle://local/…` (`localAssets.ts`, jeton fictif `local`) | G | ❌ | `src/offline/` + schéma `tentacle://local` ; mpv lit le fichier | M | nul |
| **Hors ligne — musique gardée** | `downloads_music_enqueue/remove/collections/list` ; `ipc/audioKept.ts` | G | ❌ | `src/offline/` + `src/music/` | M | nul |
| **Fenêtre fermée, transferts qui finissent** | `backgroundTransfers.ts`, `backgroundDrain.ts` (processus vivant sans fenêtre, contrôle toutes les 5 s, 10 min d'inactivité), `quitGuard.ts` (dialogue « quitter quand même ? »), notification système (`Notification`, la SEULE de l'app) | G | ❌ | `src/app/` (fermer le navigateur CEF mais garder la boucle) + `src/platform/macos/` (`NSAlert`, `UNUserNotificationCenter`) | M | **gain** : fenêtre fermée = navigateur CEF détruit → seuls le principal et le GPU restent ; à mesurer |
| Pochettes Octave | `tentacle://art/?o=&u=` (`octaveArt/`, cache disque) | ! si front local | ❌ (inutile avec l'URL serveur) | `src/shell/` (schéma) | S | nul |
| **Lecteur vidéo** | `mpv_init/command/set_property/get_property/destroy` ; `mpv://event`, `mpv://property-change` | G | ✅ (pont, HDR/EDR prouvés) | `src/bridge/` | — | — |
| Lecteur — annexes | `mpv_prewarm` (Linux), `mpv_harden_child_window`, `player_surface_transparent` (Windows), `media_warm` (tête/fin du MKV), `video_surface_probe`, `video_edr_probe` (dev) | G | `player_surface_transparent` ✅ (vide) ; `mpv_prewarm` ✅ sous-surface Wayland (`src/bridge/video_prewarm.h` : instance mince née au REPOS de la page, reprise par `mpv_init` aux mêmes options, recyclée après chaque lecture ; pas de parking de l'instance chaude) — première image 0,83 s → 0,18 s, +79 Mio de VRAM garée (`bench/lecteur/depart.mjs`) | `src/bridge/` | S chacun | `media_warm` : quelques Mo de cache HTTP |
| HDR de l'écran | `display_hdr_state`, `display_hdr_auto` (bascule HDR **Windows**, EDID Linux ; rien sur macOS) | G (Windows) | ❌ | `src/platform/windows/` | M | nul |
| **Plein écran** | `toggle_fullscreen`, `player_fullscreen_enter/leave`, `window://fullscreen` | ! | ✅ | `src/bridge/window_channels.cpp` | — | — |
| **Veille empêchée** | `prevent_display_sleep_start/stop` (`powerSaveBlocker`) ; `prevent-app-suspension` pendant les transferts ; `systemd-inhibit` (Linux) | ! (appel non gardé, erreurs avalées) | ✅ écran (`SDL_DisableScreenSaver`) | + assertion « app » pendant les transferts (`IOPMAssertionCreateWithName`) avec le moteur | S | nul |
| **Octave** | `audio_engine_start/stop`, `audio_play`, `audio_set_next`, `audio_swap_source`, `audio_control`, `audio_list_outputs`, `audio_set_output`, `audio_level` ; `audio://event` | G | ✅ (`src/music/`) | — | — | GPU +24 % en musique (axe `ram`) |
| **Touches média** | `globalShortcut` MediaPlayPause/Stop/Next/Previous → `smtc-button` ; `smtc_init/clear` ; `smtc_set_playback/metadata`, `set_audio_session_name` **sans effet** | G (Windows seulement, `useSmtc`) | ❌ | `src/platform/macos/` : `MPRemoteCommandCenter` + `MPNowPlayingInfoCenter` (mieux qu'Electron, qui n'a ni l'un ni l'autre) | M | ≈ 0 |
| Notifications | une seule (transferts en arrière-plan) | — | ❌ | avec « fenêtre fermée » | S | ≈ 0 |
| **Menu** | macOS : rôles (about, services, hide, quit, `editMenu`, `windowMenu`) ; ailleurs aucun | ! (Cmd+C/V/A) | ✅ Cmd+C/V/X/A/Z faits à la main (`src/shell/input.cpp:191`) ; menu d'app de SDL3 | `src/platform/macos/` si l'on veut « Services », « À propos » (`setAboutPanelOptions`) | S | nul |
| Plateau (tray), raccourcis globaux hors touches média, démarrage à l'ouverture de session, trousseau (`safeStorage`), `crashReporter`/Sentry | **absents d'Electron** | — | — | rien à porter | — | — |
| **Liens `tentacle://`** | `appLinks.ts` : `tentacle://octave/…` ≤ 8 Kio, par `open-url`, argv, `second-instance` ; `app_link_take` + évènement `app-link` ; schéma déclaré par l'Info.plist | `app_link_take` sous `isElectronShell()` seul, rejet avalé | ❌ | `src/platform/macos/app*` (`application:openURLs:`) + `CFBundleURLTypes` (axe `paquet`) | S | nul |
| **Extensions (greffons)** | `plugin_document_set` → `tentacle://plugin/<id>` + CSP à part | ! **casse sous CEF** (§ 4) | ❌ | inutile avec l'URL serveur (correctif front) ; à porter avec le front local | S | nul |
| Requêtes déléguées | `client_fetch_run/log` (`clientFetch/`, 771 l. : manifeste relu, HTTPS seul, DNS sans adresses privées, relais HTTP local 127.0.0.1 pour mpv) | G | ❌ | `src/net/` (nouveau) | M | un serveur HTTP local : ≈ 1 Mo |
| Relais Jellyfin | `jellyfin_session_post`, `jellyfin_playback_info`, `jellyfin_kill_encodings` (contournent le CORS de `tentacle://app`) | G | ❌ | inutiles tant que la page est sous l'origine du serveur ; à porter avec le front local | S | nul |
| PiP | `pip_open/mode/resize/gesture/restore/close` ; 2ᵉ `BrowserWindow` transparente ouverte par `window.open` + portail React ; fenêtre mpv reparentée (`macosPipParent.ts`) | G | ❌ | `src/shell/` (popup OSR : 2ᵉ navigateur, 2ᵉ couche) + `src/compositor/` (vidéo dans la petite fenêtre) | L | **coût** : un 2ᵉ navigateur OSR + ses IOSurface tant que le PiP est ouvert (à mesurer) |
| Liquid Glass | `tentacle:liquid-glass` (lots de régions), `liquid-glass-sample` (luminance par `screenshot-raw` de mpv), `NSGlassEffectView` sous Chromium | G (absence = option cachée) | ✅ axe verre (macOS 26, `src/glass/`) | `src/compositor/` (vues de verre entre vidéo et page) | L | GPU surtout ; RAM faible ; à mesurer |
| Focus fenêtre | `windowFocus` (macOS) | G | ❌ | `src/shell/` | S | nul |
| Mises à jour | Windows : `check_msix_update`, `download_and_install_msix_update` (WinRT `StoreContext`) ; Linux : `detect_linux_install_format`, `download_update`, `install_linux_update` (SHA-256, `pkexec`) ; macOS : **rien côté natif**, le front (build appstore) lit `updates/store-versions.json` et ouvre `macappstore://` | G | ❌ | axe `maj` (`src/update/`) | (axe `maj`) | — |
| Écran des nouveautés | entièrement dans le front (`apps/web/src/whatsNew/`, clé `tentacle_whats_new_seen`) | — | ✅ s'il a la bonne `version` | — | — | ≈ 386 Kio de JS chargés au démarrage (`NETTOYAGE-DEPS.md`) |
| Watch Together | entièrement dans le front (socket) ; rien côté principal | — | ✅ (rien à faire) | — | — | — |
| Session graphique Linux | `linux_session_get/set`, `relaunch` | G | ✅ (cef-parite) : même fichier `session-graphique.json`, `auto` = session du bureau ; `relaunch` : axe systeme | `src/platform/linux/` | — | — |
| Fenêtres | une principale (1280×800, min 900×600, **aucune mémorisation** de taille), + PiP ; fermer la fenêtre = quitter (macOS compris) | — | ✅ une fenêtre | — | — | — |
| Fin de lecture à la sortie | `quitFarewell.ts`, `playbackFarewell.ts` : à `will-quit`, pause mpv + `Sessions/Playing/Stopped` | — | ❌ (la position peut se perdre si l'on quitte en lecture) | `src/bridge/` | S | nul |
| Diagnostic | `heartbeat.ts` (dev), journal mpv dans `app.getPath("logs")`, `debug_mark` (banc de gel, **refusé même par Electron** : absent de `channels.ts`) | — | `shell.stats`, `pont.debug.*` | — | — | — |

## 4. Ce qui casse une page AUJOURD'HUI sous CEF (prouvé par lecture du code)

**Pages d'extensions (greffons) : chargeur infini.** `apps/web/src/desktop/pluginDocument.ts` ne
regarde que `isElectronShell()` (= `window.tentacle` existe — vrai sous CEF) : il appelle
`plugin_document_set`, que CEF ne déclare pas → le shim rejette `canal refuse` → le `.catch` avale →
`src` reste `null` → `PluginIframe.tsx` rend `<PluginLoader>` pour toujours.

- **Pas de bouchon CEF** : un bouchon « erreur propre » ne changerait rien, c'est déjà ce rejet qui
  bloque. Rendre un `src` reviendrait à porter la fonction (interdit avant la porte).
- **Correctif front prêt** : `docs/patches/inventaire-front-greffons-cef.patch` — la garde devient
  `isElectronShell() && capabilities.includes("plugin_document_set")` ; sans la capacité, montage
  `srcDoc` comme sur le web (la page CEF vit sous la CSP du serveur, comme un navigateur). Electron
  inchangé (il déclare la commande). `tsc --noEmit -p apps/web` vert dans la copie.
- Non reproduit en direct : le banc n'a aucune extension installée et en installer une toucherait
  un banc partagé.

Tous les autres appels non servis par CEF sont soit gardés par une capacité, soit appelés avec un
`.catch` silencieux (vérifié un à un : `offlineSession.ts`, `avatarCache.ts`, `HdrAutoToggle.tsx`,
`hdrPreference.ts`, `playerWarmup.ts`, `playbackApi.ts`, `useLocalMediaProbe.ts`,
`usePickerExits.ts`, `useForcedFullscreen.ts`, `useSmtc.ts`, `useDesktopAppLinks.ts`,
`mediaWarmup.ts`). `relaunch()` n'est appelé que sous Linux ou Windows.

## 5. Ordre de portage proposé (après le feu vert de l'axe `ram`)

1. **Socle du hors ligne** (M) : front local `tentacle://app` + CSP, instance unique, migration du
   `localStorage` d'Electron. Sans lui, rien d'hors ligne n'a de sens (page vide sans serveur).
   À mesurer tout de suite : la RAM au repos avec le front local (doit rester égale).
2. **Hors ligne, dans cet ordre** : session et avatars (S) → moteur de transferts C++ (L) → lecture
   locale + `tentacle://local` (M) → musique gardée (M) → fenêtre fermée / dialogue de sortie /
   notification (M). Reprendre le schéma SQLite de `packages/offline-core/src/core/schema.ts` tel
   quel pour relire la base d'Electron.
3. Relais qu'impose le front local : `jellyfin_*`, `plugin_document_set`, `tentacle://art` (S chacun).
4. Mises à jour (axe `maj`) ; `openExternal` élargi à `macappstore:` (S).
5. Touches média + Now Playing (M), adieu à Jellyfin à la sortie (S), liens `tentacle://octave` (S),
   focus fenêtre (S), `pickFolder`/`relaunch` (S).
6. `client_fetch` (M), `media_warm` (S).
7. PiP (L) et Liquid Glass (L) **en dernier** : ce sont les deux seuls postes qui ajoutent de la RAM
   ou du GPU par construction (2ᵉ navigateur OSR, vues de verre).
8. Windows / Linux : `display_hdr_*`, MSIX, session graphique, colle KWin, `mpv_prewarm`.

## 6. Garde-fous RAM pour le portage

- Aucun Node ni moteur JS de plus : le moteur hors ligne d'Electron est du TypeScript sans Electron
  (`core/adapters.ts`) — on le réécrit en C++, on ne l'embarque pas.
- Réseau par la pile déjà chargée (`CefURLRequest`, processus réseau de Chromium) plutôt qu'une
  deuxième pile (libcurl).
- SQLite du système (macOS), ouverture paresseuse comme `localDb.ts`.
- Tout ce qui n'existe que pendant une action (PiP, transferts, verre) naît et meurt avec elle ;
  chaque portage se mesure avec les scénarios de `bench/mesures/` avant intégration.
- Front : `NETTOYAGE-DEPS.md` § 3 mesure ≈ 1,4 Mo de JS minifié chargé au démarrage sans servir
  sous CEF (hls.js 598 Ko, une langue 423 Ko, plus l'écran des nouveautés) — gain possible sur le
  processus de rendu, à mesurer par l'axe `ram`.

## 7. Le menu de débogage — entrée × coquille (lot rf2, 11/11/2026)

Le menu (`apps/web/src/dev/`, bouton DEBUG ou F9, builds instrumentés seulement) a deux onglets :
« Actions » — chaque entrée dit ce qu'elle fait, où elle en est, et si elle PEUT agir sur cette
coquille — et « Diagnostic » (avec « Copier », pour l'envoyer en texte). L'en-tête dit quelle
coquille répond (« CEF · macOS », « Electron · Windows »…). Avant ce lot, sous CEF, quatre
bascules annonçaient un succès que la coquille refusait, et « mise à jour » ouvrait la pop-up
d'Electron (« Ouvrir l'App Store ») que CEF ne montre jamais.

**Electron** : la référence, LUE dans le code (`mpvAllowlist.ts`, `ipc/videoHdr.ts`,
`ipc/videoProbe.ts`, `useAutoUpdate.ts`). **CEF macOS** : ESSAYÉ sur l'app (CEF 156, macOS 26,
Apple Silicon, compte de test, lecture réelle). **CEF Windows** : LU dans le code seulement —
rien n'y a tourné ; les cas sont dans `A-TESTER-WINDOWS.md`.

| Entrée (touche) | Electron — référence | CEF macOS — essayé | CEF Windows — lu |
|---|---|---|---|
| Lecteur mpv coupé (M) | bascule la page sur le lecteur web, même en lecture ; persiste | ✅ état relu ; en lecture, la page démonte mpv ; rallumé ensuite | même code de page ; attendu identique |
| Simuler mpv en panne (X) | indisponible, et le dit : Electron n'a pas `mpv_debug_fail` | ✅ avec la commande de l'axe lecture (`mpv_debug_fail`, `bridge/mpv_fault.h`) appliquée le temps de l'essai : « Chute en lecture » fait tomber la lecture (`[pont] lecture mise en echec`, bandeau « Lecteur de secours ») ; « Init refusée », « Init muette », « Ouverture en échec » restent posées (état « panne : load », gardé au rechargement) ; « Lever la panne » → mpv rejoue. Sans cette commande dans la coquille : grisée | même commande, même code de pont (portable) : attendu identique |
| Décodage matériel (D) | en direct (`hwdec`, accepté par `mpvAllowlist.ts`) | ✅ réglage de l'appareil, pris à la lecture suivante ; l'état lit `hwdec-current` (« videotoolbox ») | réglage de l'appareil : `hwdec` est une option d'INIT acceptée (`mpv_policy.cpp`) ; l'écriture en direct est refusée, comme sur macOS |
| Transmission HDR autorisée (H) | `display_hdr_auto` ; Windows bascule l'écran | ✅ préférence notée et relue ; « sans interrupteur » (macOS n'en a pas) | `display_hdr_windows.cpp` (`DisplayConfigSetDeviceInfo`) : l'écran bascule à la lecture HDR suivante si autorisée — à essayer |
| Passthrough HDR (P), Tone-mapping (T), Gamut cible (G) | en direct | indisponibles, raison affichée : la coquille tient la chaîne couleur (`mpv_policy.cpp` refuse ces écritures) | indisponibles, même politique (code portable) |
| Image affichée (I) | lit `target-prim`, `target-trc`, `target-peak` | ✅ « auto / auto / pic auto · passthrough yes » en lecture ; « aucune lecture en cours » sinon | lecture seule (`mpv_get_property`) : attendu identique |
| Capturer la surface (C) | macOS, développement | ✅ « IMAGE VISIBLE — 74,1 % non noirs » en lecture | indisponible, et le dit : la sonde n'est construite que sur macOS (`bridge/CMakeLists.txt`) |
| Liquid Glass (L) | macOS 26 | ✅ `data-liquid-glass` : native ↔ off | indisponible : aucun pont de verre (`glass_windows.cpp`) |
| Pop-up de mise à jour (U) | la pop-up du front (App Store, Microsoft Store, Linux) | ✅ la SURCOUCHE de la coquille : notification, prête, sécurité (voile), installation (voile), annulée, fermer — en français, front verrouillé sous le voile | la surcouche (le même script embarqué) ET, parce que `check_msix_update` y est déclaré, la pop-up du front en « Store · … » |
| Écran des nouveautés (N) | ✅ | ✅ | même code de page |
| Vider le journal réseau (R) | ✅ | ✅ « 60 requêtes effacées » | même code de page |
| Copier le diagnostic | ✅ | ✅ « copié dans le presse-papiers » | presse-papiers de Chromium, repli `execCommand` |

La démonstration de la surcouche passe par l'évènement de fenêtre `tentacle:update-demo`
(`web/shim/update-overlay-demo.js`, un fragment que CMake glisse dans la fermeture de
`update-overlay.js` au jeton `/*__UPDATE_DEMO__*/`) : un instantané FACTICE, rien n'est demandé au
natif, le vrai instantané revient à la fin. Trouvé en chemin : `<html lang>` restait « en », la
surcouche parlait anglais sur une interface en français — le front le tient maintenant à jour.

