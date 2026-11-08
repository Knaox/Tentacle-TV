# Paquet de distribution — taille mesurée (axe `paquet`, lot « app CEF », 04/11)

But : un `Tentacle.app` autonome, plus léger que le bureau Electron 1.42.0
(`/Applications/Tentacle TV.app`), mesuré comme l'utilisateur le voit : taille réelle, place
sur le disque une fois installé, et ce qu'il télécharge.

## Résultat

Mo (base 2²⁰). « Réel » = somme des tailles de fichiers ; « installé » = `du` après copie
compressée APFS (comme une installation App Store) ; zip = `ditto -c -k` ; DMG UDZO (zlib) et
ULMO (lzma) = `hdiutil` ; pkg = `pkgbuild` (≈ téléchargement App Store).

| Paquet | réel | installé | zip | DMG UDZO | DMG ULMO | pkg |
|---|---:|---:|---:|---:|---:|---:|
| Electron 1.42.0 tel que livré (universel x86_64 + arm64) | 638,8 | 299,5 | 263,6 | 281,5 | 266,7 | 262,5 |
| Electron 1.42.0 aminci à arm64 (architecture égale) | 364,5 | 166,6 | 144,7 | 162,4 | 119,2 | 143,7 |
| CEF au départ (`0f9aa5f`, SANS sa chaîne de lecture) | 331,2 | 159,3 | 141,2 | 156,8 | 110,3 | 141,0 |
| **CEF `--dist` final (`813b8ad`)** | **284,3** | **138,4** | **124,3** | **135,7** | **95,3** | **124,2** |
| **Intégration `3b8e1a3` + `--dist` (`4ddc7f4`)** : framework lié, assistant de maj | **284,7** | **138,6** | **124,4** | **135,8** | **95,2** | **124,4** |
| **+ sans `chrome://tracing` ni helper Alerts (`ecb55ba`)** | **283,6** | **137,8** | **123,7** | **135,1** | **93,7** | **123,6** |
| **Intégration `007eba8` (`integration-dist`, mpv 0001–0003)** | **283,6** | **137,8** | **123,7** | **135,0** | **94,3** | **123,6** |
| écart final (jalon 1) / Electron arm64 | −80,2 (−22 %) | −28,2 (−17 %) | −20,4 (−14 %) | −26,7 (−16 %) | −23,9 (−20 %) | −19,5 (−14 %) |

Le « 332 Mo » de départ ne comptait pas la lecture : l'app chargeait libmpv depuis le cache
et 52 dylibs depuis `/opt/homebrew`. Rendue autonome à l'identique, elle pesait **398,8 Mo**
(+34 Mo et +11 Mo de DMG par rapport à Electron arm64) : c'est le vrai point de départ.

Périmètre : Electron embarque aussi son front (`Resources/web`, 6,6 Mo) et sa coquille Node
(`app.asar`, 10,4 Mo) ; le proto CEF charge le front depuis le serveur. Si l'app finale
embarque le front, compter environ +6,6 Mo réels, +2 Mo de DMG. Electron est livré universel
et l'App Store ne l'amincit pas : ce que télécharge un utilisateur aujourd'hui est la ligne 1
(pkg 262,5 Mo), soit 2,1 fois le paquet CEF arm64 ; un CEF Intel serait un second paquet.

## Construire et mesurer

```bash
scripts/build.sh --dist paquet          # → ~/.cache/tentacle-cef/build/paquet/Tentacle.app
scripts/paquet-mesure.sh ~/.cache/tentacle-cef/build/paquet/Tentacle.app final --detail
scripts/paquet-mesure.sh "/Applications/Tentacle TV.app" electron-arm64 --arm64
node scripts/paquet-verif.mjs ~/.cache/tentacle-cef/build/paquet/Tentacle.app --bloc=demarrage
node scripts/paquet-verif.mjs ~/.cache/tentacle-cef/build/paquet/Tentacle.app --bloc=hdr10  # dv, sdr, musique
PAQUET_FFMPEG_TAG=n7.1.1 scripts/deps/paquet-deps.sh   # variante : deps/paquet-n7.1.1/prefix
```

