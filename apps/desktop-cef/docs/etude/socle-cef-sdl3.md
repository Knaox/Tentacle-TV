# Étude du socle — CEF + SDL3 dans la référence, et ce que le proto en retient

Session **socle** du lot « proto CEF ». Référence : `andrewrabert/jellium-desktop`, lue
en lecture seule (`git archive` vers `~/.cache/tentacle-cef/ref-snap/socle-<sha8>`).
Plan du document :

- A. L'ère C++ + CEF + SDL3 (jusqu'à `3462549`), lue par le socle : boucles, rendu,
  couches, IPC, saisie.
- B. Ce que le proto mesure sur le MacBook Pro M4 XDR (macOS 26.6.2, CEF 156). Plusieurs
  mesures contredisent la référence.
- C. Pourquoi la référence a quitté SDL3, et ce qu'elle fait depuis (ère 2 Metal, ère 3
  Rust). Section rédigée par un sous-agent d'étude, relue et recoupée par le socle.
- D. Les décisions du socle, et pourquoi.

---

## A. L'ère C++ + CEF + SDL3 (`3462549`), lue par le socle

### A.1 Boucle de messages : qui possède la boucle ?

- **SDL possède la boucle** (`E1/src/main.cpp:1783-1817`). Au repos, `SDL_WaitEvent`.
  Quand il y a du travail (rendu en attente, vidéo, commandes), `SDL_PollEvent`.
- **CEF en `external_message_pump` sur le fil principal**, sur macOS
  (`main.cpp:978-980`) et sur Linux (`main.cpp:997-1000`). La raison est écrite en clair
  pour Linux : *« Chromium assumes the main process thread is the UI thread … running
  CefInitialize on a dedicated thread causes subtle corruption »*. Sur macOS, c'est une
  contrainte de Chromium : le fil UI est le fil d'AppKit, et `multi_threaded_message_loop`
  n'existe pas.
- **Windows** est l'exception : CEF tourne sur son propre fil (`cef_thread.cpp`), avec la
  boucle interne de CEF.
- **Réveil** : `App::OnScheduleMessagePumpWork` est appelé par CEF depuis n'importe quel
  fil (`cef_app.cpp:69-91`).
  - Travail immédiat : `SDL_PushEvent(SDL_EVENT_WAKE)` (sur Linux, un eventfd).
  - Travail différé : `SDL_AddTimer`.
  - `App::DoWork` boucle jusqu'à 5 fois sur `CefDoMessageLoopWork`, tant qu'il reste du
    travail (lignes 97-113), pour ne pas faire tourner la boucle à vide.
- **Pourquoi c'est fragile** :
  - la boucle modale d'AppKit (redimensionnement en direct, menus) bloque la boucle SDL. Il
    a fallu un `SDL_AddEventWatch` qui pompe CEF et recompose sur `EXPOSED`
    (`main.cpp:1551-1582`) ;
  - les sources Mojo de Chromium (CFRunLoop) n'étaient servies qu'au prochain évènement
    (`6042583`, voir C.1.2).

### A.2 Rendu : CEF hors écran (OSR) et couches

- **Rendu hors écran partout** : `SetAsWindowless` + `shared_texture_enabled`
  (`main.cpp:1409-1416`) :
  - macOS : IOSurface ;
  - Windows : texture D3D11 partagée vers DirectComposition ;
  - Linux : dmabuf.
- `windowless_frame_rate` = fréquence de l'écran donnée par SDL (`main.cpp:1427`).
- **Deux navigateurs** empilés (`browser_stack.cpp`) : la page principale et un
  « overlay », chacun avec son `MetalCompositor`.
- **Compositeur macOS** (`metal_compositor.mm`) :
  - une `NSView` + `CAMetalLayer` BGRA8 `opaque=NO`, en sous-vue de la contentView de la
    fenêtre SDL (`metal_compositor.mm:88-132`) ;
  - texture Metal **adossée à l'IOSurface de CEF et gardée au-delà du rappel**
    (`importQueuedIOSurface`, lignes 297-375), ce qui donne un « zéro copie » ;
  - passe Metal qui **prémultiplie** (`color.rgb *= color.a`, ligne 54) ;
  - 3 drawables pour laisser ProMotion monter à 120 Hz (commentaire, lignes 105-114) ;
  - `presentsWithTransaction` pendant le redimensionnement.
- **Vidéo** : mpv par la Render API, rendu Vulkan (gpu-next, MoltenVK sur Mac) dans une
  couche Metal **sous** la vue CEF (`platform/macos_layer.mm`). L'application possède
  cette couche (EDR RGBA16F).
- **Transparence** :
  - la page CEF a un fond transparent ;
  - la vue CEF est au-dessus et non opaque ;
  - la vidéo se voit là où la page est transparente.
  - C'est le même empilement que celui demandé ici : vidéo en bas, page au-dessus.

### A.3 Processus et paquet

- Pas de helpers. L'exécutable principal sert de sous-processus
  (`browser_subprocess_path` = lui-même, variable d'environnement
  `JELLYFIN_CEF_SUBPROCESS`, `main.cpp:313-315, 549-555, 913-915`).
- Puis **`--single-process` sur macOS** (`cef_app.cpp:42-43`) : *« avoids Mach port
  rendezvous issues with ad-hoc signed app bundles »*.
- `NSApplication` conforme à `CefAppProtocol`, créée **avant `SDL_Init`**
  (`macos_app.mm:101-104`). `terminate:` est détourné en `SDL_EVENT_QUIT` : jamais
  `exit()`.

### A.4 IPC page ↔ natif

- **Côté rendu** (`cef_app.cpp:116-182`) :
  - `OnContextCreated` pose `window.jmpNative` : une trentaine de fonctions V8 nommées
    (`playerLoad`, `playerSeek`…) ;
  - chaque fonction envoie un `CefProcessMessage` typé au processus navigateur ;
  - les scripts (`native-shim.js`, plugins du lecteur) sont **compilés dans le binaire** et
    exécutés par `frame->ExecuteJavaScript` dans `OnContextCreated`, avec les réglages
    substitués dans le texte (`__SERVER_URL__`, `__SETTINGS_JSON__`).
- **Retour vers la page** : du JS fabriqué par concaténation
  (`"window._onClipboardResult('" + mime + "', …)"`, lignes 199-215). Ce n'est ni générique
  ni sûr vis-à-vis des guillemets.
- **Pas de routeur générique.** Chaque canal ajoute du code V8 + un message + un traitement.

### A.5 Saisie

- SDL → `CefMouseEvent`/`CefKeyEvent` (`input/browser_layer.h`, `sdl_to_vk.h`).
- **Clavier Mac** : SDL ne donne pas les codes kVK. Une table SDL → kVK a dû être corrigée
  plusieurs fois (`2d6a0f4`, `7806211`). Si `character` et `unmodified_character` valent 0,
  CEF fabrique un `NSEventTypeFlagsChanged` et la touche est perdue (`54ebe6e`).
