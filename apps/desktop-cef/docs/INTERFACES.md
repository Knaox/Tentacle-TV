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
| `src/music/`, `web/shim/octave*`, `bench/music/` | octave | mode musique, mini-lecteur, file, bascule musique ↔ vidéo ; musique de test |
| `bench/server/` | pont | banc local Tentacle + Jellyfin jetable (copies, jamais le dépôt Tentacle) |
| `src/update/`, `src/platform/<os>/update_*`, `web/shim/update*`, `bench/update/` | maj | mise à jour automatique : manifeste signé, règle de décision, assistant de remplacement, surcouche |

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
plein écran natif = `SDL_SetWindowFullscreen(ctx.window, on)`. La fenêtre garde sa barre de
titre standard : `titleBarHeight` = 0.

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
- Branchement (`src/bridge/glue/pont_shell.h`, cible `tentacle_bridge_glue`, liée à `tentacle_shell`) :
  dans `src/app/modules.cpp`, `pont::install(ctx)` — le registre existe —, puis les déclarations
  d'octave (`music::installInShell(pont::registry())`, `pont::setOnVideoClaim(…)`), puis
  `pont::installShim(ctx)` EN DERNIER (capabilities figées). Le registre est `pont::registry()`.
- Lecture vidéo : une instance `Player` par `mpv_init` ; la surface (`createVideoSurface(ctx.nativeWindow)`)
  naît au PREMIER `loadfile`, plein cadre sous la page, et suit `addWindowStateListener` ; à l'arrêt,
  `setVideoLayer(ctx.fakeVideo)` puis destruction du lecteur, puis de la surface. Options de
  sortie de la page écartées ; le son suit `player/sound_policy.h` (ci-dessous).
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
- Linux / Windows : stubs (`createVideoSurface` → `nullptr`, le lecteur reste sans sortie vidéo).

### Musique (octave) — `src/music/`
- Canaux page ↔ natif = ceux de Tentacle (`audioBridgeContract.ts`) : commandes `audio_engine_start`,
  `audio_engine_stop`, `audio_play`, `audio_set_next`, `audio_swap_source`, `audio_control`,
  `audio_list_outputs`, `audio_set_output`, `audio_level` ; évènement `audio://event` (charge nue).
- Déclarés dans le registre du pont (`bridge::Registry`) par `music::installInShell(registry)`
  (`src/music/octave_shell.h`), depuis `src/app/modules.cpp`, avant `injectedScript()`.
- Une instance mpv À PART, audio seul, jamais attachée à une surface (zéro couche Metal),
  sur la sortie native, volume et sourdine de la page (`audio_control`) ; sous `--mute`, muette,
  volume 0 et `ao=null`.
- `music::videoClaim()` : une lecture vidéo démarre (branché sur `VideoChannels::setOnVideoClaim`)
  → la musique qui joue passe en pause, et la page reçoit `{type:"remote", command:"pause"}`.
- `music::shutdownMusic()` : à la fermeture.
- Diagnostic (banc seulement, par `__shell.invoke`, hors `window.tentacle`) : `octave.debug.log`
  `{fromCall, fromEvent}` → commandes reçues / évènements émis (valeurs d'en-têtes masquées),
  `octave.debug.prop {name}` → propriété du mpv musique, `octave.debug.claim` → simule « une vidéo démarre ».
- Moteur : le `Player` de vidéo-HDR en `audioOnly` (`player_audio_backend`) quand `tentacle_player`
  existe, sinon libmpv de Homebrew (`mpv_audio_backend`, banc seul).
- CMake : `add_subdirectory(src/music)` APRÈS `src/player`, `src/bridge` et le socle (cible
  `tentacle_music`). Banc seul : `tests/music/run-probe.sh` (`OCTAVE_WITH_PLAYER=1` : sur `Player`).

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

### Navigateur (axe navigateur, lot cef-parite) — ce qu'un navigateur hors écran ne fait pas seul
Référence : `apps/desktop-electron/src/main/security.ts` (`lockNavigation`, `restrictPermissions`).
- **Navigation** (`src/shell/client_navigation.cpp`, règle pure `src/shell/navigation_rule.h`,
  tests `tentacle_navigateur_tests`) : le cadre principal garde l'origine de l'URL de départ
  (`nav::setAppOrigin`, posée par `Shell::start` : `tentacle://app`, ou le serveur en
  `dev:server`). Navigation ailleurs → annulée et ouverte dehors ; redirection ailleurs →
  annulée sans rien ouvrir ; cadres libres. `window.open`, `target=_blank`, clic du milieu,
  ⌘/Ctrl + clic → dehors, jamais une seconde fenêtre CEF.
- **Fenêtres** : l'aiguillage des popups de pip (`src/shell/client_popup.h`, `popup::addHandler`)
  décide d'abord ; quand aucun module ne prend la fenêtre, son défaut est la règle d'Electron
  (`nav::applyVerdict(nav::windowOpen(url))` : dehors si le schéma est permis, puis refusée).
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
  Bancs : `TENTACLE_DEBUG_DIALOGS=1` → canal `navigateur.debug.dialogs` (`state`, `answer`,
  `queue` : réponses d'avance, un dialogue JavaScript bloquant la page).
- **Permissions** : toute invite refusée (`CEF_PERMISSION_RESULT_DENY`), média refusé, contrôles
  « denied » (réglages de contenu par défaut : notifications, géolocalisation, micro, caméra,
  MIDI, lecture du presse-papiers…) ; écriture assainie du presse-papiers accordée (défaut de
  Chromium). Exception propre à CEF : réseau local pour `tentacle://app`.

## Règles communes du code
- Ce qui dépend de l'OS : `src/platform/<macos|linux|windows>/`, derrière une interface. Linux et
  Windows ont au moins des stubs qui compilent dans l'esprit (pas forcément construits ici).
- Aucun chemin absolu dans le code ; les chemins viennent de variables d'environnement
  (`TENTACLE_CEF_CACHE`, défaut `~/.cache/tentacle-cef`) ou d'arguments.