`--dist` se donne à la première configuration d'un dossier de build ; sans lui, rien ne change
pour les autres axes (libmpv de `deps/mpv/<sha>`, SDL3 de Homebrew, CEF entier).
La chaîne de lecture se construit une fois (`scripts/deps/paquet-deps.sh`, ~15 min à `-j4`)
dans `~/.cache/tentacle-cef/deps/paquet/` ; les symboles restent dans `build/<axe>/symbols/`.
`paquet-verif.mjs` prend le verrou d'écran, lance l'app `--mute` en arrière-plan (DevTools 9312,
profil `profiles/paquet`), vérifie qu'aucune bibliothèque n'est chargée hors du paquet, puis
joue le scénario vidéo du pont (HDR10, DV, SDR) et le scénario musique d'Octave.
`--bloc=<nom>` joue un seul scénario par lancement (verrou tenu quelques minutes) ;
`--bloc=demarrage` (démarrage, front, `lsof`) ne prend PAS le verrou.
Toute la sortie va aussi dans `verif.txt` du dossier de journaux. Passe enchaînée (vidéo puis
musique) : après une vidéo, le front ouvre la feuille « Nouveautés 1.42.0 » (`.lg-scrim`,
z-100) par-dessus Octave ; le clic du scénario sur la barre de seek tombait dessus (sonde :
`elementFromPoint` → `lg-scrim`, aucun `audio_control seek`) — 3 passes sur 3, 0 échec en
`--bloc=musique` seul. `paquet-verif` la ferme désormais par « Fermer » avant la musique
(correctif non rejoué en entier : chasse arrêtée à la demande). Le scénario musique gagnerait
à vérifier `elementFromPoint` avant de cliquer (propriétaire : lecteur).

Garde-fous de `embed-dylibs.sh` (le build échoue sinon) : aucun lien absolu hors système ;
chaque dépendance `@rpath` / `@loader_path` / `@executable_path` de l'exécutable et des dylibs
se résout vers un fichier du paquet, comme le ferait dyld (le 04/11, un `--dist` est sorti
sans `LC_RPATH` et ne démarrait pas : le test de présence confondait le rpath avec le chemin du
framework CEF lié) ; tout vise macOS ≤ 14.0. L'app est reliée, donc réassemblée, quand
libmpv de la chaîne ou ces scripts changent.

## Vérification dans l'app (04/11, instantané final)

`paquet-verif.mjs` sur le paquet final, puis le même banc sur le build de développement de la
même branche, comme témoin (session macOS verrouillée, `--background`) : démarrage, front du
banc, aucune bibliothèque chargée hors du paquet (`lsof`, 6 processus ; le témoin en charge 53
de /opt/homebrew), HDR10/DV/SDR 10 ✅ sur 11 chacun (sortie `pq`/`pq`/`bt.1886`), bascule
musique → vidéo → musique avec couche `ITUR_2100_PQ`/`BGR10A2Unorm`/`wantsEdr`. Les échecs
— plein écran (écran verrouillé) et deux points du banc musique (seek, « passé par ? ») — sont
**identiques sur le témoin** : aucune régression due au paquet. EDR à mesurer écran déverrouillé.

Sur `37de229` + correctif rpath (`40d3abe`), écran déverrouillé, par blocs de verrou de
≈ 7 min : démarrage, front, `lsof` (4 processus, rien hors du paquet) ✅ ; HDR10 11/11
(`pq`), DV 11/11 (`pq`), SDR 11/11 (`bt.1886`), plein écran compris. Journaux :
`~/.cache/tentacle-cef/paquet/verif/2026-11-04{1845-hdr10,1911-dv,1919-sdr}`.

## Étape par étape

| # | Étape (commit) | réel | installé | zip | UDZO | ULMO | pkg | gain réel / DMG |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 1 | paquet autonome : dylibs + MoltenVK embarqués (`b529bfd`) | 398,8 | 189,7 | 168,1 | 185,7 | 130,4 | 167,9 | base |
| 2 | `-g` → `.dSYM` à part, `-dead_strip`, `strip` (`7eee683`) | 389,0 | 187,8 | 166,6 | 184,0 | 130,5 | 166,4 | −9,8 / 0 |
| 3 | ThinLTO + `-Os` sur notre code | — | — | — | — | — | — | −0,07 : **écartée** |
| 4 | locales CEF : fr et en seulement (`dd0bb97`) | 340,8 | 171,0 | 154,3 | 167,2 | 120,4 | 154,3 | −48,2 / −10,1 |
| 5 | sans SwiftShader ni son chargeur Vulkan (`02f11b4`) | 324,7 | 163,9 | 148,0 | 160,4 | 115,7 | 148,0 | −16,1 / −4,7 |
| 6 | FFmpeg 9.0.2 LGPL réduit, sans OpenSSL ni encodeurs (`a712dfa`) | 293,4 | 148,5 | 134,5 | 145,8 | 104,6 | 134,5 | −31,3 / −11,1 |
| 7 | toute la chaîne construite pour macOS 14.0 (`d8d5f0a`) | 288,2 | 146,4 | 132,7 | 144,4 | 103,1 | 132,7 | −5,2 / −1,5 |
| 8 | `resources.pak` sans DevTools ni sons d'accueil de Chrome (`81b0dd8`) | 279,0 | 137,3 | 123,6 | 134,6 | 94,7 | 123,6 | −9,2 / −8,4 |
| 9 | licences embarquées (`813b8ad`) | 284,3 | 138,4 | 124,3 | 135,7 | 95,3 | 124,2 | +5,3 / +0,6 |
| 10 | intégration `3b8e1a3` : framework lié, assistant de maj, libsodium 14.0 (`4ddc7f4`) | 284,7 | 138,6 | 124,4 | 135,8 | 95,2 | 124,4 | +0,4 / −0,1 |
| 11 | sans `chrome://tracing` ni helper « Alerts » (`ecb55ba`) | 283,6 | 137,8 | 123,7 | 135,1 | 93,7 | 123,6 | −1,1 / −1,5 |

