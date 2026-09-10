# macOS — la fenêtre vidéo, ce qu'elle coûte, et pourquoi deux montages

Relevé mené le 10.09.2026, après le signalement d'un utilisateur sur Mac **Intel** :
la machine chauffe dès la première image d'un épisode 1080p en lecture directe, depuis
la migration Tauri → Electron. Sur le web (Chromium, `<video>`), la même machine ne
chauffe pas. Le réglage « Qualité de rendu → Économe » (livré en 1.21.1) n'y a rien
changé — ce qui prouve que le coût n'était pas dans les passes de shader, mais dans la
**structure** de la chaîne.

## Le problème, en une phrase

`--wid` n'existe pas sur macOS : mpv ne s'embarque pas dans une fenêtre qu'on lui donne.
Deux voies restent — **sa propre fenêtre Metal, calée sous la nôtre**, ou **la Render API
dans une vue OpenGL à nous** — et elles n'ont ni le même coût, ni les mêmes capacités.

## Ce que faisait la coquille Tauri (elle ne chauffait pas)

Le reliquat archivé sur le bureau ne contient que des icônes ; le code vit dans
l'historique git, à `ff1ab604^` (`apps/desktop/src-tauri/src/macos/`).

- `vo=libmpv` forcé côté Rust (`commands.rs:27`) — le `gpu-next` que la page demandait
  était jeté (L48).
- Render API **OpenGL** (`MPV_RENDER_PARAM_API_TYPE=opengl`) dans une `NSOpenGLView`
  insérée SOUS la WKWebView, dans la MÊME `NSWindow` (`gl_surface.rs`) ; profil legacy,
  RGBA 32 bits ; thread de rendu dédié réveillé par le callback mpv, `CGLFlushDrawable`
  (`render.rs`).
- `hwdec=auto-safe` → VideoToolbox zéro-copie par `CGLTexImageIOSurface2D`, le chemin
  d'IINA.
- Fenêtre opaque (`tauri.macos.conf.json` : `transparent: false`), webview transparente
  pendant la lecture seulement.
- Aucune option de qualité, aucune distinction Intel / Apple Silicon.

## Ce que fait le montage `fenetre` (Electron, Apple Silicon)

- `vo=gpu-next` + `gpu-api=vulkan` + `gpu-context=macvk` : libplacebo → Vulkan →
  **MoltenVK** → Metal. libplacebo n'a pas de backend Metal ; c'est la seule voie native.
- mpv crée SA `NSWindow`, attachée en enfant sous la fenêtre Electron (`transparent: true`),
  recherche de la fenêtre à 100 Hz pendant dix secondes au plus, veille de calage à 10 Hz.
- `hwdec=videotoolbox` : zéro-copie par `VK_EXT_metal_objects`.
- `force-window=no` et `target-colorspace-hint=yes` : la couche Metal naît en PQ, et c'est
  le **seul chemin où le HDR a été mesuré** (`Metal layer colorspace changed:
  ITUR_2100_PQ`, headroom EDR accordé dès la première image). Il reste celui des Mac
  Apple Silicon.

## Pourquoi il chauffe sur Intel

- **mpv#12675** — MacBook Pro 2017, `gpu-context=macvk` : l'import zéro-copie
  `videotoolbox` échoue, seul `videotoolbox-copy` fonctionne. Avec une valeur `hwdec`
  unique, mpv retombe alors en **décodage logiciel**, en silence : un 1080p décodé au
  processeur, c'est le profil thermique décrit. D'où la liste
  `hwdec=videotoolbox,videotoolbox-copy` posée depuis (`apps/web/src/lib/hardwareDecoding.ts`) :
  l'import direct, puis la copie, jamais le logiciel sans le dire.
- **mpv#7482** — la PR d'origine du backend `macvk` le donne pour « expérimental »,
  « comparable à OpenGL, sans avantage constant ».