- **IME** : `SDL_EVENT_TEXT_EDITING` est ignoré. Il n'y a pas d'IME.
- **Défilement trackpad** : les deltas précis sont regroupés par image (`fda1964`).
- **Plein écran** : `SDL_SetWindowFullscreen` (`main.cpp:1339-1343`).
- **Curseurs** : `SDL_SetCursor`, plus un curseur vide en lecture (`main.cpp:1321-1328`).

---

## B. Mesures du proto (socle, Jalon 1, 03/11)

Matériel : MacBook Pro M4, écran XDR 120 Hz, macOS 26.6.2, CEF
`156.0.15+gcf671c0+chromium-156.0.8078.80`, SDL3 3.4.16 (Homebrew). Toutes les valeurs
ci-dessous viennent de la page de test (`tests/socle/page.html`), interrogée par DevTools
(`tools/cdp-eval.mjs 9301 …`).

| Mesure | Résultat | Ce que ça contredit ou confirme |
|---|---|---|
| Multi-processus avec 5 helpers signés ad hoc | **fonctionne** : GPU, Renderer, réseau et stockage démarrent (`pgrep`). Seul message : *« Signature validation … -67030 »*, sans effet | La référence passe en `--single-process` « à cause de macOS 26 / MachPortRendezvous ». Ce n'est pas nécessaire ici, avec un vrai paquet de helpers |
| Alpha de l'IOSurface CEF | `rgba(255,0,0,0.5)` donne **r=128, a=128** : **prémultiplié** | L'ère 2 affirme « STRAIGHT alpha » et prémultiplie. En CEF 156, prémultiplier encore assombrirait les bords |
| Cadence de peinture CEF | **120,7 images/s** (`viewFrames`, sur 3 s) ; rAF de la page **120,0** | 120 Hz atteint sans BeginFrame externe, avec `windowless_frame_rate = 120` |
| Copie IOSurface → texture, avec attente CPU (`waitUntilCompleted`) | 5,5 ms par image, pointe à **43 ms** sur le fil principal | Intenable à 120 Hz |
| Même copie sans attente (choix retenu) | **0,5 ms** de CPU, **0,53 ms** de GPU | Rejoint le « non bloquant » de l'ère 2 (`9954a71`) |
| `__shell` et script injecté avant la page | `typeof window.__shell === 'object'` et le marqueur injecté sont visibles dès le premier script de la page | — |
| Arbre de couches | fond noir → vidéo factice (z=0) → `CAMetalLayer` web (z=10, `opaque=0`) | — |

---

## C. Après SDL : ères 2 et 3 (étude déléguée, relue)

document d'enquête (`docs/resize_investigation.md`, commit `ca7f776`, supprimé plus tard
par `b0ac59b`) et des diffs de `CLAUDE.md`/`README.md`.

---

### C.1 Pourquoi ils ont quitté SDL3

#### 1.1 La vraie cause : l'inversion « mpv possède la fenêtre »

SDL n'a pas été retiré pour lui-même : il est tombé **parce que l'intégration mpv a été
réécrite**. Le titre de `99bf6c6` le dit dans l'ordre : *« Rewrite mpv integration &
replace SDL with platform-native compositing (Wayland) »*.

- **Ère 1** [V] : l'app possédait la fenêtre (SDL3) **et** le GPU vidéo. mpv était piloté
  par la Render API de libmpv, avec un backend gpu-next/Vulkan **maison dans le fork**
  (`CLAUDE.md` à `3462549` : *« Custom libmpv gpu-next path in
  `third_party/mpv/video/out/gpu_next/` … `context.c` - Vulkan FBO wrapping for libmpv »*).
  Sur macOS, l'app créait elle-même une instance/un device Vulkan MoltenVK et une
  swapchain sur sa `CAMetalLayer` (`E1/src/platform/macos_layer.mm:34-214`, commentaire
  ligne 38 *« We ignore the passed-in Vulkan handles and create our own »*). Idem Wayland
  (`wayland_subsurface.cpp`), Windows (`windows_video_surface.cpp`, ~740 lignes), X11
  (`x11_video_layer.cpp` + EGL).
- **Ère 2** [V] : mpv utilise **son propre VO natif** (`vo=gpu-next`, `gpu-api=vulkan`,
  `E2/src/main.cpp:500-503`) et **crée sa propre fenêtre** (`force-window=yes`). L'app se
  contente d'empiler des surfaces CEF par-dessus. Message de `11ad581` : *« Port
  jellyfin-desktop's macOS build from SDL to the new mpv-owns-window architecture »*.
  Message de `e47d468` : *« mpv owns the HWND with its native Vulkan swapchain; CEF shared
  D3D11 textures are composited above via DirectComposition … Removed dependencies: SDL3,
  Vulkan SDK, OpenGL (… mpv handles Vulkan internally …) Deleted ~19k lines of old
  SDL-based architecture »*.
- **Ère 3** : principe gravé dans `AGENTS.md` : *« mpv owns its own window + GPU; libmpv
  is used only for the control plane (properties/commands/events) »*.
- `2b9453a` (« Update docs ») retire en même temps de `CLAUDE.md` la ligne SDL3 **et** les
  quatre lignes « Custom libmpv gpu-next path » : les deux disparaissent ensemble.

Dès que la fenêtre est celle de mpv, SDL n'a plus rien à gérer : ni fenêtre, ni surface,
ni contexte. Il reste l'entrée et la boucle, que chaque plateforme refait en natif.

**Pourquoi ce choix (inféré, [S]) :** maintenir un backend Render API gpu-next/Vulkan dans
un fork, plus quatre couches vidéo maison (MoltenVK, sous-surface Wayland, DComp, EGL/X11),
coûtait cher. Le VO natif de mpv apporte gratuitement la synchro d'affichage, le HDR
(`target-colorspace-hint=yes`) et la mesure de la fréquence d'écran. Indice [V] : `892ce4c`
utilise `display-fps` de mpv, *« which monitors the display natively on all platforms »*,
pour régler `windowless_frame_rate` de CEF.

#### 1.2 Les frictions concrètes avec SDL3, tracées dans l'ère 1

Elles existaient **sur les trois systèmes, macOS compris** :

**macOS**
- **La boucle d'évènements ne servait pas Mojo.** `6042583` : *« Mojo IPC (used by CEF for
  frame delivery) uses CFRunLoop sources. SDL_WaitEvent doesn't pump these, causing frames
  to queue until mouse input. »* Suivent `2b01525` (passage à la boucle NSApplication),
  puis la ré-introduction d'un réveil `SDL_PushEvent` + `SDL_AddTimer` dans
  `App::OnScheduleMessagePumpWork` (`E1/src/cef/cef_app.cpp:69-91`,
  `E1/src/main.cpp:628-631`, attente `SDL_WaitEvent` à `main.cpp:1817`).
- **Le redimensionnement modal.** La boucle de live-resize d'AppKit bloque la boucle SDL. Il
  a fallu un `SDL_AddEventWatch` qui pompe CEF (`App::DoWork()`) et recompose sur
  `SDL_EVENT_WINDOW_EXPOSED`, avec `presentsWithTransaction` (`f53d84b` ;
  `E1/src/main.cpp:1529-1582`).