Notes par étape :
1. `scripts/deps/embed-dylibs.sh` : fermeture des dépendances de l'exécutable copiée dans
   `Contents/Frameworks`, `@rpath`/`@loader_path`, rpaths absolus retirés ; MoltenVK et son
   manifeste dans `Contents/Resources/vulkan/icd.d` (le chargeur Vulkan y cherche d'abord).
   Garde-fous : échec sur tout lien absolu restant ou toute dylib qui vise > macOS 14.0.
2. Exécutable 2,0 → 1,0 Mo ; helper 900 → 489 Ko (×5) ; dylibs `strip -x`. Le DMG ne bouge
   pas : les symboles se compressaient bien.
3. −72 Ko sur l'exécutable, −1 Ko sur le helper (le wrapper CEF garde son `-O3`) : pas le
   coût de build ni le risque.
4. `trim-cef.sh` : 220 dossiers `.lproj` → 8 (`en`, `fr` et leurs variantes d'accord de 18 o).
   Le front n'existe qu'en fr/en ; Chromium retombe sur `en` pour toute autre langue système.
5. Rendu logiciel de secours de Chromium. Le proto rend par le GPU (OSR IOSurface, ANGLE sur
   Metal) ; une panne GPU retombe sur le compositeur logiciel, sans WebGL.
6. `scripts/deps/paquet-deps.sh` + `ffmpeg-components.sh` : `--disable-everything`, puis les
   décodeurs d'une bibliothèque Jellyfin (H.264, HEVC, AV1 + dav1d, VP8/9, MPEG-1/2/4, VC-1,
   WMV3, ProRes ; AAC, AC-3, E-AC-3, TrueHD, DTS, FLAC, Opus, Vorbis, MP3, ALAC, APE, WavPack,
   WMA, DSD, PCM ; ASS, SRT, WebVTT, mov_text, DVD, DVB, PGS, CEA-608), les demuxers (MKV, MP4,
   TS, PS, HLS, audio, sous-titres externes, images de pochette), https par Secure Transport
   (comme le paquet Electron), VideoToolbox, les filtres audio d'Electron (`volume:eval=frame`,
   `asetnsamples`, `astats`, `anullsrc` via `av://lavfi`). libmpv sans X11 (auto-détecté
   depuis Homebrew), OpenGL, libarchive, libbluray, zimg, jpeg. 53 → 31 dylibs ;
   libavcodec 9,3 → 5,2 Mo.
7. `scripts/deps/paquet-libs.sh` : dav1d, lcms2, uchardet, fribidi, freetype (sans libpng ni
   brotli), harfbuzz (sans glib, pcre2, intl, graphite2), libass (CoreText, sans fontconfig),
   Vulkan-Loader, glslang **statique dans libplacebo** (au lieu de shaderc, 4,8 Mo), SDL3
   réduite à vidéo + évènements. Mêmes versions que Homebrew, `MACOSX_DEPLOYMENT_TARGET=14.0`.
   31 → 20 dylibs. MoltenVK reste celle de Homebrew (elle vise déjà macOS 12).
8. `trim-pak.py` : ressources choisies **par nom** dans `include/cef_pack_resources.h` (section
   `devtools_resources.h`, 861 ressources ; `IDR_INTRO_SOUND_*`, 6 FLAC). 4 443 ressources
   gardées identiques octet pour octet, 379 alias cohérents. Le protocole CDP (`--devtools-port`)
   n'en dépend pas ; seule la fenêtre d'inspection disparaît. La HRTF de Web Audio reste.
