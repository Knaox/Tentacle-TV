# Étude — vidéo HDR/EDR sur macOS dans la référence (jellium-desktop)

Session vidéo-HDR du lot « proto CEF », 03/11/2026. Référence lue en lecture seule :
`~/.cache/tentacle-cef/ref/jellium-desktop` (`main` = `1b73a13`), instantanés
`ref-snap/hdr-34625490` (ère SDL3) et `ref-snap/hdr-11ad5815` (ère compositeur Metal), fork mpv
cloné dans `~/.cache/tentacle-cef/deps/mpv-src` (remotes `origin` = andrewrabert/mpv,
`upstream` = mpv-player/mpv).

Légende : **[V]** lu dans le code ou mesuré ; **[S]** déduit, à prouver au banc.

---

## 1. En une phrase par ère

| Ère | Qui possède la fenêtre | Où mpv dessine | Comment le HDR sort | Fork mpv |
|---|---|---|---|---|
| 1. C++ + CEF + SDL3 (28/12/2025 → `3462549`, 04/04/2026) | SDL3 | une `CAMetalLayer` **de l'hôte**, sous la page, via un swapchain Vulkan/MoltenVK **de l'hôte** ; mpv rend par l'**API de rendu libmpv** (backend Vulkan gpu-next ajouté par le fork) | couche RGBA16F + `ExtendedLinearSRGB` + `wantsExtendedDynamicRangeContent=YES` posés par l'hôte ; mpv forcé en `target-trc=linear`, `target-prim=bt.709`, `target-peak=1000`, `tone-mapping=clip` | **lourd** : 7 commits, +2 615 lignes (`render_vk.h`, `gpu_next/{context,ra,video,libmpv_gpu_next}.c`) [V] |
| 2. compositeur Metal (`11ad581`, 05/04/2026) | **mpv** (sa NSWindow, `vo=gpu-next`, `gpu-api=vulkan` → contexte `macvk`) | sa propre `MetalLayer` (vue de mpv) | ce que fait mpv en amont : `target-colorspace-hint=yes` → libplacebo demande un swapchain PQ → MoltenVK pose `ITUR_2100_PQ` + EDR | rien pour macOS (le seul correctif de l'époque, `fbd9e86`, est Wayland) [V] |
| 3. Rust (`src/macos`, `src/macos_sink`, `src/mpv`…, aujourd'hui) | **mpv** (idem) | idem | **aucune option HDR** : `7627d8d` (15/04) retire `vo`, `gpu-api` et `target-colorspace-hint` (« les défauts de mpv suffisent ») | `jellium-desktop` = `ab0467f` = amont `6444c05` + 3 correctifs d'**entrée** (`input-keyboard`, `input-vo-cursor`, icône Windows), +43 lignes, **rien sur le rendu** [V] |

Le principe actuel de la référence, dans son `AGENTS.md` : « mpv owns its own window + GPU;
libmpv is used only for the control plane ». La page CEF arrive par-dessus : des `CAMetalLayer`
(sRGB, `d55ff73`) ajoutées en sous-vues du `contentView` **de la fenêtre de mpv**, plus une vue
d'entrée transparente tout en haut (`src/macos/src/compositor.rs`, `init.rs`) [V].

## 2. Ère 1 — SDL3 + API de rendu Vulkan (le montage demandé par Damien)

Fichiers : `src/platform/macos_layer.mm`, `src/player/video_stack.cpp`,
`src/compositor/metal_compositor.mm`, conception `docs/plans/2024-12-30-macos-hdr-design.md`
(commit `8397065`).

- **Couche** : `NSView` + `CAMetalLayer` créées par l'hôte dans le `contentView` de la NSWindow
  de SDL3 (`SDL_PROP_WINDOW_COCOA_WINDOW_POINTER`), `addSubview:positioned:NSWindowBelow` → tout
  en bas ; la couche CEF au-dessus. Actions implicites coupées (« jelly effect » au
  redimensionnement). `presentsWithTransaction` « ne marche pas bien avec MoltenVK » [V].
- **Vulkan** : l'hôte crée SA propre instance/device MoltenVK (`VK_EXT_metal_surface`,
  `portability_subset`…), son `VkSurfaceKHR` sur la couche, son swapchain
  (`R16G16B16A16_SFLOAT` + `EXTENDED_SRGB_LINEAR`, FIFO). À chaque image : l'hôte acquiert, passe
  l'image à `mpv_render_context_render` (paramètres Vulkan du fork), présente [V].
- **Couleur** : la couche est **toujours** en EDR linéaire étendu, même en SDR. mpv est forcé en
  linéaire BT.709 avec un pic **fixe** de 1 000 nits et `tone-mapping=clip` [V]. Pourquoi : c'est
  le seul moyen, sans `CAEDRMetadata`, de « passer » du HDR dans une couche linéaire. Prix :
  (a) le pic ne suit pas la marge réelle de l'écran (headroom variable 1 → 16) — au-delà, écrêté
  par le compositeur ; (b) aucune métadonnée HDR10 transmise au système ; (c) la couche réclame
  l'EDR en permanence [S : énergie].
- **Pourquoi c'est parti** : le fork de rendu (2 600 lignes au-dessus de vo_libmpv, non
  fusionnées en amont : l'amont n'a toujours que `render_gl.h` et `render_d3d11.h` au 30/10/2026
  [V]) et la synchronisation hôte ↔ mpv (sémaphores « mpv handles its own sync », recréation du
  swapchain par l'hôte) étaient à porter seuls. Le message de `99bf6c6`/`11ad581` ne cite **aucun
  défaut mesuré de SDL3** : SDL est retiré parce que le nouveau modèle laisse mpv posséder la
  fenêtre, ce qui supprime le fork de rendu [V]. SDL3 n'est donc pas, en soi, un bloqueur.

## 3. Ères 2 et 3 — mpv possède la fenêtre

- **Démarrage** (`11ad581` `main.cpp`, aujourd'hui `src/mpv/src/boot.rs`) : `force-window=yes` +
  `idle=yes` ; **pas** `immediate`, qui crée la fenêtre DANS `mpv_initialize` et bloque sur
  `DispatchQueue.main.sync` pendant que le fil principal est lui-même dans `mpv_initialize`
  (interblocage). Le fil principal pompe GCD jusqu'à ce que la fenêtre de mpv apparaisse, puis
  l'hôte l'adopte (`init.rs` : titre transparent, `FullSizeContentView`, swizzle de
  `windowShouldClose:`, vue d'entrée) [V].
- **Règle d'or** : jamais d'appel synchrone à mpv depuis un rappel d'évènement ni pendant
  l'attente du VO (verrou de dispatch → interblocage) ; tout part des observations de
  propriétés [V].
- **MoltenVK** : `MVK_CONFIG_USE_MTLHEAP=0` seulement si le GPU n'a pas la famille Mac2 (vieux
  Intel) — sans objet sur M4 (`9d31bb3`) [V]. `MPVBUNDLE=true` pour la partie Cocoa de mpv [V].
- **HDR** : rien côté hôte ; c'est le VO de mpv. Or, lu dans `vo_gpu_next.c` (l. 1130-1180) et
  `vulkan/context_mac.m` : `target-colorspace-hint=auto` ne donne un hint QUE si le swapchain
  annonce un espace cible (`preferred_csp`). `macvk` n'en annonce aucun → transfert inconnu →
  **pas de hint** → swapchain SDR → **tone mapping vers SDR** [S fort, à mesurer au banc avec
  `mpv` natif : `auto` contre `yes`]. Si la mesure le confirme, la référence actuelle a perdu le
  HDR macOS au retrait de `target-colorspace-hint=yes` (`7627d8d`).
- **Avec `hint=yes`** (ère 2) : libplacebo demande `VK_COLOR_SPACE_HDR10_ST2084_EXT` (ou HLG) ;
  MoltenVK 1.4.2 pose lui-même `colorspace = ITUR_2100_PQ`, `wantsExtendedDynamicRangeContent`
  et `edrMetadata` (via `VK_EXT_hdr_metadata`) ; la `MetalLayer` de mpv journalise chaque
  changement (`metal_layer.swift` : « Metal layer colorspace changed », « HDR active ») [V code ;
  comportement mesuré par Tentacle en Electron, fiche S2].
- **120 Hz** : 3 drawables pour laisser ProMotion monter (`4d0952e`) [V].
- **Couches CEF** : sRGB explicite (`d55ff73`), sinon des octets sRGB s'affichent en P3 natif
  (sursaturés) ; le compositeur macOS mélange une couche SDR sRGB au-dessus d'une couche PQ/EDR
  sans rien demander à l'hôte [V].

## 4. Le fork mpv — inventaire des correctifs et de leur raison

| Commit (fork) | Ère | Contenu | Raison | Utile ici ? |
|---|---|---|---|---|
| `de24468` (sparks) → `410d8ae` | 1 | backend `gpu-next` pour vo_libmpv, API Vulkan (`render_vk.h`), recadrage source, `FLIP_Y`, scalers, rendu « libplacebo swapchain » | rendre gpu-next (HDR, DV) dans un swapchain de l'hôte, sans fenêtre mpv | non : 2 600 lignes hors amont, synchro à la main ; l'hôte devait poser l'EDR lui-même |
| `fbd9e86`/`76efdcb` | 2 | `vo_wayland` : crochets d'intégration pour un compositeur externe | sous-surface Wayland | non (Linux, retiré en `79a3606`) |
| `1f95bc7` | 3 | option `input-vo-cursor` | l'hôte gère le curseur sur la fenêtre de mpv | non : chez nous mpv n'a pas de fenêtre |
| `7e0609c` | 3 | option `input-keyboard` | idem pour le clavier | non |
| `ab0467f` | 3 | `MPV_WINDOW_ICON` (Windows) | icône de l'hôte dès la 1re image | non |

Conclusion : **le fork actuel n'apporte rien au HDR macOS** ; il n'existe aucun fork de
jellium où mpv dessine dans une couche Metal fournie par l'hôte. L'amont n'accepte sur macOS
ni `wid` pour `macvk` (`common.swift` ne lit pas `wid`), ni API de rendu Vulkan.

## 5. Ce que Tentacle sait déjà (fiche S2, mesures sur le M4) et qui recoupe

- headroom EDR fixé à la **naissance** de la couche : une couche née sRGB (écran d'attente
  `force-window=yes`) reste plate → **la naissance doit se faire au premier `loadfile`, en PQ** ;
  c'est exactement le piège du démarrage des ères 2/3 [S : à revérifier dans notre montage, où la
  couche est à nous et MoltenVK change son `colorspace` au swapchain HDR] ;
- headroom accordé seulement si la couche HDR est **visible** (page opaque dessus = 1,00) ;
- DV : RPU lu par libplacebo, sortie HDR10 PQ (+ `CAEDRMetadata`), aucune sortie DV native ;
- S2 propose le **contexte `moltenvk` de MPVKit** (~96 lignes : `wid` = la `CAMetalLayer`) +
  une option de taille, et poser l'EDR/couleur côté hôte au besoin.

## 6. Ce qu'on retient pour le prototype (et pourquoi)

1. **SDL3 garde la fenêtre** : aucun défaut mesuré ne l'interdit (§ 2). On n'utilise ni le
   rendu SDL ni `SDL_WINDOW_METAL` : on ajoute nos `NSView` dans le `contentView` de la
   NSWindow de SDL3 (vidéo à l'index 0, page CEF au-dessus — compositeur du socle).
2. **mpv dessine dans NOTRE couche** sans API de rendu : un **contexte `moltenvk`** ajouté à
   mpv (le principe MPVKit/S2, réécrit à nous, LGPL comme mpv) : `wid` = `CAMetalLayer*` de notre
   `VideoSurface` ; mpv garde son swapchain, sa synchro, son rythme (FIFO), et MoltenVK pose
   `ITUR_2100_PQ`/EDR/métadonnées quand libplacebo choisit une sortie HDR. Taille : fournie par
   une option (`moltenvk-surface-size`, sur le modèle de `android-surface-size`), car le contexte
   n'a pas de fenêtre à interroger. Base : le fork `jellium-desktop` (`ab0467f`) pour rester sur
   la référence, + ce correctif, compilé contre libplacebo/MoltenVK/FFmpeg de Homebrew.
3. **`target-colorspace-hint=yes` explicite** (et non `auto`, cf. § 3), `vo=gpu-next`,
   `gpu-api=vulkan`, `gpu-context=moltenvk`. Pas de pic forcé, pas de `tone-mapping=clip` :
   le pic vient des métadonnées, la marge réelle est gérée par macOS (EDR + `CAEDRMetadata`).
4. **Naissance de la couche** : la `CAMetalLayer` naît à l'attachement de la surface, juste
   avant le premier `loadfile` ; aucun écran d'attente (`force-window=no`, `idle=yes`). Le mode
   musique ne crée aucune couche (`vo=null` tant qu'aucune surface n'est attachée) [S : la
   bascule `vo` à chaud est à prouver au banc H2].
5. **Témoin** : sonde externe (`tools/edr-probe`) sur
   `NSScreen.maximumExtendedDynamicRangeColorComponentValue`, plus `video-params` /
   `video-target-params` de mpv ; comparaison avec `mpv` natif (macvk) sur la même image.

## 7. Ce que le banc a établi (03/11, MacBook Pro M4, macOS 26.6.2, MoltenVK 1.4.2 Homebrew)

**La cause du « HDR sans EDR » (marge 1,00 alors que la couche dit PQ + EDR)** [V] : MoltenVK
pose `colorspace`, `wantsExtendedDynamicRangeContent`, `EDRMetadata` et `pixelFormat` de la
`CAMetalLayer` **depuis le fil du VO de mpv**, un fil sans boucle d'exécution ; la transaction
Core Animation implicite qui porte ces changements n'y est jamais validée. La couche « locale »
affiche PQ + EDR, mais le serveur d'affichage la voit toujours sRGB/SDR. Correctif (notre
`TentacleVideoLayer`) : `[CATransaction flush]` après chacun de ces réglages quand ils arrivent
hors du fil principal. Contre-épreuve, même passe HDR10 : **1,00 sans, 8,44 avec**. mpv natif
(`macvk`, sa propre `MetalLayer`, `hint=yes`) reste à **1,00** sur la même source : la
référence (ères 2–3) a le même défaut, en plus de `hint=auto`.

Comment on l'a isolé (témoins `tools/edr-probe/`) : `edr-calib` (Metal, PQ 0,75) → 8,2 ;
réglé comme MoltenVK (opaque, `framebufferOnly=0`, `opticalOutputScale` 1) → 7,5 ; avec le
motif EXACT relu dans les drawables de mpv → 8,44 ; dans une fenêtre SDL3 restée sRGB → 8,44 ;
avec libmpv initialisée dans le processus → 8,44 ; `edr-calib-vk` (MoltenVK seul, swapchain
`HDR10_ST2084`, sRGB d'abord puis PQ, post-multiplié) → 8,04. Seul le rendu par mpv (VO sur
son fil) échouait. Les drawables étaient bien présentés (47/51) et contenaient du PQ jusqu'à
0,751 (≈ 1 000 nits).

Autres faits établis :
- **`target-colorspace-hint=auto` sur `macvk` = SDR** [V] (journal mpv : couche sRGB ; `yes` →
  `HDR10_ST2084`). Le lecteur impose `yes`.
- **MoltenVK ne retire jamais les métadonnées HDR** en repassant en SDR ; notre couche les
  efface quand son espace n'est plus PQ/HLG.
- **Rémanence de macOS** : après un HDR, la marge reste ~15 s avant de redescendre à 1,00, même
  sur une couche redevenue `ITUR_709` sans EDR. Un SDR lu d'abord est à 1,00 d'emblée.
- **SDL3** pose `colorSpace = sRGB` sur sa NSWindow, **sans effet sur l'EDR** (mesuré).
- **Piège de mesure** : sonde « Prohibited » + NSRunLoop = valeur figée ; il faut « Accessory » +
  pompe d'évènements. Espacer les passes (rémanence) et mesurer une référence avant chacune.
- Résultats : HDR10, DV 8.1, DV 5 seuls → 8,44 (référence 1,00) ; SDR → 1,00 ; voile sRGB
  semi-transparent au-dessus, redimensionnement, plein écran 3024×1898 → 8,44 ; banc `Player`
  34/34 avec 8,44 pendant le HDR.