- **La classe NSApplication.** CEF exige une `NSApplication` conforme à `CefAppProtocol`,
  créée **avant `SDL_Init`** (`E1/src/platform/macos_app.mm:1-2, 101-104`). `terminate:`
  devait être détourné en `SDL_EVENT_QUIT` (lignes 91-97).
- **Le clavier traduit depuis les keycodes SDL.** Toute une série de commits pour
  retrouver les codes natifs : `2d6a0f4` (*« map all digit keys to kVK codes in
  sdlKeyToMacNative »*), `7806211`, `54ebe6e`. Ce dernier : quand `character` et
  `unmodified_character` valent 0, CEF fabrique un `NSEventTypeFlagsChanged`, ce qui
  *« [breaks] the key entirely »*.
- **Le défilement trackpad.** `fda1964` regroupe par image, avec
  `EVENTFLAG_PRECISION_SCROLLING_DELTA`. La PR #64 « native wheel event » a été fusionnée
  puis **revertée** (`e5de839`).
- **Le cadencement.** `4d0952e` : avec 2 drawables, `nextDrawable` bloque une vsync. La
  boucle se cale alors à 60 i/s et ProMotion ne monte jamais à 120 Hz : *« (feedback
  loop) »*.

**Wayland** — `docs/resize_investigation.md` (`git show ca7f776:docs/resize_investigation.md`) :
- contrainte posée *« No modifications to SDL source (third_party/sdl_src/) - explicitly
  forbidden »* ;
- l'approche « event watch » échoue car *« the actual wl_surface_commit from libdecor may
  happen at a different point in SDL's internal flow »* ;
- `wp_viewport_set_destination` posé par SDL est cité parmi les suspects.

La cause finale trouvée est côté CEF : des images partiellement rastérisées, aux pixels de
bord transparents. Mais SDL masquait qui commitait quoi et quand.

**Windows** — *« the Win32 modal resize loop blocks our main event loop »*
(`E1/src/main.cpp:1587-1589`), d'où un second event watch.

#### 1.3 Spécifique à Wayland/Windows, ou aussi macOS ?

- **Aussi macOS.** Le portage macOS (`11ad581`) a été fait **le même jour** que la
  réécriture Wayland, et SDL n'a été gardé que pour Windows, une semaine (*« SDL3/Vulkan
  gated to Windows only … Old SDL files retained for Windows (not yet transitioned) »*).
- **Le HDR n'était pas le blocage sur Mac.** L'ère 1 avait déjà une couche vidéo EDR :
  `RGBA16Float`, `wantsExtendedDynamicRangeContent`, `kCGColorSpaceExtendedLinearSRGB`
  (`E1/src/platform/macos_layer.mm:59-66`). Le README de l'époque annonçait *« HDR
  passthrough (Linux Wayland, macOS, Windows) »*.
- **Ce qui pesait sur Mac** : l'intégration de boucle (Mojo, live-resize), la saisie, et le
  coût de posséder la chaîne vidéo MoltenVK. Note en commentaire, `macos_layer.mm:71` :
  *« presentsWithTransaction doesn't work well with Vulkan/MoltenVK »*. Pas de commentaire
  « SDL ne sait pas faire X sur Mac » au sens strict : SDL3 était surtout un
  **intermédiaire qu'il fallait contourner partout**.

---

### C.2 Le compositeur macOS de l'ère 2 (`11ad581` → `040f38c`)

#### 2.1 Qui possède quoi

```
NSWindow (créée par mpv : VO mac/Swift, MoltenVK)
└─ contentView (vue de mpv ; sa layer = la CAMetalLayer de mpv → VIDÉO, EDR géré par mpv)
   ├─ NSView g_main.view    → CALayer « main » (jellyfin-web)        [au-dessus de la vidéo]
   ├─ NSView g_overlay.view → CALayer « overlay » (choix du serveur)  [au-dessus de main]
   └─ CefInputView / input view (transparente, first responder)        [tout en haut]
```

- **La fenêtre.** Récupérée en parcourant `[NSApp windows]` jusqu'à une fenêtre visible
  (`E2/src/platform/macos.mm:427-440`). mpv vit dans le même processus : pas de hook du
  fork côté Mac, à la différence de Wayland, qui lit `wayland-state` (struct de callbacks,
  `99bf6c6:src/platform_wayland.cpp`).
- **Le bouton de fermeture.** `windowShouldClose:` est swizzlé, car mpv l'enverrait dans
  son système d'entrée, désactivé (`macos.mm:442-453`).
- **L'empilement.** Les couches web sont des **sous-vues de la contentView de mpv**,
  ordonnées par `addSubview:positioned:NSWindowAbove relativeTo:` (`macos.mm:519-534`).
  Ce ne sont ni une fenêtre enfant ni une couche sœur hors de l'arbre de vues. La vidéo est
  donc la layer de la contentView elle-même, sous toutes les sous-vues.
- **Le fond.** `#101010` est peint à trois niveaux : `NSWindow.backgroundColor`, la layer de
  mpv, les layers CEF. Il cache le drawable non initialisé de mpv avant la première image
  CEF (`macos.mm:474-493`). Il repasse au noir à la révélation (`reset_background_to_black`,
  lignes 573-579).

#### 2.2 Évolution du chemin de présentation (le point le plus instructif)

1. **`11ad581`** [V] : deux `CAMetalLayer` BGRA8, `framebufferOnly`, `opaque=NO`. À chaque
   `OnAcceleratedPaint` : `nextDrawable` → passe Metal qui prémultiplie → `presentDrawable`
   (`11ad5815/src/platform_macos.mm:319-362, 366-389`).
2. **`9954a71`** [V] : *« Switch the Metal compositor from CAMetalLayer (nextDrawable
   blocks on vsync) to a 3-slot IOSurface pool with straight-to-premultiplied alpha
   conversion, assigned as plain CALayer contents — fully non-blocking. »* Résultat final
   (`E2/src/platform/macos.mm:79-112, 280-337`) :

   ```
   IOSurface CEF (BGRA8, alpha DROIT) ──wrap MTLTexture──▶ passe Metal (rgb *= a)
     ──▶ notre IOSurface (pool de 3, round-robin) ──▶ layer.contents = surface
         dans un CATransaction, setDisableActions:YES
   ```

   - **L'alpha** : *« CEF's OSR pipeline delivers a BGRA8 IOSurface in STRAIGHT alpha … CoreAnimation
     expects premultiplied contents … would composite the edges too bright »* (référence
     Chromium citée lignes 79-85). Pipeline **sans blending** : la cible est écrasée en
     entier (lignes 504-512).
   - **La synchro** : `contents` est assigné **juste après `commit`**, sans attendre le GPU.
     *« Metal tracks IOSurface hazards across GPU contexts … No explicit fence /
     completion handler / main-queue hop needed, and typing latency drops »* (lignes
     325-335).
   - **Le pool de 3** : la cible réécrite a toujours au moins 2 images d'âge, donc le
     render-server n'est plus en train de la lire (lignes 109-112).
   - **Le découplage** : copier dans **nos** IOSurfaces libère celles de CEF dès le retour
     du callback, ce qui règle la durée de vie.
