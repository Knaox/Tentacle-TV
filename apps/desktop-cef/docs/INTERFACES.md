# Contrat entre les modules (v0 — à affiner par leurs propriétaires)

Langage : **C++20** + **Objective-C++** (`.mm`) pour macOS, **CMake + Ninja**. Le code est en
anglais, les commentaires en français. 300 lignes au plus par fichier.

Chaque module a UN propriétaire (une session du lot). Un autre module ne le modifie pas : il
demande au propriétaire (journal `INTEGRATION.md` du lot) ou propose un correctif minimal
signalé dans son rapport. Toute évolution d'une interface ci-dessous se reporte ICI, dans le
même commit.

## Arborescence et propriétaires

| Chemin | Propriétaire | Rôle |
|--------|--------------|------|
| `CMakeLists.txt`, `cmake/`, `scripts/deps/` (hors `mpv*`), `scripts/build.sh` | socle (lot 2 : paquet) | build, téléchargement de CEF/SDL3, paquet `.app` + helpers CEF ; paquet de distribution `scripts/build.sh --dist` (chaîne `deps/paquet`, CEF élagué : `docs/PAQUET.md`) |
| `src/app/` (sauf la ligne de chaque module dans `modules.cpp`), `src/shell/` | socle | boucle principale, fenêtre SDL3, hôte CEF (OSR), saisie, plomberie IPC JS ↔ natif |
| `src/compositor/`, `src/platform/<os>/compositor*`, `src/platform/<os>/app*`, `src/platform/<os>/shell*` | socle | empilement des couches : vidéo (bas) → page web (haut) ; NSApplication, pompe CEF, clavier natif |
| `tests/socle/`, `tools/cdp-eval.mjs` | socle | page de test du socle ; évaluation JS par DevTools (utilisable par tous) |
| `src/player/`, `src/platform/<os>/video_surface*`, `scripts/deps/mpv*` | vidéo-HDR | libmpv (fork), surface vidéo, HDR/EDR |
| `tools/edr-probe/`, `bench/hdr/` | vidéo-HDR | preuves HDR10 / Dolby Vision |
| `src/bridge/`, `web/shim/` (hors `octave*`) | pont | `window.tentacle` compatible avec le front de Tentacle, lecteur vidéo |
| `src/music/`, `web/shim/octave*`, `bench/music/` | octave (lot cef-parite : medias) | mode musique à l'identique d'Electron (fondu, ReplayGain, sorties…), bascule musique ↔ vidéo ; musique de test |
| `src/media_session/`, `src/platform/<os>/media_session_*` | medias | « À l'écoute » et touches média (macOS, MPRIS, SMTC), canaux `smtc_*` |
| `bench/server/` | pont | banc local Tentacle + Jellyfin jetable (copies, jamais le dépôt Tentacle) |
| `src/update/`, `src/platform/<os>/update_*`, `web/shim/update*`, `bench/update/` | maj | mise à jour automatique : manifeste signé, règle de décision, assistant de remplacement, surcouche |
| `src/pip/`, `src/compositor/`, `src/platform/macos/compositor*`, `src/platform/<os>/pip_<os>.cpp`, `src/shell/client_popup.*`, `bench/pip/` | pip (lot cef-parite) | image dans l'image : règles d'Electron, navigateur du PiP, fenêtre PiP, prêt de la vidéo |

## Interfaces natives

### Plomberie IPC (socle) — v1, livrée au Jalon 1
- Côté page : `window.__shell.invoke(channel: string, payload: any): Promise<any>` et
  `window.__shell.on(event: string, cb: (payload) => void): () => void` (renvoie le
  désabonnement). `__shell` est gelé, non énumérable, présent **avant** le premier script de
  la page, dans le **cadre principal seulement** (pas dans les iframes).
  - Rejet : `Error` avec `err.code` — `no_handler` (canal inconnu), `bad_payload` (JSON
    illisible), `handler_exception`, ou le code passé à `fail()`.
  - La charge utile passe par `JSON.stringify` : pas de `undefined`, de fonctions ni de
    binaire (base64 si besoin).