9. `Contents/Resources/licenses/` : `CREDITS.html` de CEF (5,1 Mo) et les licences des 14
   bibliothèques de la chaîne. Electron en livre 19,1 Mo.

## Composition finale (réel, Mo)

| Composant | CEF `--dist` | Electron arm64 |
|---|---:|---:|
| Moteur (`Chromium Embedded Framework` / `Electron Framework`) | 225,8 | 186,1 |
| `resources.pak` / `icudtl.dat` / autres paks et snapshots | 10,8 / 10,3 / 4,4 | 6,9 / 10,4 / 1,7 |
| Locales | 1,4 (fr, en) | 46,4 (55 langues) |
| `Libraries` du moteur (SwiftShader, ANGLE, ffmpeg de Chromium) | 0,1 | 23,9 |
| Chaîne de lecture (dylibs) | 24,3 (20) | 49,1 (35) |
| dont FFmpeg / libmpv / libplacebo / MoltenVK / SDL3 | 8,5 / 3,4 / 3,0 / 3,7 / 1,4 | — |
| Exécutable + helpers | 1,0 + 2,3 (5) | 0,3 (4) |
| Front, coquille Node, licences | 0 / 0 / 5,4 | 6,6 / 10,4 / 19,1 |

Le moteur CEF représente 79 % du paquet et ne se réduit plus sans recompiler CEF.

## Signature : ordre exigé par Developer ID (notarisation)

Aujourd'hui tout est signé ad hoc, dans cet ordre : dylibs de `Contents/Frameworks` →
framework CEF → les 5 helpers → l'app (`MacBundle.cmake`), puis `tentacle-update` → l'app à
nouveau (`src/update/CMakeLists.txt`) ; `codesign --verify --deep --strict` est valide. Pour
Developer ID, signer **de l'intérieur vers l'extérieur, jamais `--deep`**, chaque Mach-O avec
`--options runtime --timestamp` :
1. chaque `Contents/Frameworks/*.dylib` (20) ;
2. `Chromium Embedded Framework.framework/Versions/A/Libraries/libcef_sandbox.dylib`, puis le
   framework (`…/Versions/A`) — les dylibs de `Libraries` ne sont PAS signées par la signature
   du framework ;
3. chaque `Tentacle Helper*.app`, avec ses droits (Chromium : `allow-jit` pour le Renderer,
   `allow-unsigned-executable-memory`/`disable-library-validation` selon le type) ;
4. `Contents/MacOS/tentacle-update` (exécutable imbriqué, identifiant propre, runtime durci) ;
5. l'app en dernier, avec ses droits ; puis notariser le DMG ou le pkg et `stapler staple`.
Toute retouche après l'étape 5 (comme la copie de l'assistant aujourd'hui) oblige à resigner
l'app : en distribution, la copie de `tentacle-update` doit précéder la signature finale.

## Ce que `--dist` change à l'exécution (à savoir)

- Pas de fenêtre DevTools (le CDP des bancs marche). Pas de WebGL si le GPU tombe.
- Chaînes internes de Chromium (validation de formulaires, menus natifs) en fr ou en seulement.
- TLS par Secure Transport : TLS 1.2 au plus (le paquet Electron fait de même).
- Pas d'encodeur : `screenshot-to-file` de mpv impossible ; `screenshot-raw` (utilisé par
  Electron pour le verre liquide) marche.
- libsodium (maj) : statique, construite pour macOS 14.0 par `paquet-libs.sh`.
- SDL3 sans audio, manette, capteurs, rendu 2D, OpenGL, Vulkan : un axe qui en appelle un
  doit l'ajouter dans `paquet-libs.sh` (sinon `SDL_Init` échoue en `--dist` seulement).
- libass trouve les polices par CoreText (polices système), sans fontconfig.
- Un nouveau correctif `scripts/deps/mpv-patches/*.patch` est pris automatiquement (branche
  `paquet-<empreinte>`), comme dans `mpv-build.sh`.
- `PAQUET_FFMPEG_TAG=<tag>` (paquet-deps.sh et build.sh) : chaîne complète à part dans
  `deps/paquet-<tag>`, seul FFmpeg change. FFmpeg 7.1.1 (celui d'Electron) contre 9.0.2, mpv
  seul `vo=null hwdec=videotoolbox` : 184,5 contre 181,5 Mo de pic d'empreinte (le décodage
  n'explique pas l'écart de 40 Mo relevé par ram).