3. **`627f6e8`** : remplacement de `CVDisplayLink` (déprécié) par `CADisplayLink`. Les deux
   versions de `ensure_pool`/`wrap_input_surface` (re-wrap quand l'identité de l'IOSurface
   change) sont aux lignes 216-272.

#### 2.3 Colorimétrie : couche web vs couche vidéo

- **Couche web** : BGRA8 non-float, **aucun réglage EDR ni de colorspace** sur les
  `CALayer`. Elle est donc composée comme du SDR [V par absence]. Sur un écran EDR,
  CoreAnimation place le blanc SDR au blanc de référence pendant que la layer de mpv monte
  au-delà [S, comportement CA standard].
- **Couche vidéo** : entièrement à mpv/MoltenVK, via `target-colorspace-hint=yes`
  (`E2/src/main.cpp:503`). L'app n'y touche que pour la couleur de fond. Commentaire :
  *« mpv only resets it from its `isOpaque` setter (metal_layer.swift:87) »*
  (`macos.mm:480-483`).

#### 2.4 Cadencement, 120 Hz, BeginFrame

- `external_begin_frame_enabled = true` sur macOS seulement (`E2/src/main.cpp:757-770`) :
  *« drive BeginFrames from CVDisplayLink, aligned with display vsync. Eliminates the phase
  lag from CEF's internal 60Hz BeginFrame timer »*.
- Une cible `CADisplayLink` sur `[[g_window screen] displayLinkWithTarget:selector:]`,
  ajoutée en `NSRunLoopCommonModes`. À chaque tick, elle appelle `SendExternalBeginFrame()`
  sur chaque browser (`macos.mm:379-421`). Sans elle, *« CEF produces no frames at all »*
  (lignes 559-565).
- `windowless_frame_rate` = `display-fps` de mpv, mis à jour à chaud par
  `SetWindowlessFrameRate()` (`892ce4c`).

#### 2.5 Boucle de messages CEF

- macOS : `external_message_pump = true`. Linux : `multi_threaded_message_loop`
  (`E2/src/main.cpp:665-669`).
- **La boucle principale** est `[NSApp run]` (`macos.mm:782-795`). Elle sert tous les modes
  de run loop, *« default, event-tracking during drag, modal panels »*. Cela règle **sans
  hack** le live-resize de l'ère 1.
- **Le réveil** : un `CFRunLoopSource` (travail immédiat) et un `CFRunLoopTimer` (travail
  différé), tous deux en `kCFRunLoopCommonModes`. Ils sont installés **avant
  `CefInitialize`**, car le premier `OnScheduleMessagePumpWork` arrive pendant l'init
  (`E2/src/cef/cef_app.cpp:394-406`, `main.cpp:708-715`).
- **L'heuristique anti-coincement** (`cef_app.cpp:249-345`). `MessagePumpExternal::Run`
  coupe après 10 ms même s'il reste du travail immédiat. Le `WorkDeduplicator` reste alors
  en `kDoWorkPending` et **avale** les `ScheduleWork` suivants. Si
  `CefDoMessageLoopWork()` a duré plus de 10 ms, on re-signale la source. C'était la cause
  du *« pump wedge »* corrigé par `9954a71`.
- **Démarrage** (`E2/src/main.cpp:520-536`) : `force-window=yes` (pas `immediate`) et
  `idle=yes`. Le VO Mac fait `DispatchQueue.main.sync`, ce qui interblocquerait un
  `mpv_initialize` lancé depuis le thread principal. Il ne faut **aucun
  `mpv_get_property` synchrone** pendant l'attente du VO (`11ad581`).
- **Mode mono-processus** : `--single-process` sur macOS (`e6e2c88`). Les sous-processus
  CEF ne terminent pas leur poignée de main sous macOS 26 (*« MachPortRendezvous
  incompatibility »*). S'y ajoutent `use-mock-keychain` et `password-store=basic`
  (`7e39bdd`), contre le prompt du trousseau à chaque lancement (app signée ad hoc).

#### 2.6 Redimensionnement

- Les `CALayer` suivent leur NSView par autoresizing. `contentsGravity = kCAGravityTopLeft`,
  et toutes les actions implicites sont coupées : `bounds`, `position`, `contents`,
  `anchorPoint`, `contentsRect` (`macos.mm:343-371`). C'est l'application de la règle
  `CLAUDE.md` : *« No texture stretching during resize … Gaps from stale texture sizes are
  acceptable; stretching is not. »*
- `macos_resize` est **vide** : le pool est recréé dès que CEF livre à une nouvelle taille
  (lignes 610-616).
- Un **portail de transition** (plein écran) jette les images de « main » tant qu'aucune
  n'arrive à la taille attendue (`macos_present`, lignes 581-600 ; `set_expected_size`,
  713-716).
- La taille vient de `osd-dimensions` de mpv. Sur Mac, la taille **logique** est lue à la
  `contentView` (`macos_query_logical_content_size`, 723-729).

#### 2.7 Saisie, curseurs, plein écran

- **La vue de saisie** : une NSView transparente au-dessus de tout. Elle est mise en
  `makeFirstResponder:`, sinon c'est la vue de mpv qui reçoit les touches, avec
  `acceptsMouseMovedEvents = YES` (`macos.mm:531-544`).
- **Le focus** passe d'un browser à l'autre au changement de couche
  (`macos_set_overlay_visible`, 618-636).
- **Les pièges corrigés ensuite** :
  - `6ac60fd` : remplir **toujours** `character`/`unmodified_character` sur keydown/keyup,
    sinon Backspace/Tab agissent deux fois (FlagsChanged synthétique) ;
  - `734c1eb` : ajouter `EVENTFLAG_*_MOUSE_BUTTON` aux modificateurs pendant un glisser ;
  - `0d81dbf` : ne cacher le curseur (`[NSCursor hide]`) que si la souris est **dans** la
    vue, avec réapplication sur `mouseEntered`/`mouseExited`.
- **Pas d'IME** : aucun `NSTextInputClient` ni `ImeSetComposition` dans
  `E2/src/input/input_macos.mm`.
- **Le plein écran** est délégué à mpv (`g_mpv.SetFullscreen`, `macos.mm:688-696`).
- **Le fondu de l'overlay** : `CABasicAnimation` sur `opacity`, fondu côté CA sans
  repeindre CEF (638-686).

---

### C.3 L'ère Rust (main, `1b73a13`)

**Avertissement de fiabilité** [V] : plusieurs commits disent explicitement que le code
macOS n'a **pas été compilé ni testé sur Mac** :
- `fe975d4` : *« Windows and macOS are updated but not compiled »* ;
- `a575268` : *« Compile-unverified on this Linux host; needs a macOS build »* ;
- `a21fbca` : *« the one threading claim this pass cannot check without a Mac »*.