- **Bi-GPU** — sur un MacBook Pro 15"/16" à Radeon, MoltenVK n'obéit pas à la bascule
  automatique (MoltenVK#418) ; un contexte OpenGL avec `NSOpenGLPFAAllowOfflineRenderers`
  et `NSSupportsAutomaticGraphicsSwitching` (qu'Electron déclare) reste, lui, sur l'iGPU
  (Apple QA1734).
- **Une fenêtre transparente coûte** — Tauri#15471 (page statique, ~8× de GPU, et 1380 %
  CPU du processus GPU sur un MacBook Pro 15" 2019 Intel), Electron#31802 (Iris 6100 :
  coût proportionnel à la surface). La seconde fenêtre composée en alpha par-dessus la
  vidéo s'y ajoute.
- Et tout cela pour un HDR qu'**aucun écran Intel intégré n'affiche**.

## Ce que dit la dylib livrée

`apps/desktop-electron/lib/mpv/libmpv.2.dylib` — mpv 0.40.0 LGPL, libplacebo 7.360,
MoltenVK 1.4.1. Features compilées (chaîne `List of enabled features`) :
`gl gl-cocoa videotoolbox-gl videotoolbox-pl vulkan libplacebo macos-cocoa-cb swift`.
`nm -u` y montre `_CGLTexImageIOSurface2D` : **l'interop VideoToolbox ↔ OpenGL existe**,
la Render API décode en zéro-copie. La Render API 0.40 emploie le renderer classique
`gpu` — `gpu-next` dans la Render API est mpv#16818, en draft.

Sonder les défauts et l'acceptation d'une option se fait par koffi sur la dylib (voir la
mémoire de projet) ; ⚠️ `mpv_set_option_string` accepte n'importe quelle chaîne pour
`hwdec` avant l'init — la seule preuve est `hwdec-current` pendant une lecture.

## La décision

`apps/desktop-electron/src/main/video/macosMontage.ts` — une fonction pure :

| Machine | Montage | Pourquoi |
|---|---|---|
| Apple Silicon (`arm64`) | `fenetre` | seul chemin HDR mesuré ; ne chauffe pas |
| Intel (`x64`) | `gl` | la chaîne Tauri : une fenêtre, OpenGL natif, renderer classique, VideoToolbox zéro-copie, pas de MoltenVK, pas de seconde fenêtre |

`TENTACLE_VIDEO_MONTAGE=gl|fenetre` force l'un ou l'autre — un forçage de diagnostic, dans
les deux sens, qui passe au paquet livré lancé à la main :

```bash
TENTACLE_VIDEO_MONTAGE=fenetre "/Applications/Tentacle TV.app/Contents/MacOS/Tentacle TV"
```

Aucun réglage n'est exposé : c'est un seul mode, la coquille choisit d'après la machine.
Le montage retenu est tracé au démarrage de chaque lecture (`mpv demarre — montage gl`).

### Ce que le montage `gl` est devenu

Il existait déjà, construit pour une expérience EDR, avec quatre défauts qui le rendaient
inutilisable sur un écran SDR — tous corrigés :

1. `adaptForRenderApi` imposait `target-trc=pq`, `target-prim=display-p3`, `target-peak` :
   du PQ écrit dans une surface sRGB délave l'image. mpv garde ses défauts.
2. Personne ne rendait la page transparente : le fond `#000000` de la fenêtre Electron
   masquait la vue. `MacosSurfaceGl.attach()` le fait, une fois le rendu démarré.
3. Format de pixels flottant 64 bits + plage étendue demandée, et un attribut faux —
   `DEPTH_SIZE: 11` est `NSOpenGLPFAAlphaSize` (la profondeur est 12), donc un alpha de
   24 bits impossible. RGBA 8 bits, double tampon, profil 3.2 core, ni profondeur ni
   flottant.
4. Cadre sans le retrait du bandeau d'hôte, et `align()` que personne n'appelait sur
   macOS : la vue laisse `bannerInset` en fenêtré et s'abonne elle-même aux transitions
   plein écran.

## L'EDR par `NSOpenGLView` : écarté, et pourquoi

C'est le savoir le plus cher de ce chantier ; il ne doit pas mourir avec le code.

- **mpv ne sait pas produire de valeurs au-delà de 1.0**, ce que l'EDR exige. Les deux
  tentatives amont — mpv#8387, mpv#8485 — ont dû patcher les shaders (multiplier par 3.0,
  retirer le `clamp`) et ont été abandonnées sans être fusionnées. Aucune combinaison de
  `target-trc`, `target-prim`, `target-peak` n'y supplée.
- **La mesure ment.** `wantsExtendedDynamicRangeOpenGLSurface` fait accorder le headroom
  par le système, à la demande, sans regarder ce qu'on dessine : la sonde rapportait 16,00
  sur 16,00 pour une image sans HDR. Le journal de la couche Metal, lui, est écrit par le
  rendu — c'est le seul témoin.

## Ce qu'on perd sur Intel

Le HDR sur un moniteur externe qui en ferait. Assumé : `TENTACLE_VIDEO_MONTAGE=fenetre` le
rend, avec la chauffe. Un Mac Apple Silicon ouvert « avec Rosetta » rapporte `x64` et
prend le montage `gl` — un cas voulu par l'utilisateur, qu'on ne détecte pas.

## Mesurer

- Le décodeur réellement employé : Préférences → « Décodage matériel » affiche
  `hwdec-current` de la dernière lecture. « le processeur a décodé seul » = repli
  logiciel, la première chose à regarder chez un utilisateur qui chauffe.
- `sudo powermetrics --samplers gpu_power -i 1000 -n 30`, sur un **build de production**
  (jamais `dev`, dont le compteur d'images tient une boucle `requestAnimationFrame`),
  même œuvre et même position, `TENTACLE_VIDEO_MONTAGE=fenetre` puis `=gl`.
- Le paquet livré s'instrumente par `--remote-debugging-port` et
  `window.tentacle.invoke("mpv_get_property", { name })` : `video-params` et
  `video-target-params` (le COUPLE, jamais l'un des deux), `hwdec-current`, `current-vo`.
- Sans Mac Intel : le paquet x64 tourne sous Rosetta (artefact CI `mac-libs-x64`, paquet
  `--arch x64`) — il éprouve le chemin de code Intel, pas le GPU Intel.

## Ce que le web fait que libmpv ne fera pas

Chromium délègue `<video>` à un overlay CoreAnimation en scanout direct (« power
consumption during fullscreen video playback was halved », VideoNG) ; mpv n'a aucun VO
équivalent sur macOS. L'objectif réaliste est « comme Tauri et IINA », pas « comme
QuickTime ».