## Pistes écartées ou restantes

| Piste | Gain estimé | Pourquoi pas maintenant |
|---|---|---|
| CEF recompilé (GN : sans PDF, impression, extensions, WebRTC, correcteur…) | inconnu, 20–40 Mo ? | checkout Chromium (~100 Go) et heures de build ; seul levier sur les 225,8 Mo |
| `icudtl.dat` filtré (fr/en) | ~5 Mo | exige l'outillage ICU de Chromium ; risque sur `Intl` |
| Un seul binaire helper lié 5 fois | 1,9 Mo | impossible : chaque bundle signe son exécutable avec son identifiant |
| FFmpeg encore plus étroit (sans WMA, APE, DSD, VC-1…) | < 1 Mo | casse des fichiers réels pour un gain marginal |
| `gpu_shader_cache.bin`, `chrome_100_percent.pak` | 1,4 Mo | démarrage plus lent / écrans non Retina |

## Écarts constatés (Electron et proto)

- 49 des 53 dylibs Homebrew embarquables visent macOS **26.0** ; l'app annonce 14.0. Le
  paquet Electron 1.42.0 a le même défaut (`libass.9.dylib` : `minos 26.0` dans sa tranche
  arm64). Non vérifiable ici faute de Mac en macOS 14/15 ; le paquet `--dist` y échappe.
- Electron livre 55 langues de Chromium, SwiftShader, l'ANGLE GL et le ffmpeg de Chromium
  (`libffmpeg.dylib`) en plus de sa propre chaîne mpv.

## Suite : Linux et Windows (préparé, rien de fait)

Tailles des distributions CEF 156.0.15 « minimal » (index de `cef-builds.spotifycdn.com`,
archives bz2) : macOS arm64 128,8 Mo, macOS x64 135,1, **Linux x64 317,9** (libcef.so livré
avec ses symboles), Linux arm64 411,3, **Windows x64 166,7**, Windows arm64 162,3.

Ce qui se reprend tel quel : `trim-pak.py` (même format pak v5, même `cef_pack_resources.h`),
la liste `ffmpeg-components.sh`, les options de `paquet-libs.sh` (meson/CMake), `paquet-mesure.sh`
à adapter (squashfs/zip au lieu de DMG). Ce qui change :

- **Linux (AppImage / Flatpak)** : locales en `locales/<lang>.pak` (garder `fr`, `en-US`) ;
  `strip --strip-unneeded libcef.so` + `objcopy --only-keep-debug` (le gros du 318 Mo) ;
  `libEGL.so`/`libGLESv2.so` (ANGLE) obligatoires, SwiftShader et `libvulkan.so.1` de CEF
  retirables ; un seul exécutable (pas de bundles helpers). Chaîne : FFmpeg avec VA-API au lieu
  de VideoToolbox, libplacebo Vulkan, sous-surface Wayland (REPRISE). AppImage : tout embarqué
  sauf glibc, squashfs zstd/xz ≈ notre DMG ULMO ; `chrome-sandbox` SUID impossible en AppImage
  (espaces de noms utilisateur ou `--no-sandbox`, à trancher avec `ram`). Flatpak : runtime
  `org.freedesktop.Platform` partagé (FFmpeg via `codecs-extra`), CEF + libmpv + libplacebo +
  libass dans l'app, zypak pour le bac à sable ; téléchargement dédupliqué par OSTree.
  Coût : 1–2 jours (AppImage), 2–3 jours (Flatpak), conteneur de build glibc ancienne.
- **Windows (MSIX)** : `libcef.dll`, `chrome_elf.dll`, `libEGL.dll`/`libGLESv2.dll` (ANGLE
  D3D11, obligatoires), `d3dcompiler_47.dll` ; SwiftShader + `vulkan-1.dll` retirables, la DXC
  de WebGPU (`dxcompiler.dll`, `dxil.dll`) à évaluer ; locales `locales/*.pak`. Pas de helpers
  séparés. Chaîne : FFmpeg D3D11VA, libplacebo D3D11 (spirv-cross) ou Vulkan, construite en
  llvm-mingw ou MSVC ; symboles en PDB à part. MSIX = zip par blocs : téléchargement ≈ notre
  colonne zip, mises à jour différentielles par blocs (utile à `maj`). Signature obligatoire.
  Coût : 2–3 jours.
- Electron équivalent à mesurer sur chaque OS avec la même méthode avant de conclure.