- Côté natif (`src/shell/ipc.h`, espace `tentacle::ipc`, type `tentacle::Json` =
  `nlohmann::json`, en-tête `shell/json.h`) :
  - `registerHandler(std::string channel, Handler h)` avec
    `Handler = std::function<void(const Json& payload, Responder r)>`. `r.reply(Json)` ou
    `r.fail(code, message)`, une seule fois. `Responder` est copiable et appelable plus tard,
    **depuis n'importe quel fil** (il repasse par le fil principal). Un seul gestionnaire par
    canal : réenregistrer remplace. `unregisterHandler(channel)` existe aussi.
  - `emit(std::string event, Json payload)` : vers le cadre principal de toutes les pages
    (sûr depuis n'importe quel fil). Un évènement émis avant que la page ait un contexte est
    perdu.
  - Les gestionnaires s'exécutent sur le fil principal (= fil UI de CEF). Jamais un appel
    synchrone à mpv depuis un rappel d'évènement mpv.
- `registerInjectedScript(std::string js)` : exécuté à CHAQUE création de contexte du cadre
  principal (rechargement, navigation), après l'amorce de `__shell` et avant tout script de
  la page, dans l'ordre d'enregistrement. **À appeler avant la création du navigateur**, donc
  depuis l'init du module (voir ci-dessous). C'est par là que `web/shim/` pose
  `window.tentacle`. Une exception dans un script est journalisée (`[renderer] …` sur
  stderr) et n'empêche pas les suivants.
- Noms de canaux : `<module>.<action>` (`player.load`, `tentacle.…`, `octave.…`). `shell.*`
  est réservé au socle.

### Branchement d'un module (socle)
- `src/app/modules.cpp` : chaque module ajoute UNE ligne dans `initModules(AppContext&)`
  (et dans `shutdownModules()` s'il le faut), dans l'ordre socle → pont → octave.
  `AppContext` (`src/app/app.h`) donne `window` (`SDL_Window*`), `nativeWindow` (macOS
  `NSWindow*`), `compositor`, `options` (arguments, dont `options->extra` pour les options
  `--clé=valeur` propres au module) et `fakeVideo` (la couche factice posée par défaut).
  C'est appelé sur le fil principal, après `CefInitialize` et avant la création du
  navigateur.
- Vraie surface vidéo : `createMainVideoSurface(ctx)` (= `createVideoSurface(nativeWindow)`
  de vidéo-HDR), juste avant le premier `loadfile`, puis
  `ctx.compositor->setVideoLayer(s.get())`. Pour la retirer : `restoreFakeVideo(ctx)` (remet
  l'aplat, ou rien avec `--fake-video=off`), PUIS détruire la surface.
- La fenêtre est créée cachée ; le socle appelle `prepareWindowForVideo(nativeWindow)` avant
  `SDL_ShowWindow` (l'espace de couleur sRGB posé par SDL3 est rendu à l'écran). La couche
  web porte son `colorspace` sRGB explicite.
- Build : le `CMakeLists.txt` racine fait `add_subdirectory` de `src/player` (lié au socle),
  `src/bridge` et `src/music` (construits, pas encore liés à l'app).

### Canaux fournis par le socle (`src/shell/builtin_handlers.h`)
`shell.ping`, `shell.stats` (images peintes, temps de copie, taille, échelle, fréquence),
`shell.debug.webPixel {x,y}`, `shell.debug.layers`, `shell.window.state`,
`shell.window.setFullscreen {on}`, `shell.quit`, `shell.wake` (la page réveille l'horloge d'images en veille ; posé par le script injecté `shell/frame_wake.h`, axe ram). Évènement `shell.window`
`{fullscreen,width,height,scale,refreshRate}`. Côté natif : `addWindowStateListener(cb)`
(même charge, à chaque entrée/sortie de plein écran réelle et à chaque redimensionnement) ;
plein écran natif = `SDL_SetWindowFullscreen(ctx.window, on)`. Cadre d'Electron (axe systeme,
`src/lifecycle`) : sur macOS barre de titre masquée, contenu sous toute la fenêtre, feux en (16, 13),
sans ombre — `titleBarHeight` = 38 (la page dessine la bande) ; ailleurs vrai cadre, 0.

### Lancement (socle)
`Tentacle.app/Contents/MacOS/Tentacle [--url=URL] [--devtools-port=930x]
[--profile=~/.cache/tentacle-cef/profiles/<axe>] [--frame-rate=N]
[--fake-video=RRGGBB|off|edr[:niveau]] [--size=LxH] [--background] [--debug-input] [--mute]`.
`--mute` (bancs, sessions) : aucun son, voir « Son » ; à placer avant un autre `--…` (le
parseur prendrait sinon l'argument suivant pour sa valeur).
`--fake-video=edr:4` pose une couche factice HDR (RGBA16Float linéaire étendue, 4 × le blanc
SDR) pour tester l'EDR sans mpv. `--debug-input` ouvre `shell.debug.native` (injection pour les
bancs : NSEvent pour clavier, `flags`, IME, défilement et `mouse` avec `via:'appkit'` ; souris
au niveau SDL par défaut, car SDL3 lit le vrai curseur sur macOS 26). Cadence : sur macOS,
BeginFrame externe de CEF par `CADisplayLink` (`shell/frame_clock.h`). Veille (axe ram) : sans image peinte ni saisie depuis 250 ms, le lien ralentit ; après 3 s il
est suspendu et une minuterie envoie des BeginFrame de sondage à `kDeepIdleFrameClockHz`
— `platform::setFrameClockMode(full|idle|deepIdle)` ; chaque image reçue (`ViewHost::onPaint`),
saisie ou signal de la page (`shell.wake` : rAF, mutation du DOM, animation CSS, chargement) le
remet à la fréquence de l'écran ; la sonde de veille profonde n'est plus qu'un filet (1 Hz). Les autres options `--clé=valeur` vont dans `AppOptions::extra`.
Bancs du socle : `scripts/banc-socle.sh [cas…]` (saisie, popups, IME, défilement, plein écran,
redimensionnement, 120 Hz, repos) et `scripts/banc-socle-edr.sh` (EDR sous la page).

### Saisie et raccourcis d'application (axe saisie) — `src/shell/app_menu.h`
- Menus de l'app (`platform::installAppMenu(edit)`, posés par `Shell`) : sur macOS ceux du bureau
  Electron 1.42.0 (Application, Édition, Fenêtre) ; ailleurs aucun. Les commandes d'édition vont
  au cadre CEF actif (`CefFrame::Copy`…).
- Ordre des raccourcis ⌘/⌃ (comme Chromium/Electron) : `-[TentacleApplication sendEvent:]` les
  retient (`holdKeyEquivalent`, `platform/macos/shell_menu_mac.h`), la page reçoit le keydown, et
  ce qu'elle ne consomme pas revient par `CefKeyboardHandler::OnKeyEvent` →
  `ViewHost::onUnhandledKey` → `platform::dispatchUnhandledKey` → menus.
- `ViewHost` gagne `onUnhandledKey(CefKeyEvent)` et `onDocumentFullscreen(bool)`
  (`CefDisplayHandler::OnFullscreenModeChange`). F11 est pris par `Shell` avant la page.
- `shell.debug.native` (avec `--debug-input`) : `key` accepte `repeat` et, sans `chars`, prend les
  caractères de la disposition active ; `media {key}` poste une touche média (systemDefined) ;
  `app {action: state|unhide|deminiaturize}` rend `{hidden, miniaturized, fullscreen, visible}`.
- Banc : `scripts/banc-saisie.sh [build] [cas…|connexion]` (DevTools 9314) ; tableau dans
  `docs/SAISIE.md`.

### Lecteur (vidéo-HDR) — `src/player/player.h` (cible CMake `tentacle_player`, `add_subdirectory(src/player)`)
- `Player::create(PlayerOptions{post, options, audioOnly, logFile, logLevel}, &err)` — `post` =
  `postToMain` du socle (obligatoire) : TOUS les rappels arrivent sur le fil principal.
- Tout est asynchrone (variantes `*_async` de libmpv) : `command(Json args, done)` (tableau ou
  objet nommé ; `loadfile` → `result = {"playlist_entry_id": n}`), `setProperty(name, Json, done)`,
  **`getProperty(name, cb(optional<Json>))`** (demande du pont), `observe(name, PropFormat, cb)` →
  id, `unobserve(id)`, `onEvent(cb(Json))` avec `{"event": "<nom mpv>", …}` (`start-file`/`end-file` :
  `playlist_entry_id` ; `end-file` : `reason`, `error` numériques). `done(optional<string> err, Json result)`.
- `attachVideoSurface(VideoSurface&)` (avant le 1er `loadfile`, ou à chaud : la vidéo apparaît) /
  `detachVideoSurface()` (sortie vidéo coupée, `vo=null`, la lecture continue ; la surface peut
  ensuite être détruite). Sans surface : `vo=null`, AUCUNE fenêtre de mpv, aucune couche.
- Mode musique : `audioOnly = true` → `vid=no`, `audio-display=no`, `attachVideoSurface` refusée.
- `destroy(done)` : `quit` puis libération hors du fil principal ; annule les réponses en attente.
- Imposé : `target-colorspace-hint=yes`, `vo`/`wid`/
  `gpu-context`/`moltenvk-surface-size` tenus par le lecteur (ignorés dans `options`).
- **Son** (`src/player/sound_policy.h`, lot « app CEF ») : par défaut la sortie NATIVE réelle —
  `ao=coreaudio` (macOS), `pipewire,pulse,alsa` (Linux), `wasapi` (Windows) ; un `ao` passé par
  l'appelant est gardé (bancs PCM). Volume et sourdine : ceux de la page (`volume`, `mute`), comme
  sous Electron. **Mode muet des bancs** : `--mute` (lu par `pont::install`) ou `TENTACLE_MUTE=1`
  → `ao=null` + `mute=yes` imposés après l'appelant, et toute écriture de `mute` par la page
  reste `yes`. **Sonde** `TENTACLE_SOUND_PROBE=1` (preuves du lecteur) : sortie native ouverte,
  `mute=yes` à la naissance, échantillons mis à zéro (`af=lavfi=[volume=volume=0]` ; refusé →
  `ao=null`).
  `TENTACLE_ALLOW_SOUND` n'existe plus. Tout lancement par une session ou un banc passe `--mute`.
- libmpv : `~/.cache/tentacle-cef/deps/mpv/<sha8>` — `b81be4b7` depuis le lot « app CEF » (correctifs
  `0002` : une bascule audio/sous-titres garde le cache des flux restés sélectionnés ; `0003` : une
  bascule audio en lecture ne fige plus l'image ; repli `b1b076ea` puis `b5c712f4` avec
  avertissement CMake). Le sha est reproductible (`mpv-build.sh`). (fork jellium + contexte `moltenvk`,
  `scripts/deps/mpv-build.sh`).

### Pont `window.tentacle` (pont) — `src/bridge/registry.h`
- Le front de Tentacle détecte la coquille par `window.tentacle` et n'emploie que ce que
  `window.tentacle.capabilities` annonce (`docs/etude/contrat-tentacle.md`). Le shim
  (`web/shim/tentacle-bridge.js`) est GÉNÉRIQUE : `invoke(c, a)` → `__shell.invoke("tentacle:" + c, a)`
  si `c` est déclaré, sinon rejet `canal refuse: c` ; `on(e, cb)` → `__shell.on("tentacle:" + e, cb)`
  si `e` est déclaré (charge NUE). Frame principale et origines du serveur configuré seulement.
- Tout module qui sert un canal de Tentacle (pont : `mpv_*`, plein écran… ; octave : `audio_*`,
  `audio://event`) le déclare avec SON NOM DE TENTACLE, sans préfixe :
  - `bridge::Registry reg(ipcPort)` — un seul, créé par `src/app` ;
  - `reg.command("audio_play", Handler)` → branché sur l'IPC sous `tentacle:audio_play`,
    ajouté à `capabilities` ; `reg.event("audio://event")` ; `reg.emit("audio://event", payload)`.
  - Après TOUTES les déclarations, avant le premier navigateur :
    `registerInjectedScript(reg.injectedScript(bridge::embeddedShimSource(), ShimConfig{…}))`.
- `Json` = `nlohmann::json` (3.11+, Homebrew `nlohmann-json`), proposé pour tout le proto.
- Portes du pont (`src/bridge/ports.h`), reliées par de petits adaptateurs : `IpcPort`
  (socle), `PlayerPort` (vidéo-HDR ; lecture `getProperty` ASYNCHRONE obligatoire), `WindowPort`
  (fenêtre SDL3 : plein écran demandé/rapporté, veille, lien externe).
- Rejets de `__shell.invoke` : un objet `{code, message}` (le shim en fait une `Error(message)`).
- `ShimConfig` (axe systeme) : `titleBarHeight`, `windowFocus` (macOS) et, sous Linux seulement,
  `montage` / `windowing` → `window.tentacle.montage` / `.fenetrage` (posés s'ils ont un sens).
  `openExternal`, `pickFolder`, `relaunch` passent par les canaux hors liste du cycle de vie.
- Branchement (`src/bridge/glue/pont_shell.h`, cible `tentacle_bridge_glue`, liée à `tentacle_shell`) :
  dans `src/app/modules.cpp`, `pont::install(ctx)` — le registre existe —, puis les déclarations
  d'octave (`music::installInShell(pont::registry())`, `pont::setOnVideoClaim(…)`), puis
  `pont::installShim(ctx)` EN DERNIER (capabilities figées). Le registre est `pont::registry()`.
- Lecture vidéo : une instance `Player` par `mpv_init` ; la surface (`createVideoSurface(ctx.nativeWindow)`)
  naît au PREMIER `loadfile`, plein cadre sous la page, et suit `addWindowStateListener` ; à l'arrêt,
  `setVideoLayer(ctx.fakeVideo)` puis destruction du lecteur, puis de la surface. Options de
  sortie de la page écartées ; le son suit `player/sound_policy.h` (ci-dessous).
- Annexes (medias, lot cef-parite) : `video_surface_probe` et `video_edr_probe` (macOS, build de développement
  seulement — `TENTACLE_VIDEO_PROBES`, comme Electron hors paquet) pour le panneau de dev du lecteur ;
  `VideoChannels(reg, player, clock, defer)` : la position retenue par l'étranglement part aussi par le temps.
- Diagnostic hors `window.tentacle` : canal du socle `pont.debug.surface` → `colorState()` de la
  couche vidéo (`colorspace`, `pixelFormat`, `wantsEdr`, `hasEdrMetadata`, `opaque`, `visible`,
  `pixelSize`, `window` = `{fullscreen, w, h}` : la NSWindow elle-même, `NSWindowStyleMaskFullScreen`
  — preuve du plein écran natif pour la recette), `null` sans vidéo.


### Surface vidéo (vidéo-HDR) — `src/platform/video_surface.h`
- `createVideoSurface(nsWindow)` : NOTRE `CAMetalLayer` (aucune NSView) ; le compositeur la range
  SOUS la page via `nativeLayer()` et lui donne son cadre par `setFrame(RectPt{x,y,width,height})`
  (points, origine en haut à gauche). `show()`, `hide()`, `visible()`, `backingScale()`,
  `pixelSize()`, `onPixelSizeChanged(cb)` (le `Player` s'y abonne), `mpvWid()`, `mpvGpuContext()`,
  `colorState()` (colorspace, EDR, métadonnées, et `windowFullscreen`/`windowFrame` de la fenêtre
  porteuse : preuves).
- **`prepareWindowForVideo(nsWindow)`** : à appeler AVANT la 1re mise à l'écran de la fenêtre SDL3
  (créée `SDL_WINDOW_HIDDEN`) — SDL3 la marque sRGB (constaté) ; FACULTATIF, sans effet mesuré sur l'EDR.
- **Deux chemins d'attache** (lot cef-parite, axe linux) — le lecteur choisit (`player.cpp`) :
  - `--wid` (macOS, Linux Wayland, Windows) : `mpvSizeOption()` (défaut
    `moltenvk-surface-size` ; Linux `wlhostvk-surface-size`), puis `gpu-context`, `wid`, `vo=gpu-next` ;
  - **API de rendu** (Linux : X11, ou libmpv de la distribution) : `attachRenderApi(mpv_handle*)`
    vrai → la surface a créé son `mpv_render_context` (OpenGL, contexte du compositeur) et le
    lecteur pose `vo=libmpv` ; `detachRenderApi()` après `vo=null` (et avant `mpv_terminate_destroy`).
    Défaut : `false` / rien (macOS, Windows inchangés).
- Linux (`src/platform/linux/video_*`) : `nativeWindow` est un `platform::LinuxWindow*`
  (`linux_window.h` : Wayland `wl_display`/`wl_surface`, ou X11 `Display*`/`Window`) ;
  `nativeLayer()` rend un `platform::LinuxVideoLayer*` (`video_layer_linux.h`) que le compositeur
  lit. **Wayland + notre libmpv** : `wl_subsurface` SOUS la surface de la page (désynchronisée,
  sans région de saisie, `wp_viewport` pour l'échelle), mpv y dessine par `--gpu-context=wlhostvk`
  (correctif `scripts/deps/mpv-patches-linux/0004`, `--wid` = `struct mpv_wlhost_target*`) ; HDR
  par les espaces de couleur de la WSI Vulkan. **Sinon** : API de rendu OpenGL de libmpv dans une
  texture de NOTRE contexte EGL, posée sous la page (SDR). `TENTACLE_VIDEO_RENDER_API=1` force ce
  second chemin sous Wayland.

- Par OS, ce que la sortie de mpv demande en plus (défauts = macOS, inchangé ; lot cef-parite,
  axe windows) : `mpvAttachOptions()` (posées à l'attache AVANT `vo`), `mpvSizeOption()`
  (`moltenvk-surface-size` ; Windows `d3d11-composition-size`), `wantsMpvSwapchain()` /
  `setMpvSwapchain(adresse)` : mpv crée lui-même sa chaîne d'échange (Windows, mode composition) ;
  `MpvPlayerPort` relit `display-swapchain` à chaque `file-loaded` / `video-reconfig` et la remet
  (0 : plus de sortie). `mpvWid() == 0` : aucun `wid` posé.
- **Windows** (`src/platform/windows/video_surface_windows.cpp`) : un visuel DirectComposition né
  du périphérique du PROCESSUS (`win::DcompDevice::shared()`, le même pour toutes les fenêtres),
  contenu = la chaîne de mpv (`gpu-api=d3d11`, `d3d11-output-mode=composition`,
  `target-colorspace-hint=no` à l'attache — levé par la session HDR, comme Electron).
  `nativeLayer()` = `IDCompositionVisual*`. Cadre en DIP, × `GetDpiForWindow/96` de la fenêtre
  PORTEUSE (`setHostWindow`, posée par le compositeur qui l'insère) pour les pixels. Linux : stub
  (axe linux).

### Musique (octave → medias, lot cef-parite) — `src/music/`
- **À l'identique d'Electron** (`apps/desktop-electron/src/main/audio/`, port fichier par fichier) :
  canaux `audio_engine_start`, `audio_engine_stop`, `audio_play`, `audio_set_next` (`crossfadeMs`),
  `audio_swap_source`, `audio_control` (pause, resume, stop, seek, volume, muted, replayGain, crossfade),
  `audio_list_outputs`, `audio_set_output`, `audio_level` ; évènement `audio://event` (state, advanced,
  needSource, swapped, remote). Arguments lus au schéma zod d'Electron (`audio_types.cpp`) ; capacités
  `{engine:"mpv", gapless, exclusiveOutput:true, replayGain:true, codecs, hotSwap:true}`.
- **Cibles** : `tentacle_music_core` (sans libmpv : règles, file `AudioQueue`, moteur `NativeAudioEngine`,
  transition douce `CrossfadeDecks`/`DeckPair`/`DeckFade`, canaux `OctaveChannels`), testée seule
  (`tentacle_music_{audio_queue,audio_rules,crossfade_decks,file_ends}_tests`, cas des tests d'Electron) ;
  `tentacle_music` (+ `MpvAudioBackend`, `PlayerAudioBackend` sur le `Player` audio seul, colle `octave_shell`).
- **Une instance mpv par « deck »**, audio seul, jamais de surface ; deux pendant la transition douce
  (réserve née transition allumée hors mode exclusif). Sortie native, volume et sourdine de la page ;
  sous `--mute`, `ao=null` + `mute=yes` (`player/sound_policy.h`). Préchauffage de la sortie à la naissance
  (`anullsrc` 50 ms). Saut demandé pendant l'OUVERTURE d'un fichier : différé à `playback-restart`
  (acquis du proto : mpv figeait la lecture).
- **Coutures** (`octave_shell.h`, après `installInShell`) : `setKeptLookup(fn(userId, trackKey) → chemin?)`
  (horsligne, `audioKept.ts`), `setDirectAdopter(fn(source, trackKey, session, done))` et `sourceCut(url)`
  (reseau, `directSources.ts`), `stopAudio()` (systeme : fenêtre fermée pour de bon), `observeMusic(onCall,
  onEvent)`, `remoteCommand(cmd)`, `seekFromSystem(ms)` (medias : « À l'écoute »).
- `music::videoClaim()` : une lecture vidéo démarre → la musique qui joue passe en pause + `remote: pause`.
- Diagnostic (bancs, `__shell.invoke`) : `octave.debug.log {fromCall, fromEvent}`, `octave.debug.prop {name}`,
  `octave.debug.deckProp {name, index}` (chaque instance du fondu), `octave.debug.claim`.
- Bancs : `tests/music/run-probe.sh` (faux natif, 34 vérifications), `web/shim/octave-attach.mjs` (recette
  sur l'app lancée par `pnpm dev:cef -- --mute --background --devtools-port=<port>`).

### « À l'écoute » et touches média (medias, lot cef-parite) — `src/media_session/`
- **Canaux d'Electron**, déclarés sur les trois OS : `smtc_init`, `smtc_clear`, `smtc_set_playback {status}`,
  `smtc_set_metadata {title, artist, cover}`, `set_audio_session_name {name}` ; évènement `smtc-button`
  (`toggle|play|pause|stop|next|previous`). **Propre à CEF** : `smtc_set_controls {next, previous}` — c'est la
  CAPACITÉ qui ouvre `useSmtc` hors Windows et fait envoyer au moteur d'Octave la fiche de chaque titre
  (`track.meta`, `systemMeta`) ; Electron ne la déclare pas, son comportement ne change pas.
- **Cœur portable** `Hub` (`media_session_hub.h`, testé seul : `tentacle_media_session_tests`) : deux sources
  (vidéo par le front, musique par le moteur), une session système ; montrée = celle qui joue (la plus récente
  à s'être mise à jour), sinon la dernière réclamée ; position transmise seulement sur saut (> 1,5 s) ;
  pochette téléchargée par `net::httpFetch` (8 Mio, 15 s, image reconnue), jamais l'adresse authentifiée
  confiée à l'OS.
- **Couture d'OS** `Backend` (`media_session.h`, `createBackend(host)` par OS) : macOS
  `src/platform/macos/media_session_macos.mm` (MPNowPlayingInfoCenter + MPRemoteCommandCenter, lien
  MediaPlayer) ; Linux `src/platform/linux/media_session_linux*.cpp` (MPRIS 2.2 par GDBus, fil dédié, pochette
  en copie disque 0600 ; dépendance gio-2.0) ; Windows `src/platform/windows/media_session_windows*.cpp`
  (SMTC par `ISystemMediaTransportControlsInterop`, ABI WinRT + WRL, mélangeur par IAudioSessionManager2 ;
  liens runtimeobject, ole32).
- Branchement : `media_session::install(ctx, pont::registry())` APRÈS octave, avant le shim ;
  `media_session::shutdown()` avant `music::shutdownMusic()`. Position de la vidéo : `pont::setVideoPropertyObserver`.
- Chromium ne publie plus sa propre session (`HardwareMediaKeyHandling` dans `disable-features`, `browser_app.cpp`).
- Diagnostic : `media_session.debug.state` (ce que le cœur a transmis + `os` : relu CHEZ le système),
  `media_session.debug.command {command, positionMs}` (le chemin d'une commande du système, sans le système).

### Mise à jour (maj) — `src/update/` (détail : `docs/MISE-A-JOUR.md`)
- Branchement : `maj::install(ctx)` à la FIN de `initModules` (après le shim du pont),
  `maj::shutdown()` au DÉBUT de `shutdownModules` (une mise à jour prête s'applique à la fermeture).
- Cibles : `tentacle_update_core` (pur, testé seul : `cmake -S src/update`), `tentacle_update_glue`
  (liée à `tentacle_shell`), `tentacle_update_helper` → `Contents/MacOS/tentacle-update`, posé et
  signé ad hoc APRÈS l'assemblage du paquet (cible `tentacle_update_embed`). Dépendance : libsodium
  en statique (ed25519 + SHA-256).
- Canaux (`__shell.invoke`) : `update.state`, `update.check`, `update.restart`, `update.later`,
  `update.mute`, `update.dismissNotice`, `update.openNotes` ; évènement `update.state` (instantané :
  `{enabled, current, phase, progress, prompt: none|toast|blocking, canMute, error, rolledBack, update}`).
  Hors de `window.tentacle` : le front de Tentacle n'en sait rien, la surcouche est injectée.
- Options : `--update-feed=URL`, `--update-channel=`, `--update-state-dir=` (défaut
  `<profil>/update`), `--update-first-check-ms=`. Sans flux ni clé publique compilée
  (`-DTENTACLE_UPDATE_PUBLIC_KEYS=id:base64`), le moteur est éteint : aucun accès réseau.

### Hors ligne (horsligne) — `src/offline/`
- Branchement : `offline::installInShell(pont::registry(), ctx)` dans `initModules`, AVANT
  `pont::installShim` (les commandes entrent dans `capabilities`) ; `offline::shutdown()` à la
  FIN de `shutdownModules` (le fil hors ligne est joint, la base refermée — WAL replié).
- Fil : tout le hors ligne vit sur UN fil à lui (`CefThread` « tentacle-offline »,
  `glue/offline_thread.h`) — base, disque, moteur ; jamais sur le fil de l'interface. Les
  commandes y sont postées (`glue/commands.h`), la réponse repasse par le socle.
- Données : celles d'Electron, aux mêmes formats — `<userData>/tentacle-local.db` (schéma
  `core/schema.cpp`, copie octet pour octet de `packages/offline-core/src/core/schema.ts`,
  verrouillée par `tests/schema_tests.cpp`), `<userData>/avatars/<id>.jpg`.
  `<userData>` = `tentacle::paths::userData()` (axe reseau).
- Canaux (`window.tentacle`, noms et charges d'Electron) : `session_cache_get/set/clear`,
  `avatar_cache_put/get` ; stockage `downloads_get_root/set_root/background_get/background_set/
  disk_free/disk_usage/asset_base` ; lecture `downloads_local_source/playback_set/
  playback_restart/reports_pending/reports_mark_synced/purge_due` ; `downloads_list`,
  `downloads_state_for_item`, `downloads_set_auto_delete`, `downloads_music_list`,
  `downloads_music_collections` ; moteur `downloads_engine_start/enqueue/pause/resume/cancel/
  delete`, `downloads_music_enqueue/remove`. Évènements `downloads://progress`,
  `downloads://changed`.
- Moteur (`core/engine.h`, coroutines C++20 sur le fil hors ligne, `core/task.h`) : flux du média
  par CefURLRequest créé SUR le fil hors ligne (`glue/cef_transfer_net.cpp` : ni cache, ni cookies,
  ni relance d'un 5xx), petites ressources et DELETE par `net::httpFetch` (axe reseau).
- Cycle de vie (axe systeme) : `lifecycle::setTransfersProbe` (compteurs atomiques tenus par le
  fil hors ligne : la fermeture ne touche ni le moteur ni la base), `keepSystemAwake` à chaque
  bascule occupé / attente du serveur, `onSystemResume` → reprise des pauses système.
- Pour Octave (axe medias) : `offline::keptAudioPath(userId, trackKey, done)`
  (`glue/kept_audio.h`, `done` sur le fil principal) — le chemin de la copie gardée, ou rien ;
  sa variante synchrone bornée (500 ms) est posée par `installInShell` dans la couture
  `music::setKeptLookup` (appelée par `audio_play` avec `kept`).
- `tentacle://local/<media|meta>/…` : affiches, JSON, planches, sous-titres (liste FERMÉE de
  `localAssets.ts`), lus sur le fil hors ligne ; jeton fictif `local` ; CSP de l'application
  (`appscheme::appCsp()`) sur chaque réponse, comme Electron.
- Compatibilité prouvée par `bench/offline/compat.sh <tentacle_offline_compat>` : le cœur
  TypeScript d'Electron (exécuté par Node) et le C++ jouent `scenario.json`, chacun relit la base
  de l'autre — sorties de la page, lignes et schéma identiques.
- CMake : `tentacle_offline_core` (pur : SQLite, fichiers, JSON — testé seul,
  `cmake -S src/offline`), `tentacle_offline_glue` (CEF). SQLite : celui du système (macOS,
  Linux), amalgamation 3.46.1 épinglée (SHA-256) sous Windows (`src/offline/sqlite.cmake`).
### Popups de la page (pip) — `src/shell/client_popup.h`
- `Client::OnBeforePopup` (fil principal) appelle `popup::route(…)` : chaque module inscrit SON
  cas par `popup::addHandler(Handler)` (à son init), le premier qui ne rend pas
  `Decision::pass` décide ; `allow` = il a rempli `windowInfo` (hors écran), `client`,
  `settings`, `extraInfo`. Aucun preneur → refusée et journalisée (`[shell] popup refusée`),
  comme avant. Le PiP y prend `window.open("about:blank", "tentacle-pip")` armé par `pip_open` ;
  l'axe navigateur peut y prendre `target=_blank` (lien externe) sans toucher à `client.cpp`.
- `Client::DoClose` du navigateur PRINCIPAL appelle `popup::hostClosing()` : la fenêtre se ferme
  POUR DE BON (une garde de sortie l'a déjà laissée partir) ; les modules inscrits par
  `popup::addHostClosingListener(cb)` ferment leurs fenêtres AVANT elle (le PiP rend la vidéo
  à une page encore vivante, `pipQuit.ts`). Retour de CEF inchangé (`false`).
### Session vidéo (pont, lot cef-parite) — `src/bridge/glue/video_session.h`
- `pont::setVideoSessionObserver(VideoSessionObserver*)` (depuis `modules.cpp`, entre `install` et
  `installShim`) : `onVideoEvent(event, access)` à chaque `file-loaded` / `video-reconfig` de mpv,
  `access.get(nom, cb)` / `access.set(nom, valeur)` sans effet une fois l'instance arrêtée ;
  `onVideoStopped()` à `mpv_destroy` ou au remplacement de l'instance. Sert au HDR de l'écran
  (`src/display`, comme `hdrSession.ts` d'Electron).

### Unités de fenêtre (socle, lot cef-parite) — `src/shell/window_scale.h`
- Tout ce que le proto appelle « points » est en **DIP**. `windowScale(window)` →
  `{deviceScale = SDL_GetWindowDisplayScale, windowToDip = densité / deviceScale}` ;
  `windowSizeDip(window, w, h)`. Identité sur macOS (mesuré : contenu 1, densité 2, échelle 2) ;
  sous Windows et X11 SDL compte en pixels. `shell.window` → `width/height` en DIP, `scale` =
  échelle d'affichage. `InputRouter::setWindowToDip` ; `--size` en DIP (× échelle du contenu).
  `NativeKey::extraModifiers` : drapeaux de position (`EVENTFLAG_IS_LEFT/RIGHT/KEY_PAD`), 0 sur macOS.

### Écran (axe windows, lot cef-parite) — `src/display/`
- `display::install(ctx, pont::registry())` dans `modules.cpp` (avant `installShim`),
  `display::shutdown()` APRÈS `pont::shutdown()`. Canaux d'Electron, sur les TROIS OS (comme
  `ipc/videoHdr.ts`, `ipc/video.ts`) : `display_hdr_state {}` → `{supporte, enabled, bascule,
  autoAutorise, edrCapable, coucheHdr, espaceCouche, transmission, pic}` ; `display_hdr_auto {on}`
  → `null` (rejet `bad_payload` sans booléen) ; `mpv_harden_child_window {}` → `false`.
- OS (`src/platform/display_hdr.h`, `src/platform/<os>/display_hdr_<os>.*`) : `probeDisplayHdr`,
  `displayHdrNegotiated`, `enableDisplayHdr`, `restoreDisplayHdr`, `displayHdrToggled` ; Windows :
  `QueryDisplayConfig` + `SET_ADVANCED_COLOR_STATE` (`hdr.ts`) ; macOS : headroom EDR de l'écran ;
  Linux : rien constaté (à l'axe linux d'y mettre `video-target-params` s'il le veut).
- Session HDR (`hdr_session.h`, règle testée `tentacle_display_tests`) : `hdrSession.ts` — Windows
  seul ; bascule si la page l'autorise, `target-colorspace-hint=yes` si l'écran est (ou devient)
  HDR, à la fin la transmission tombe PUIS l'écran est rendu.
- Commandes propres à l'OS : `platform::installOsCommands(ctx, registry)` — Windows :
  `check_msix_update` → `{version:"", mandatory}` | `null`, `download_and_install_msix_update` →
  `null` ou rejet (code de `msix_rule.h`, `store-page-opened` après repli sur la page du Store),
  évènement `msix-update-progress {progress, indeterminate}` ; macOS, Linux : rien.

### Compositeur (socle) — `src/compositor/compositor.h`
- `setVideoLayer(VideoSurface*)` (ou `nullptr`), `webLayer()` ; ordre fixe : vidéo en bas,
  page web au-dessus, page transparente là où elle ne dessine rien.
- Le compositeur ne possède pas la surface. Il l'insère, la cadre sur toute la fenêtre
  (`setFrame` à chaque redimensionnement) et appelle `show()`. `setVideoLayer(nullptr)` la
  retire, et c'est le seul geste à faire avant de la détruire. Au démarrage, une couche
  factice (aplat, `--fake-video`) est posée : `ctx.fakeVideo`. La vraie surface la remplace
  par `setVideoLayer(&surface)`.
- macOS : couche web `CAMetalLayer` BGRA8 sRGB non opaque, z=10 ; conteneur vidéo z=0 ; vue
  hôte qui laisse passer la souris.
- Linux (`src/platform/linux/compositor_linux.cpp`) : NOTRE contexte EGL (GLES 3, sinon 2) sur la
  surface de la fenêtre SDL3 (`wl_egl_window` sous Wayland, la `Window` et son visuel sous X11 ;
  `SDL_HINT_VIDEO_FORCE_EGL`), sans `SDL_WINDOW_OPENGL`. Pile : vidéo (sous-surface, texture de
  l'API de rendu, ou aplat factice), page, popup, prémultipliées. Les images de CEF sont COPIÉES
  pendant le rappel : `OnPaint` (octets) ou `OnAcceleratedPaint` — `WebFrame::sharedHandle` =
  `const cef_accelerated_paint_info_t*` sous Linux (`client_render.cpp`), dmabuf importé en
  `EGLImage` puis copié par le GPU (`dmabuf_linux.cpp`). Une composition regroupée par tour de
  boucle, `eglSwapInterval(0)` (jamais bloqué sur un rappel `frame` de Wayland). Fenêtre
  `SDL_WINDOW_TRANSPARENT` sous Wayland seulement (`app.cpp`) : sans lui SDL déclare la surface
  opaque et la sous-surface vidéo disparaît.

### Linux (axe linux) — `src/platform/linux/`
- **Session graphique** (`graphics_session.h`) : décidée AVANT CEF et SDL (`main_desktop.cpp`
  ajoute `--ozone-platform=<montage>` et `--password-store=basic` à argv ; `app_linux.cpp` pose
  `SDL_HINT_VIDEO_DRIVER`). Même fichier qu'Electron (`session-graphique.json` du dossier de
  données, `{ "session": … }`), même variable d'essai `TENTACLE_LINUX_SESSION`. `auto` = la
  session du bureau (la vidéo suit la fenêtre partout : pas de détour XWayland). Pour le pont :
  `platform::linuxMontage()` (`"wayland"`/`"x11"`) et `platform::linuxWindowing()` (`"libre"`
  sous Wayland, `""` ailleurs) → `window.tentacle.montage` / `.fenetrage` (shim : axe systeme).
- **Commandes** (`linux_commands.h`, une ligne `#ifdef __linux__` dans `modules.cpp`) :
  `linux_session_get` → `{ choice, montage, bureau }`, `linux_session_set { choice }` → `null`.
- Règles pures et tests (`tentacle_linux_tests`, ctest) : session, langues
  (`locale_linux.h` : LANGUAGE/LC_ALL/LC_MESSAGES/LANG → Accept-Language), EDID HDR (`edid_linux.h`).
- Clavier (`shell_linux.cpp`) : `native_key_code` = keycode XKB (evdev + 8 sous Wayland, tel quel
  sous X11), `windows_key_code` commun, caractères par SDL ; IME par les évènements texte de SDL.
- **Pompe** (`shell/message_pump_sdl.cpp`, Linux ET Windows) : même logique que macOS — repli à
  250 ms, relance immédiate après une passe de CEF de 9 ms et plus (« pump wedge » : sans elle
  l'app se figeait au démarrage, mesuré). Linux : le contexte GLib par défaut (la pompe UI de
  Chromium est une `MessagePumpGlib`) est servi à chaque passe par `glib_pump_linux.h` (un fil
  guetteur attend ses descripteurs, le fil principal fait check/dispatch). Diagnostic :
  `TENTACLE_PUMP_TRACE=1`.
- **Presse-papiers** (`clipboard_linux.cpp`) : Chromium hors écran ne l'atteint pas sous Wayland ;
  pont par la fenêtre SDL (canaux internes `linux.clipboard.set|get` + script injecté) ; lecture
  seulement dans la seconde qui suit une vraie frappe de collage (droits d'Electron).
- **HiDPI** : `--disable-features=WaylandFractionalScaleV1` sous Wayland (sinon Ozone impose son
  échelle, 1, à celle de `GetScreenInfo`). Unités : DIP de `shell/window_scale.h` (axe windows).
- `postToMain` rend `false` quand la tâche n'a pas pu partir (avant `CefInitialize`, après
  `CefShutdown`) ; `TENTACLE_NO_SHARED_TEXTURE=1` force le repli `OnPaint` (tous OS).

- Windows (`src/platform/windows/compositor_windows.cpp`) : DirectComposition, UN périphérique
  D3D11 + DComp pour le processus et, par fenêtre, une cible « topmost » et son arbre
  (`dcomp_context_windows.h`) ; visuels conteneur vidéo → page → popup ; page = texture D3D11 PARTAGÉE de
  CEF (`WebFrame::sharedHandle` = poignée NT, `OpenSharedResource1`, copie GPU) ou pixels
  (`OnPaint`) dans une chaîne d'échange pour la composition (FLIP séquentiel, `Present(0)`).
  Pompe CEF : fenêtre de messages cachée (`message_pump_windows.cpp`), distribuée aussi par la
  boucle modale de Win32 — CEF reste sur le fil principal (pas de `multi_threaded_message_loop`).

### Navigateur (axe navigateur, lot cef-parite) — ce qu'un navigateur hors écran ne fait pas seul
Référence : `apps/desktop-electron/src/main/security.ts` (`lockNavigation`, `restrictPermissions`).
- **Navigation** (`src/shell/client_navigation.cpp`, règle pure `src/shell/navigation_rule.h`,
  tests `tentacle_navigateur_tests`) : le cadre principal garde l'origine de l'URL de départ
  (`nav::setAppOrigin`, posée par `Shell::start` : `tentacle://app`, ou le serveur en
  `dev:server`). Navigation ailleurs → annulée et ouverte dehors ; redirection ailleurs →
  annulée sans rien ouvrir ; cadres libres. `window.open`, `target=_blank`, clic du milieu,
  ⌘/Ctrl + clic → dehors, jamais une seconde fenêtre CEF.
- **Fenêtres** : la règle d'Electron est un gestionnaire de l'aiguillage de pip
  (`nav::installPopupPolicy()` → `popup::addHandler`, posé par `Shell::start`) : `pass` pour la
  fenêtre nommée `tentacle-pip` (le PiP décide), sinon dehors si le schéma est permis, puis `deny`.
- **Dehors** : `tentacle::openExternalSafely(url)` (`src/shell/external_url.h`, fil principal) —
  liste FERMÉE d'Electron (http, https, mailto, ms-windows-store, macappstore, itms-apps), URL
  canonique (`CefParseURL`), `SDL_OpenURL`. Bancs : `TENTACLE_OPEN_EXTERNAL=log` journalise
  `[externe] …` sans rien ouvrir.
- **Boîtes de la page** (`src/shell/browser_dialogs.h`, objets à part donnés par `ViewHost::
  dialogHandler()/jsDialogHandler()/downloadHandler()` ; règle pure `src/shell/dialog_rule.h` ;
  natif `src/shell/native_dialogs.h` → `src/platform/<os>/dialogs_<os>.*`) : `<input type=file>`
  (filtres d'Electron « Image Files »/« Custom Files » + « All Files », dernier dossier retenu),
  `alert`/`confirm` (NSAlert en feuille / TaskDialog / GTK ; « OK », « Cancel »), `prompt` →
  `null` sans boîte, `beforeunload` → la page reste sans question, téléchargement → boîte
  d'enregistrement (titre = URL, Téléchargements puis dernier dossier), annulée = téléchargement
  annulé. Linux : panneaux de fichiers = ceux de Chromium (portail XDG), comme Electron.
  Bancs : `TENTACLE_DEBUG_NAVIGATEUR=1` → canal `navigateur.debug.dialogs` (`state`, `answer`,
  `queue` : réponses d'avance, un dialogue JavaScript bloquant la page).
- **Glisser-déposer** (`src/shell/drag_drop.h`, `drag_ghost.h`, `client_drag.cpp`) : `StartDragging`
  ouvre une session interne (souris SDL → `DragTarget*`, Échap l'abandonne, image fantôme dans
  une fenêtre bulle SDL qui suit le curseur) ; fichiers et texte venus de l'OS par
  `SDL_EVENT_DROP_*` (survol avec un fichier fictif, dépôt rejoué avec les vrais fichiers,
  `DROP_COMPLETE` sans fichier = sortie). Un dépôt ne fait jamais naviguer (`navigateOnDragDrop`
  d'Electron : `nav::noteDrop`/`isDropNavigation`). `Shell::handleEvent` passe d'abord par
  `DragDrop::handleEvent`. `InputRouter` suit les boutons d'après ses évènements (`pressed_`) et
  expose `lastMouse`/`leftHeld`/`noteButtonUp`. Non porté : un glisser qui SORT vers le Finder.
  Bancs : `navigateur.debug.drop {files, text, x, y, leave}` (avec `TENTACLE_DEBUG_NAVIGATEUR=1`).
- **Bulles `title=`** (`src/shell/tooltip.h`, `OnTooltip` → `ViewHost::showTooltip`) : délai de
  survol immobile (macOS `NSInitialToolTipDelay`, Windows durée du double-clic, Linux 500 ms),
  sous le curseur, retirée au clic/frappe/molette/sortie ; fenêtre au premier plan seulement.
  macOS : panneau sans focus au matériau `ToolTip` (API publiques) ; Windows : `TOOLTIPS_CLASS`
  en suivi ; Linux : bulle SDL dessinée par Pango/Cairo (dlopen). Banc : `navigateur.debug.tooltip`.
- **Curseurs** (`src/shell/cursors.h`) : `ViewHost::setCursorFull(type, natif, custom)` (défaut :
  `setCursor(type)`) ; formes connues de SDL → curseur système ; les autres (grab, grabbing, zoom,
  help, copy…) → image du curseur natif fourni par CEF (macOS NSCursor, Windows HCURSOR), Linux
  → forme SDL la plus proche ; `cursor: url(…)` → son image ; glisser interne → curseur de
  l'opération (`forDrag`). SDL reste seul à poser le curseur.
- **Permissions** : toute invite refusée (`CEF_PERMISSION_RESULT_DENY`), média refusé, contrôles
  « denied » (réglages de contenu par défaut : notifications, géolocalisation, micro, caméra,
  MIDI, lecture du presse-papiers…) ; écriture assainie du presse-papiers accordée (défaut de
  Chromium). Exception propre à CEF : réseau local pour `tentacle://app`.

## Règles communes du code
- Ce qui dépend de l'OS : `src/platform/<macos|linux|windows>/`, derrière une interface. Linux et
  Windows ont au moins des stubs qui compilent dans l'esprit (pas forcément construits ici).
- Aucun chemin absolu dans le code ; les chemins viennent de variables d'environnement
  (`TENTACLE_CEF_CACHE`, défaut `~/.cache/tentacle-cef`) ou d'arguments.

## Réseau et données (axe reseau, lot cef-parite)

### Dossier de données — `src/shell/paths.h` (lié à `tentacle_shell`)
- `tentacle::paths::userData()` → `std::filesystem::path` absolu : le dossier de données
  d'Electron (`dataPaths.ts`) — macOS `~/Library/Application Support/com.tentacle.media`,
  Windows `%APPDATA%\com.tentacle.media`, Linux `$XDG_DATA_HOME` (absolu seulement) ou
  `~/.local/share` + `/com.tentacle.media`. Sûr depuis n'importe quel fil ; ne crée rien.
  Tout fichier partagé avec Electron (`octave-art/`, `tentacle-local.db`, médias gardés) se
  range sous ce dossier, aux mêmes noms.
- `--user-data=<dossier>` le remplace (lu par `paths::configure(opts.extra)`, juste après
  `parseArgs` dans `src/app/app.cpp`). `pnpm dev:cef` passe `--user-data=<profil d'Electron visé>`
  (`TENTACLE_ELECTRON_PROFILE`, sinon la règle) : stockage du front et données natives au même endroit.
- Garde des bancs : sans `--user-data`, un `--profile` rangé sous le cache de développement
  (`cacheRoot()`, `~/.cache/tentacle-cef`) donne `<profil>/user-data` — jamais le dossier d'Electron ;
  hors de ce cache (l'app installée), la règle d'Electron. `pnpm dev:server` : `$cache/profiles/dev-data`.
- Règle pure testée : `dataRoot(env)`, `dataFolder(env)`, la garde (`src/net/tests/paths_tests.cpp`).

### Cycle de vie (systeme) — `src/lifecycle/lifecycle.h` (cibles `tentacle_lifecycle_core`, pure, et `tentacle_lifecycle`, colle)
Règles d'Electron portées à l'identique et testées seules (`cmake -S src/lifecycle`, `ctest`) :
`backgroundDrain`, `quitGuard`, `closeSequence`, `playbackFarewell`, `powerSave` (+ renfort logind),
`appLinks`, régions `app-region`. Ce que les autres modules appellent, fil principal :
- **horsligne** : `setTransfersProbe({inFlight, busy, backgroundEnabled})` (fermeture : garde de
  sortie, fin des transferts fenêtre fermée) ; `keepSystemAwake(bool)` à chaque `onBusy`/`onHeld`
  (anti-suspension, rendue à la sortie) ; `onSystemResume(cb)` (`powerMonitor` « resume »).
- **tous** : `onWindowClosed(cb)` — la fenêtre est partie pour de bon (musique arrêtée).
- **reseau** (relais `jellyfin_session_post`) : `noteSessionPost(post)` AVANT l'envoi,
  `auto done = trackSessionPost()` puis `done()` (n'importe quel fil) à la fin de l'envoi ;
  `setFarewellSender(fn(stop, done))` : POST `/Sessions/Playing/Stopped` à la sortie (1,5 s au plus).
- **pont** : `preventDisplaySleep(bool)` derrière `prevent_display_sleep_start/stop`.
Coutures d'OS : `src/lifecycle/lifecycle_platform.h` → `src/platform/<os>/lifecycle_*`.
- **Dans l'app** (`src/app/app.cpp`, `lifecycle_app.h`) : `beforeSdl` (argv gardé, `--relaunch-after`,
  Apple events, `SDL_HINT_QUIT_ON_LAST_WINDOW_CLOSE=0`, `SDL_HINT_VIDEO_ALLOW_SCREENSAVER=1`),
  `prepareWindow` (cadre, 900×600 DIP au moins, test de clic des régions), `handedToRunningInstance`
  (CefInitialize faux + `CEF_RESULT_CODE_NORMAL_EXIT_PROCESS_NOTIFIED` → sortie 0), `attach`, puis la
  boucle : `handleEvent` (croix, Cmd+Q, réveil, lien devenu dépôt SDL), `windowAlive`, `afterEvents`,
  `waitTimeoutMs`, `running` ; `afterShutdown`. Fermer la dernière fenêtre n'est plus quitter : tout
  passe par le déroulé `exit_flow.h` (garde → séquence → `closed` → transferts sans fenêtre → adieu).
- **Instance unique** : le verrou de profil de CEF (`root_cache_path`) ; la seconde instance transmet
  sa ligne de commande (`BrowserApp::OnAlreadyRunningAppRelaunch` → `setSecondInstanceHandler`).
- **`modules.cpp`** : `lifecycle::install(ctx, pont::registry())` (avant `installShim`),
  `setVideoControls({pont::videoRunning, pont::stopVideo, pont::pauseVideo})`, `onWindowClosed(…)`.
- **Canaux** : `app_link_take` + évènement `app-link` (dans la liste) ; HORS liste, comme le preload :
  `tentacle:open-external {url}` (liste fermée), `tentacle:pick-folder`, `tentacle:relaunch` ;
  `lifecycle.windowFocus` (évènement) / `.get`, `lifecycle.pageStarted` (posé par le shim).
- **Régions** : `CefDragHandler::OnDraggableRegionsChanged` (`src/shell/client_drag_regions.cpp`,
  cadre principal) → `SDL_SetWindowHitTest` (unités de fenêtre converties en DIP).
- **Bancs** : `--debug-lifecycle` ouvre `lifecycle.debug.{state,transfers,close,focus,note,sheet,awake}`
  (`lifecycle_debug.cpp`) ; sous `--background`, ni activation ni notification (journalisées) ;
  `TENTACLE_LIFECYCLE_TRACE=1` trace GetURL, dépôts et `app_link_take`.

### Module réseau — `src/net/` (cibles `tentacle_net_core` pure, `tentacle_net` liée au socle)
- Branchement : `reseau::install(ctx)` (`net/net_shell.h`) dans `initModules`, APRÈS `pont::install`
  et AVANT `pont::installShim` (ses commandes entrent dans `capabilities`) ; `reseau::shutdown()`.
- Client HTTP du principal : `net::httpFetch(HttpRequest, done)` (`net/cef_fetch.h`) — CefURLRequest
  (pile de Chromium, profil courant), sans cookie ni `Origin` par défaut, `maxBytes`, `timeoutMs`,
  `followRedirects`, `useCache` ; `done` sur le fil UI, une fois ; rend une fonction d'annulation.
  À réutiliser par tout module qui fait du réseau natif (jamais une seconde pile).
- Règles pures réutilisables : `net::parseHttpUrl` / `parseFormQuery` / `encodeUriComponent` /
  `localeCompare` (`net/web_url.h`, l'URL du WHATWG et le texte de JavaScript), `net::sha256`
  (`net/sha256.h`), `net::birthTimeMs` / `setModifiedTimeMs` (`net/fs_platform.h`).
- Tâches : `net::postTo(TID_…, fn)`, `net::postToDisk(fn)` (séquence `TID_FILE_USER_BLOCKING`).

### Schémas — `src/schemes/`
- `tentacle://art` (`schemes/art_scheme.h`) : pochettes d'Octave à l'identique d'Electron
  (`octaveArt/`) — `GET /?o=&u=`, `POST /clear`, cache `<userData>/octave-art` (mêmes noms de fichiers,
  relus par Electron : `tools/art-key-xcheck.mjs`, `tools/art-cache-electron-read.mjs`).
- `schemes::BufferedHandler` (`schemes/buffered_handler.h`) : réponse de schéma tenue en mémoire,
  rendue de n'importe quel fil (`Respond`).
- `tentacle://plugin/<id>` (`schemes/plugin_scheme.h`) : document d'un greffon déposé par la commande
  `plugin_document_set {id, html}` → `"tentacle://plugin/<id>"` (`net/plugin_documents.h` : 8 au
  plus, identifiant `^[a-zA-Z0-9._-]{1,64}$`), servi avec la CSP des greffons.
- CSP (`net/csp.h`, à l'octet celle de `csp.ts`) : `appscheme::setAppCsp()` / `appCsp()`
  (`shell/app_scheme.h`) — posée par `reseau::install` d'après l'`index.html` servi, portée par
  TOUTE réponse de `tentacle://` hors greffons. **horsligne** : `tentacle://local` doit la poser
  aussi (`Content-Security-Policy: appscheme::appCsp()`), comme Electron.
- Relais Jellyfin (`net/jellyfin_relay.h`, cible `tentacle_net_commands`, testée sans CEF) :
  `jellyfin_session_post` (liste FERMÉE `/Sessions/Playing[/Progress|/Stopped]`),
  `jellyfin_playback_info`, `jellyfin_kill_encodings` — chemins construits côté natif, 20 s, en-têtes
  `Authorization` (Jellyfin direct) ou `X-Emby-*` (proxy `…/api/jellyfin`). Adieu à Jellyfin :
  `reseau::connectFarewell` (`net/farewell.h`) appelle `lifecycle::noteSessionPost`,
  `trackSessionPost` et `setFarewellSender` (axe systeme) dès que la cible `tentacle_lifecycle`
  existe (expression génératrice CMake, sans ordre d'`add_subdirectory`). `reseau::jellyfinRelay()`.
- Diagnostic du banc (hors `window.tentacle`) : `__shell.invoke('reseau.debug.trace')` → les 200
  dernières requêtes natives des relais `{method, url (sans requête), status, error, ms}`.
- Requêtes déléguées (`plugins.clientFetch`) : `client_fetch_run {serverOrigin, headers, pluginId,
  request}` → `ClientFetchOutcome`, `client_fetch_log` (`net/client_fetch_commands.h`). Règle à l'octet
  du contrat partagé (`net/client_fetch_policy.h`), plafond 4/30/300 par extension, manifestes lus par
  l'app sur `<serverOrigin>/api/plugins/active` (`net/client_fetch_run.h`, 5 min, 4 sessions) ; saut
  réel `cf::cefHop()` (`net/cef_hop.h`) : résolution par Chromium (`ResolveHost`), une adresse privée
  → `refused`, puis CefURLRequest sans cookie ni cache, redirections jugées une à une.
  `reseau::pluginManifests()` (`net/net_shell.h`) : les `mediaHosts` pour les flux directs (axe medias).
- Flux directs d'Octave (relais local, `net/direct_relay.h`, `net/direct_source.h`) — pour l'axe
  **medias**, dans `audio_play` / `audio_set_next` comme `checked()` d'`ipc/audio.ts` :
  `reseau::adoptDirectSource(source, trackKey, session, done(source, adopted))` (`net/net_shell.h`) ;
  à `audio_engine_start` : `reseau::setDirectCutListener(url → engine.sourceCut(url))` et une lecture
  d'avance `reseau::pluginManifests()->of(session, "", …)`. mpv lit `http://127.0.0.1:<port>/d/<jeton>`
  (`reseau::directRelayOrigin()`), direct sans identifiant du compte, repli sur le serveur avec ses
  en-têtes (`direct=failed` une fois), 502 après une coupure. Banc : `__shell.invoke('reseau.debug.adoptDirect',
  {source, trackKey, serverOrigin, headers})`, `reseau.debug.directRelay` → `{origin, direct, fallbacks, cuts}`.
- `media_warm {url, ranges}` (`net/media_warm.h`) : tête et fin du fichier lues par plages (`Range`,
  206 seulement, 4 Mio au plus, deux en vol, même demande après 10 min, 15 s) pour chauffer le
  disque du serveur ; rien n'est gardé. Lecture en flux `net::httpStream` (sans cache).

## Image dans l'image — PiP (axe pip, lot cef-parite)

Portage du PiP d'Electron (`apps/desktop-electron/src/main/pip/`, `ipc/pip.ts`,
`video/macosPipParent.ts`) ; le front ne change pas (`apps/web/src/pictureInPicture/`).

- **Commandes** (déclarées seulement là où le PiP marche : `pip::createPlatform` non nul), mêmes
  charges et réponses qu'Electron — `pip_open {mode, width, height}` → `{shadow, bezel}` (le cadre,
  `pip/rules/pip_frame.h`) ; `pip_mode {mode, width?, height?}`, `pip_resize {width, height}`,
  `pip_gesture {gesture|null, grab?}`, `pip_close {}` → booléen (faux sans PiP) ; `pip_restore {}` →
  booléen APRÈS l'animation du retour. Charge refusée : « arguments invalides pour <commande>: … ».
- **La fenêtre PiP est ouverte par la page** (`window.open("about:blank", "tentacle-pip")`, armée
  par `pip_open`, 3 s, une seule) : `popup::addHandler` (`src/shell/client_popup.h`) en fait un
  SECOND navigateur hors écran (`pip/glue/pip_client.h` : ni `window.tentacle` ni scripts injectés,
  navigation bloquée hors `about:blank`), rendu dans la pile de couches de la fenêtre PiP. Le bloqueur
  de popups de Chromium est levé (réglage par défaut du profil CEF : Electron n'en a pas) ; seul le
  PiP armé passe le filtre.
- **La vidéo est PRÊTÉE, jamais recréée** (`src/compositor/compositor.h`) :
  `lendVideo(borrower, home)` range la couche vidéo courante — et toute couche posée par
  `setVideoLayer` pendant le prêt, sauf `home` (la couche factice) — sous la page de `borrower` ;
  `reclaimVideo()` la rend, plein cadre ; `setVideoInset(inset)` (pile qui reçoit) la pose à
  `inset` points des bords ; `canLendVideo()` dit si l'OS sait le faire (sinon : pas de PiP). La
  couche ne change ni d'instance ni de réglages : lecture et HDR/EDR gardés. Le cadrage de la vidéo
  est l'affaire du SEUL compositeur (le pont ne la recadre plus). `VideoSurface::setHostWindow`
  (défaut : rien) : le compositeur donne à la couche la fenêtre qui la porte (échelle, écran).
- **Portes à implémenter par OS** (`src/pip/pip_ports.h`, coordonnées en POINTS, origine en haut à
  gauche de l'écran principal) : `pip::Platform` = `Desktop` (curseur, écrans, zone utile, fenêtre
  principale, bandeau, « Réduire les animations »), `Ticker` (minuterie du fil principal), fabrique
  de `pip::Window` (sans cadre, `setBounds`, `showInactive`, `applyMode` = niveaux / bureaux /
  ancrage, titre, sa pile `Compositor`, `WindowEvents` : garde du redimensionnement, fin d'un
  redimensionnement par la main, fenêtre principale déplacée/restaurée) ; sa souris va à SA page par
  `PageInput` (drapeaux `EVENTFLAG_*` de CEF ; `resized`, `closeRequested`).
  - **macOS** : fenêtre NATIVE (`platform/macos/compositor_pip_*`) — premier clic, survol
    application inactive (zone de suivi ActiveAlways), garde par `windowWillResize:`, ancrage
    (`pipDocking.ts`), focus rendu à la fenêtre principale.
  - **Linux, Windows** : la fenêtre PORTABLE sur SDL3 (`src/pip/sdl/`, filtre d'évènements SDL
    chaîné : la boucle de l'app ne voit jamais les évènements du PiP), prise par
    `platform/<os>/pip_<os>.cpp` dès que le compositeur de l'OS rend `canLendVideo()` vrai. Reste
    sous Wayland : la place des fenêtres (le titre de la colle KWin, `pip/rules/pip_captions.h`).
  - **Linux (fait, Wayland seulement)** : `VideoSlot` (`platform/linux/video_slot_linux.h`) tient la
    couche de chaque pile, son cadre (à `inset` des bords) et le prêt, sur le modèle de
    `compositor_mac.mm` ; la pile qui MONTRE la couche lui donne sa fenêtre et son `GlHost`
    (`VideoHost`, par `setHostWindow`). Sous-surface : la MÊME `wl_surface` de mpv change de parent
    (`wl_subsurface` détruite puis redonnée sous la surface du PiP) — HDR et lecture gardés. API de
    rendu : le rendu reste dans le contexte principal, la pile du PiP partage ses textures
    (contextes EGL partagés, `egl_linux.cpp`). X11 : pas de PiP (`canLendVideo` faux), comme
    Electron. Le navigateur du PiP reçoit son fond transparent par l'inspecteur
    (`Emulation.setDefaultBackgroundColorOverride`, `pip_client.cpp`) : sans lui, son canevas
    restait opaque (#121212) sous Linux. Preuve : `bench/linux/prove-pip.mjs` (sway).
  - **Windows** (fait, jamais essayé sur une machine) : `canLendVideo()` vrai ; le visuel de la
    chaîne de mpv QUITTE l'arbre DirectComposition de la fenêtre principale (commit) et entre dans
    celui de la fenêtre PiP — possible parce que tous les arbres viennent du MÊME périphérique
    DComp (`DcompDevice::shared()`). mpv n'en sait rien : ni nouvelle sortie, ni HDR changé ;
    seule sa taille suit (`setHostWindow` → DPI de la fenêtre PiP → `d3d11-composition-size`). La
    couche du repos (`home`, aplat de banc) ne quitte jamais sa fenêtre. Pile du PiP =
    `Compositor::create(pip)`, fenêtre OPAQUE (`Options::transparent = false` : la cible
    « topmost » compose la page transparente et la vidéo par-dessus le fond noir de la fenêtre,
    sans fenêtre transparente — `pipFrame.ts` sous Windows).
- **Branchement** : `pip::install(ctx, pont::registry())` avant `pont::installShim`,
  `pip::shutdown()` dans `shutdownModules` (le navigateur du PiP part avant CefShutdown) ;
  `Client::DoClose` du navigateur principal → `popup::hostClosing()` → le PiP part AVANT la fenêtre
  principale (`pipQuit.ts`).
- **Diagnostic** (hors `window.tentacle`) : `pip.debug.state` (ouvert, cadre, mode, vidéo prêtée,
  couches de la pile du PiP, état de la fenêtre, zone de l'application) ; avec `--debug-input` :
  `pip.debug.cursor {x,y}|null` (curseur que suivent les gestes), `pip.debug.native {kind,x,y,…}`
  (évènement de souris natif dans la fenêtre PiP), `pip.debug.moveHost {dx,dy}`.
  `TENTACLE_PIP_HOST=sdl` (macOS, banc) : la fenêtre portable sur la pile macOS.
- **Bancs** : `bench/pip/scenario.mjs` (parcours complet dans le front), `bench/pip/native.mjs`
  (chemin natif, niveaux, ancrage), `bench/pip/quit.sh` (quitter pendant le PiP) ; tests des règles :
  `cmake -S src/pip -B <build> && ctest` (`tentacle_pip_tests`).

## Verre natif — Liquid Glass de macOS 26 (axe verre, lot cef-parite)

Portage de `apps/desktop-electron/src/main/liquidGlass/` ; le front ne change pas (`theme/liquidGlassMode.ts`,
`theme/glass/`, `useBackdropTone`). Carnet de la fonction : `docs/LIQUID-GLASS.md` (racine du dépôt).

- **Verdict au démarrage** (`src/glass/availability.h`, règle d'Electron) : macOS 26 (ou « 16 »), classes
  PUBLIQUES `NSGlassEffectView` / `NSGlassEffectContainerView` présentes ; `TENTACLE_LIQUID_GLASS=off` simule un
  Mac sans verre, `native` saute la seule garde de version. Journal : `[liquid-glass] native|forced-off|…`.
  Hors `native` : rien de branché, `window.tentacle.liquidGlass` ABSENT (l'option de Réglages › Apparence aussi).
- **Pont** (`web/shim/tentacle-bridge.js`, config `liquidGlass: {refractsVideo}` posée par
  `pont::setLiquidGlassShim`) : `supported`, `refractsVideo` (Apple Silicon), `setEnabled`, `upsert`, `remove`
  (UN message par tâche, `batcher.ts`), `sample(rects)`. Canaux HORS `capabilities` : `liquidGlass.batch`,
  `liquidGlass.sample` → `[luminance|null]`, `liquidGlass.pageStarted` (un nouveau document efface le verre de
  l'ancien), `liquidGlass.debug.snapshot` (bancs : relu dans AppKit, + `liveViews`, `windowVisible`).
- **Branchement** (`src/glass/glass_shell.h`) : `glass::install(ctx)` après `pont::install`, AVANT
  `pont::installShim` ; `glass::shutdown()` dans `shutdownModules` (fenêtre encore vivante : tout part d'AppKit).
- **Compositeur** (`src/compositor/compositor.h`) : `setUnderlay(view)` pose la racine du verre ENTRE la vidéo
  (z 0) et la page (z 10) — sous-vue de l'hôte de couches, zPosition 5 ; `shownVideoFrame(&cadre)` (vidéo
  montrée dans CETTE pile, rien quand elle est prêtée au PiP) ; `WebLayer::retainLastFrame()` (IOSurface).
- **Pont** (`glue/pont_shell.h`) : `pont::videoPlayer()`, `pont::setOnSurfaceTransparent(fn)` (vrai : vraie
  couche vidéo posée ; faux : arrêt, ou `player_surface_transparent {on:false}`). Verre caché sinon.
- **Lecteur** (`player/player.h`) : `Player::commandReading(args, lire, done)` — `screenshot-raw video bgra` lu
  EN PLACE, la grille seule (jamais l'image en JSON).
- **Règles pures** (`tentacle_glass_core`, ni CEF ni AppKit) : `validate`, `geometry`, `spring_curve`,
  `materialize`, `stage`, `regions`, `snapshot`, `luminance`, `video_layout` — tests : `ctest --test-dir
  <build>/src/glass` (les `*.test.ts` d'Electron portés, le shim joué sous Node, le verrou du Mac App Store :
  aucune API privée du verre dans le paquet macOS).
- **Coutures d'OS** (`src/glass/glass_platform.h`) : `platform/macos/glass_backend_mac.mm` (AppKit, animateur de
  `NSAnimationContext`), `glass_platform_mac.mm` (verdict, Apple Silicon, page lue hors du fil principal) ;
  Linux, Windows : « not-macos » (`glass_linux.cpp`, `glass_windows.cpp`).
- **Bancs** : `bench/glass/glass.mjs` (réglage, lecture, verre posé, matérialisation en vol, tons, retrait, 0 vue
  vivante après), `bench/glass/gpu.mjs` (phases alternées avec/sans verre, temps GPU par processus, images
  perdues ; refuse une fenêtre non composée).