Pour le Mac, **l'ère 2 est la référence éprouvée** ; l'ère 3 donne surtout une
architecture propre.

#### 3.1 Les crates

| Crate | Rôle |
|---|---|
| `src/macos` | Backend `Platform` : init (fenêtre mpv, swizzle, vue de saisie, CADisplayLink), `cef_pump.rs` (pompe externe), `compositor.rs` (une NSView + `CAMetalLayer` par surface), `input.rs` (`JellyfinInputView`), `mpv_host.rs`, menus |
| `src/gpu_paint` | **Seul endroit qui connaît wgpu** (`fe975d4`). Importeurs de textures partagées (`shared/metal.rs` IOSurface, `vulkan.rs` dmabuf, `dx12.rs`), painter, swapchain, cadence d'écran (`refresh.rs`) |
| `src/compositor_core` | Logique pure testable : `SurfaceStack` (ordre bas→haut, ensemble vivant), `TransitionGate` (portail resize/plein écran) |
| `src/jfn_cef` | Frontière CEF : settings, switches par plateforme, `accel.rs` (décodage `OnAcceleratedPaint`), `paint_scheduler.rs`, `frame_rate.rs` |
| `src/macos_sink` | Now Playing / `MPRemoteCommandCenter` |
| `src/color` | **Seulement du parsing de couleurs** CSS/mpv et la couleur de thème de la fenêtre (`theme.rs`). **Aucune gestion colorimétrique ni EDR** |

#### 3.2 Couches et empilement macOS

- **Toujours la fenêtre de mpv.** Elle est attendue en bloquant la run loop sur ses
  sources, avec un plafond de 5 s (`E3/src/macos/src/init.rs:654-697`). Puis :
  swizzle de `windowShouldClose:` (698-760), barre de titre transparente plus
  `FullSizeContentView` (793-799), fond `0x101010` (808-813), vue de saisie ajoutée et
  `makeFirstResponder` (815-828).
- **Une surface par couche CEF.** Chaque surface est une `NSView` + **`CAMetalLayer`**,
  sous-vue de la contentView de mpv, sans actions implicites
  (`E3/src/macos/src/compositor.rs:152-211`).
- **L'ordre** est réappliqué par `macos_apply_stack`, avec la vue de saisie
  **systématiquement remise au sommet** (491-556). La vidéo reste la layer de mpv,
  dessous.
- **Retour à `CAMetalLayer`** (`a21fbca`, *« Put the macOS compositor on wgpu »*). wgpu
  configure le device, le format, l'espace de couleur et la taille du drawable. Configurer
  *est* une mutation de `CAMetalLayer`, donc uniquement sur le thread principal :
  `ConfigureSite::Owner`, `E3/src/gpu_paint/src/painter.rs:105-130`.

#### 3.3 Présentation, alpha, couleur

- **La présentation est inline, dans le callback CEF, sur le thread principal**. C'est
  aussi le thread UI de CEF en pompe externe (`compositor.rs:316-384`). Un avertissement
  « une seule fois » se déclenche si un present arrive hors thread principal.
- **Il n'y a pas de copie dans un pool à soi** comme en ère 2. On importe l'IOSurface en
  `MTLTexture` (cache d'une seule entrée, clé = adresse **et** taille), on dessine dans le
  drawable, on présente (`gpu_paint/src/shared/metal.rs:40-157`). La clé inclut la taille
  parce que CEF rend la même adresse à une autre taille après un relayout.
- **Alpha** : `AlphaSource::Straight` pour `CoreAnimationLayer`. Le shader
  `fs_main_premultiplied` fait `rgb * a` (`overlay.wgsl:30-37` ; `painter.rs:56-76`).
  Motif : *« metal offers only PostMultiplied and Opaque »*. Le mode composite est choisi
  dans l'ordre PreMultiplied, PostMultiplied, Inherit, Opaque (`painter.rs:811-817`).
  Petite incohérence de commentaire : `painter.rs:60` dit « premultiplied, which is what
  CEF delivers » pour les autres cibles, alors que l'ère 2 établit que l'OSR CEF livre de
  l'alpha droit sur Mac.
- **Format** : `FORMAT = Bgra8Unorm` (`gpu_paint/src/context.rs:11`). La couche web est donc
  SDR, sans EDR. Seule mpv fait de l'EDR.
- **Présentation et latence** : `PresentPolicy::Fifo` et `desired_maximum_frame_latency: 2`
  (`painter.rs:80-104`, `swapchain.rs:54-63`).
  - Garde-fou essentiel (`painter.rs:294-311`) : *« metal::Surface::configure clears
    allowsNextDrawableTimeout unconditionally, and on macOS nextDrawable runs on the main
    thread — the runloop, the CEF pump and input. Unbounded there wedges the app »*. Le
    code remet donc `allowsNextDrawableTimeout = YES` après chaque configure.
  - C'est la leçon `9954a71` de l'ère 2, contournée autrement.
- **Taille** : `SizePolicy::FollowTarget`. La taille du drawable suit la fenêtre (posée par
  le propriétaire), pas l'image. *« a frame smaller than the target leaves a transparent
  strip, a larger one is clipped »* (`painter.rs:20-53`).
- **Le resize** : `macos_surface_resize` pose `setFrame` et `contentsScale`, puis
  `painter.resize`, le tout sur le thread principal en asynchrone
  (`compositor.rs:427-459`).
- **La visibilité** : un `CATransaction` begin/commit/**flush** explicite
  (`compositor.rs:469-489`).

#### 3.4 mpv : sa propre fenêtre, son propre GPU

- **Les options mpv** (`E3/src/mpv/src/boot.rs:113-165`) :
  - `osc=no`, `osd-level=0` ;
  - toute entrée coupée (`input-default-bindings`, `input-vo-keyboard`, `input-cursor`,
    `cursor-autohide=no`) ;
  - `keepaspect-window=no`, `auto-window-resize=no` ;
  - `force-window=yes` + `idle=yes`, avec le même commentaire sur l'interblocage Mac ;
  - `config=yes`, pour que le `mpv.conf` de l'utilisateur soit lu.
- **Le VO** : `vo`/`gpu-api` n'y sont plus posés explicitement. On compte sur les défauts
  du fork ou sur `mpv.conf` [S]. L'ère 2 posait `gpu-next`/`vulkan`.
- **L'environnement** (`E3/src/macos/src/mpv_host.rs:36-63`) :
  - `MPVBUNDLE=true` ;
  - `MVK_CONFIG_USE_MTLHEAP=0` **seulement** si le GPU n'a pas la famille Metal `Mac2`
    (vieux Intel Iris Pro). Sinon le driver plante au premier upload libplacebo.
- **L'attente du VO** (`mpv_host.rs:66-85`) : un callback de réveil mpv réveille la run
  loop principale, et on n'attend jamais dans `mpv_wait_event`, qui affamerait la run loop.

#### 3.5 Boucle CEF, BeginFrame, fréquence

- `jfn_cef/src/ffi.rs:123-135` : `external_message_pump` si la plateforme fournit un
  `CefHost` (macOS), sinon `multi_threaded_message_loop`. `pump_init()` est appelé **avant**
  `CefInitialize`.
- `cef_pump.rs` reprend **mot pour mot** la pompe de l'ère 2 : `CFRunLoopSource` +
  `CFRunLoopTimer` en common modes, et seuil de 10 ms (*« preserved verbatim because it's
  tied to a specific CEF version's WorkDeduplicator internals »*, lignes 8-9, 37-48).
- **`CADisplayLink`** (`init.rs:401-458`) :
  - forcé `setPaused:NO` ;
  - ajouté en common modes **et** en default mode, *« belt and braces »* ;
  - **reconstruit** sur `NSWorkspaceDidWake` et `NSApplicationDidChangeScreenParameters`
    (`init.rs:474-481, 554-560`) : *« after display sleep or a screen reconfiguration that
    display goes away under it and the link stops ticking, so external BeginFrame stalls …
    the UI looks frozen »*.
  - Le tick appelle le driver installé par l'app : `overlay.send_external_begin_frame()`
    (`jfn_rust/src/app.rs:840-845`).
- `windowless_frame_rate` vient de la fréquence d'écran, en millihertz arrondis
  (`jfn_cef/src/frame_rate.rs`). Pendant un resize, le `paint_scheduler` **double** la
  cadence (`BOOST_MULTIPLIER = 2`).
- Il injecte aussi un « paint nudge » JS : boucle `requestAnimationFrame` sur `resize`,
  arrêtée par `__cefStopRaf`, pour que CEF continue de produire des images jusqu'à
  stabilisation (`paint_scheduler.rs:15-45, 260-300`).
- **Switches macOS** (`ffi.rs:66-73`) : `single-process`, `use-mock-keychain`,
  `password-store=basic`.

#### 3.6 Saisie, curseurs, plein écran, barre de titre

- **`JellyfinInputView`** (`E3/src/macos/src/input.rs:284-470`) :
  - `isFlipped`, `acceptsFirstResponder`, non opaque ;
  - `NSTrackingArea` (`MouseMoved | EnteredAndExited | ActiveInKeyWindow | InVisibleRect`) ;
  - `hitTest:` renvoie `nil` dans la bande de titre (lignes 300-311), pour que le cadre
    AppKit gère nativement le glisser et le double-clic.
- **Défilement** : `hasPreciseScrollingDeltas` → `scrollingDeltaX/Y`, sinon
  `deltaX/Y`, puis accumulation et vidage sur le thread principal (400-429).
- **Clavier** :
  - `keyDown:` envoie le `KeyReport` complet (`character`, `unmodified_character`, code
    natif) **puis** chaque unité UTF-16 de `characters` comme caractère
    (`dispatch_characters`, 626-640) ;
  - `flagsChanged:` est traité à part.
  - **Toujours pas d'IME** : aucun `NSTextInputClient`, `insertText:`, `setMarkedText:` ni
    `interpretKeyEvents:`. Cela concorde avec le constat du plan Tentacle (« Jellium : IME
    illisible »).
- **Curseurs** : correspondance des formes CEF vers `NSCursor` (205-226), `hide`/`unhide`
  appliqués sur le thread principal.
- **Plein écran** : délégué à mpv (`backend.rs:182-201`).

---

### C.4 macOS ère 1 → ère 2 : ce qui change

| Sujet | Ère 1 (`macos_layer.mm`, `metal_compositor.mm`, `macos_app.mm`) | Ère 2 (`platform/macos.mm`) |
|---|---|---|
| Fenêtre | SDL3 (`SDL_PROP_WINDOW_COCOA_WINDOW_POINTER`) | mpv (`[NSApp windows]`) |
| Vidéo | **NSView à nous**, au fond (`NSWindowBelow`) + `CAMetalLayer` RGBA16F EDR ext-linear-sRGB. Instance/device/swapchain Vulkan **à nous** via MoltenVK. mpv par la Render API, **rendu sur le thread principal** dans la boucle (`E1/src/main.cpp:2266-2282`) | Layer de la contentView de mpv : VO natif, EDR et colorspace gérés par mpv |
| Couche web | `CAMetalLayer` BGRA8 `opaque=NO`, **3 drawables** pour ProMotion (`metal_compositor.mm:105-114`). Blending prémultiplié `One / OneMinusSrcAlpha` et `rgb*=a` (46-56, 170-175). Async `presentDrawable`, ou `presentsWithTransaction` + `waitUntilScheduled` pendant le live-resize (442-451) | `CALayer.contents` = nos IOSurfaces prémultipliées (pool de 3). Non bloquant, sans `CAMetalLayer` |
| IOSurface CEF | `CFRetain`, file d'attente, import sur le thread principal ; saut si même `IOSurfaceID` **et même seed** (`IOSurfaceGetSeed`, 268-388) | Wrap direct dans le callback ; re-wrap si l'identité change |
| Cadence | `SDL_WaitEvent`, réveil CEF par `SDL_PushEvent`, `SDL_AddTimer` ; BeginFrame interne de CEF à 60 Hz ; `windowless_frame_rate` = mode SDL | `[NSApp run]` + CFRunLoopSource/Timer ; `external_begin_frame` piloté par CVDisplayLink puis CADisplayLink ; fps = `display-fps` de mpv |
| Live-resize | `SDL_AddEventWatch` + `DoWork()` sur EXPOSED + `presentsWithTransaction` | Common modes du run loop ; gravité TopLeft ; trous acceptés |
| NSApplication | `JellyfinApplication` créée **avant `SDL_Init`** ; `terminate:` → `SDL_EVENT_QUIT` ; `TitlebarDragView` posée au-dessus pour la barre transparente (`macos_app.mm:30-50, 151-174`) | Même classe CEF, `finishLaunching` explicite ; `terminate:` → `initiate_shutdown` |
| Clavier | Évènements SDL → `sdlKeyToMacNative`/`sdlKeyToMacChar` | NSEvent directement dans la vue de saisie |

**Point clé pour un proto SDL3** : l'ère 1 prouve que l'on peut faire coexister SDL3, CEF
OSR et une couche Metal EDR dans la fenêtre SDL. Elle montre aussi les rustines
nécessaires :
- classe d'application pré-SDL ;
- réveil CEF ;
- event watch de live-resize ;
- 3 drawables ;
- correspondance des touches.

---

### C.5 Ce que dit `LECTEUR-BUREAU-HDR-PLAN.md` (Tentacle) d'utile ici

Le plan est **en pause** depuis le 24.10.2026. Il retient Electron et une couche vidéo
native dans la fenêtre, et classe le « modèle Jellium » en plan B.

#### S2 — couche Metal dans la fenêtre (retenue)

- **La couche et le moteur** : une `CAMetalLayer` **à nous**, où mpv gpu-next dessine par
  le **contexte `moltenvk` de MPVKit** (`wid` = la couche, ~96 lignes, en production chez
  Flixor) [V].
- **Environ 50 lignes à nous** [S] :
  - une option de taille pour déclencher le redimensionnement, comme
    `d3d11-composition-size`, car le contexte n'en transmet aucun ;
  - la pose de l'EDR et du colorspace côté hôte.
- **La couleur** : **MoltenVK pose seul `ITUR_2100_PQ`/HLG, l'EDR et les métadonnées
  HDR10** quand libplacebo choisit une sortie HDR [V]. Le DV 5 est rendu par libplacebo
  [S fort].
- **Le verre** : l'EDR tient sous un verre natif dans la même fenêtre (banc A0 : 8,72/16)
  [V].
- **Risques** :
  - deux correctifs libmpv, licence à vérifier ;
  - `wantsExtendedDynamicRangeContent` **déprécié en macOS 26** au profit de
    `preferredDynamicRange`, et MoltenVK devra suivre.
- **Moteur de rechange** : `vo=avfoundation` (EDR, PQ, HLG, DV 8.1), mais DV 5 faux et
  correctif sous GPL v3.

#### S7 — « posséder la fenêtre (CEF hors écran, modèle Jellium) », plan B

- **Le pipeline jugé le meilleur** : mpv possède fenêtre et GPU, l'UI OSR est composée
  par-dessus. HDR natif partout, GNOME fenêtré compris [V].
- **Le prix** :
  - saisie, IME, menus déroulants, DPI et accessibilité à refaire (Jellium : IME
    illisible, six tickets menus, souris cassée au changement de DPI) ;
  - Mac App Store incertain ;
  - épuisement du développeur.

#### § 1 et § 7, points pertinents pour CEF OSR

- **En build MAS, la page Chromium arrive en UNE IOSurface sans EDR** : la couche web ne
  porte pas de HDR, seule la couche vidéo sœur le peut [V].
- WKWebView plafonne à 60 i/s, mesuré sur M4 120 Hz.
- **Non vérifié (§ 7)** :
  - le contexte `moltenvk` dans l'app : ordre des couches, DV 5, énergie ;
  - le rAF à 120 Hz, déduit de `CVDisplayLink` ;
  - la composition d'une vue sœur en MAS ;
  - la licence MPVKit.

#### Lecture croisée

Le plan S2 et l'ère 1 de Jellium convergent sur le même montage macOS : **notre
`CAMetalLayer` EDR sous une couche web SDR, dans notre fenêtre**. Jellium l'a abandonné au
profit de « mpv possède la fenêtre » pour des raisons de coût de maintenance et de boucle,
**pas de rendu**. Un proto SDL3 + CEF OSR + Metal EDR reprend donc l'ère 1, en y
injectant les leçons de l'ère 2 :
- pompe CFRunLoop ;
- présentation non bloquante ;
- `CADisplayLink` → BeginFrame externe ;
- alpha droit → prémultiplié ;
- vue de saisie native.

---

### C.6 Recommandations (sous-agent) pour un proto SDL3 + CEF OSR + couche Metal EDR sur macOS

1. **NSApplication CEF avant SDL.** Instancier une sous-classe `NSApplication` conforme à
   `CefAppProtocol` (`isHandlingSendEvent`/`setHandlingSendEvent`, `sendEvent:` sous
   `CefScopedSendingEvent`) **avant `SDL_Init`**, comme `E1/src/platform/macos_app.mm:101-104`.
   SDL3 réutilise alors `NSApp` [S : vérifier dans `SDL_cocoaevents.m` que rien ne repose
   sur `SDLApplication`]. Router `terminate:` vers un arrêt propre, jamais `exit()`.
2. **Arbre de vues dans la fenêtre SDL** (`SDL_PROP_WINDOW_COCOA_WINDOW_POINTER`) :
   - contentView layer-backed ;
   - en bas, une NSView + `CAMetalLayer` **vidéo** (EDR) ;
   - au-dessus, une NSView + couche **web** ;
   - tout en haut, une NSView de saisie, ou bien la vue SDL elle-même (voir 8).
   - Sur chaque layer : `actions` à `NSNull` (`bounds`, `position`, `contents`,
     `anchorPoint`, `contentsRect`), `contentsGravity = TopLeft`, `contentsScale =
     backingScaleFactor`.
3. **Couche vidéo** :
   - `RGBA16Float`, `wantsExtendedDynamicRangeContent = YES`, ou `preferredDynamicRange`
     sur macOS 26 ;
   - colorspace adapté (extended linear sRGB/P3, ou PQ si la swapchain MoltenVK pose
     `HDR10_ST2084`) ;
   - le plus simple est de laisser MoltenVK/libplacebo le poser, comme dans le plan S2 [V
     dans le plan] ;
   - présentation **hors thread principal**, alors que l'ère 1 rendait la vidéo dans la
     boucle principale.
4. **Couche web SDR** : BGRA8, `opaque = NO`, colorspace sRGB. **Ne pas** la passer en EDR,
   l'IOSurface CEF est 8 bits sRGB. Deux variantes éprouvées :
   - **(a) ère 2** : passe Metal qui **prémultiplie** dans **nos** IOSurfaces (pool de 3),
     puis `layer.contents = surface` sous `CATransaction` + `setDisableActions:YES`. C'est
     totalement non bloquant et ça libère l'IOSurface CEF au retour du callback.
   - **(b) ère 1/3** : `CAMetalLayer` avec 3 drawables, `allowsNextDrawableTimeout = YES`,
     shader `rgb *= a`.
5. **Boucle CEF** :
   - `external_message_pump = true` ;
   - `CFRunLoopSource` (immédiat) et `CFRunLoopTimer` (différé) en
     **`kCFRunLoopCommonModes`**, installés **avant `CefInitialize`** ;
   - copier l'heuristique des 10 ms (`E3/src/macos/src/cef_pump.rs`) ;
   - **ne pas** faire de `SDL_WaitEvent` le seul point de blocage. Soit `[NSApp run]` en
     traitant les évènements SDL via `SDL_PumpEvents` depuis une source ou un observer,
     soit `CFRunLoopRunInMode` + `SDL_PumpEvents` [S : à valider sur banc, notamment pendant
     le live-resize].
6. **BeginFrame** : `external_begin_frame_enabled = true` et `windowless_frame_rate` = la
   fréquence réelle (120). `CADisplayLink` via `-[NSScreen displayLinkWithTarget:selector:]`
   (macOS 14+) en common modes, qui appelle `SendExternalBeginFrame()`. Le **reconstruire**
   après réveil et changement d'écran.
7. **Resize** :
   - 1:1 sans étirement ;
   - redimensionner les layers dans le même tick que la fenêtre ;
   - pousser CEF à rafraîchir pendant le drag (`WasResized` + `Invalidate`, cadence
     doublée, « paint nudge » rAF) ;
   - portail « taille attendue » pour le plein écran ;
   - le live-resize doit être servi par les common modes, pas par un event watch.
8. **Saisie** : idéalement une NSView native first responder, qui implémente
   **`NSTextInputClient`** (`insertText:`, `setMarkedText:`, `firstRectForCharacterRange:`)
   vers `ImeSetComposition`/`ImeCommitText`. **Aucune ère de Jellium ne l'a fait.** Si l'on
   garde SDL pour la saisie, gérer **aussi** `SDL_EVENT_TEXT_EDITING`, que l'ère 1 ignorait.
   Dans tous les cas :
   - toujours remplir `character`/`unmodified_character` ;
   - ajouter les drapeaux de bouton souris pendant un glisser ;
   - défilement précis (`hasPreciseScrollingDeltas`) regroupé par image ;
   - `acceptsMouseMovedEvents`, `NSTrackingArea` ;
   - barre de titre transparente laissée en click-through par `hitTest:`.
9. **Switches CEF Mac** : `--single-process` si macOS 26 bloque les sous-processus
   (MachPortRendezvous), `--use-mock-keychain`, `--password-store=basic`. Le bundle doit
   contenir les helpers si l'on reste multi-processus.
10. **mpv dans la couche** : `wid` = la couche (contexte `moltenvk` de MPVKit) ou Render API.
    Rien de synchrone sur mpv depuis le thread principal pendant la création du VO. Pour
    les vieux Intel, `MVK_CONFIG_USE_MTLHEAP=0` si pas de `MTLGPUFamilyMac2`.

### C.7 Pièges

- **`nextDrawable` sur le thread principal** :
  - avec 2 drawables, il bloque une vsync, d'où une boucle calée à 60 Hz et pas de
    ProMotion (`4d0952e`) ;
  - sans timeout, il peut **figer l'app** : configure remet
    `allowsNextDrawableTimeout = NO` (`E3/src/gpu_paint/src/painter.rs:294-311`).
- **Alpha droit** de l'IOSurface CEF composé tel quel par CoreAnimation : bords trop
  clairs (`E2/src/platform/macos.mm:79-85`).
- **Durée de vie de l'IOSurface** : CEF la rend à son pool au retour d'`OnAcceleratedPaint`.
  Il faut copier, ou `CFRetain`, ou consommer dans le callback (`jfn_cef/src/client/accel.rs`).
- **Cache de wrapper par adresse seule** : CEF réutilise la même adresse à une autre taille
  après un relayout (`gpu_paint/src/shared/metal.rs:40-46`).
- **Coincement de `MessagePumpExternal`** au-delà de 10 ms : les `OnScheduleMessagePumpWork`
  suivants sont avalés (`E2/src/cef/cef_app.cpp:249-283`).
- **`nextEventMatchingMask:untilDate:nil`** = `distantFuture` : la boucle reste bloquée pour
  toujours (`7e39bdd`).
- **Mojo et `SDL_WaitEvent`** : des images restent en file jusqu'au prochain évènement
  souris (`6042583`).
- **`CADisplayLink` lié à un écran** : il s'arrête après une mise en veille ou une
  reconfiguration. L'UI semble alors gelée (`E3/src/macos/src/init.rs:474-481`).
- **`force-window=immediate`** + VO Mac (`DispatchQueue.main.sync`) : interblocage dans
  `mpv_initialize` (`E2/src/main.cpp:520-536`).
- **Images CEF partielles pendant un resize** : des tuiles non rastérisées laissent des
  pixels transparents en bordure (`docs/resize_investigation.md`). Il faut accepter les
  trous, pas étirer.
- **Transparence du titre** : sans `hitTest:` click-through, ou une vue de drag dédiée,
  les clics de la barre de titre partent dans CEF.
- **Couche web en EDR** : inutile, l'IOSurface est 8 bits SDR. Le risque est un mauvais
  mapping du blanc SDR [S].
- **`wantsExtendedDynamicRangeContent`** est déprécié en macOS 26 (`preferredDynamicRange`).
- **Le code macOS de l'ère 3 n'est pas compilé sur Mac** (`fe975d4`, `a575268`, `a21fbca`).
  Pour le Mac, il faut prendre l'ère 2 comme référence de comportement.
- **Un seul `MTLDevice` « système »** est supposé (`shared/metal.rs:14-20`). Sur un Mac
  bi-GPU, il faut vérifier que CEF et le compositeur sont sur le même GPU [S].

---

## D. Décisions du socle, et pourquoi

1. **SDL3 garde la fenêtre et la boucle d'évènements**, comme l'a demandé Damien. Rien de
   mesuré ne l'interdit sur macOS. Les deux frictions macOS de l'ère 1 (Mojo servi en
   retard, redimensionnement modal) sont réglées par la pompe CEF ci-dessous, sans quitter
   SDL. Si un point bloque au Jalon 2 (IME, défilement précis), il sera mesuré **avant**
   tout écart.
2. **Pompe CEF dans la run loop Core Foundation** (`shell_message_pump_mac.mm`) :
   `CFRunLoopPerformBlock` pour le travail immédiat et `CFRunLoopTimer` pour le travail
   différé, les deux en `kCFRunLoopCommonModes`.
   - Ça s'exécute pendant `SDL_WaitEvent` (qui fait tourner la run loop), pendant le
     redimensionnement en direct et pendant les menus.
   - Pas d'évènement SDL de réveil. On garde l'heuristique des 10 ms de l'ère 2 contre le
     coincement de `MessagePumpExternal`.
3. **Vrais helpers CEF** (`Tentacle Helper (GPU|Renderer|Plugin|Alerts).app`), un seul
   binaire, signature ad hoc du paquet. Mesuré : le multi-processus fonctionne (B).
4. **Compositeur Core Animation à deux couches**, dans une vue « hôte de couches » qui
   laisse passer les clics (`hitTest → nil`), au-dessus de la vue SDL :
   - `videoContainer` (z=0) reçoit la couche de `VideoSurface::nativeLayer()` ;
   - la page est une `CAMetalLayer` sRGB, BGRA8, non opaque (z=10).
   - La vidéo n'est **jamais** mélangée dans la couche web : l'EDR est accordé à la couche
     HDR elle-même (plan Tentacle S2 et § 7), et le système compose.
5. **Copie de l'IOSurface CEF dans le rappel, sans attente CPU.** La doc de CEF 156 interdit
   de garder la surface (pool) ; attendre coûte 5 à 43 ms (B). Le rendu vue + popup se fait
   dans un drawable, en lecture 1:1. Le popup est mélangé en `One / OneMinusSrcAlpha`, et la
   vue n'est pas re-prémultipliée (B).
6. **Pas de redimensionnement par étirement.** La couche web prend la taille de l'image
   reçue, pas celle de la fenêtre (règle de la référence : *« gaps acceptable, stretching is
   not »*).
7. **IPC générique** au lieu de fonctions V8 nommées :
   - côté page, `invoke(channel, payload) → Promise` et `on(event, cb)` ;
   - un seul `CefProcessMessage` par sens, des charges utiles en JSON texte ;
   - les scripts injectés voyagent dans `extra_info` de `CreateBrowser`, le seul canal qui
     atteint chaque nouveau processus de rendu avant son premier contexte JS ;
   - l'exécution se fait par `CefV8Context::Eval` (synchrone) dans `OnContextCreated`, et
     seulement dans le cadre principal.
