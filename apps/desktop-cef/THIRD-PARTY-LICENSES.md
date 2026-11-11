# Licences tierces — Tentacle TV Desktop (coquille CEF)

Tentacle TV est distribué sous **GNU AGPL v3.0 ou ultérieure** (`LICENSE`), avec
les permissions additionnelles de `LICENSE-EXCEPTIONS` (boutiques d'applications,
bibliothèques de plateforme). Source de chaque version : tag `desktop-vX.Y.Z` de
https://github.com/Knaox/Tentacle-TV. Les versions publiées avant le 2026-10-07
restent sous licence MIT.

Depuis la **1.50.0**, le bureau est la coquille de ce dossier : **CEF** (Chromium
Embedded Framework) pour l'interface, **SDL3** pour la fenêtre et les évènements,
**libmpv** liée directement pour la lecture. Le front (`apps/web`) y est servi sous
`tentacle://app`. Electron et koffi ne sont plus embarqués par le bureau.

L'écran **Crédits › Licences** de l'application liste chaque composant embarqué
avec sa mention et ouvre le texte complet de chaque licence, hors ligne (catalogue :
`packages/shared/src/licenses/components/desktop.ts`). Inventaire général :
`docs/LICENCES.md`.

## La coquille

| Composant | Version | Licence | Source |
|-----------|---------|---------|--------|
| Chromium Embedded Framework | 156.0.15 (`scripts/deps/cef-version.env`) | BSD-3-Clause | https://github.com/chromiumembedded/cef — distribution « minimal » de https://cef-builds.spotifycdn.com |
| Chromium (dans CEF) | 156.0.8078.80 | BSD-3-Clause + licences de ses composants | avis complets : `CREDITS.html` de la distribution CEF, livré sous le nom `CREDITS-Chromium.html` |
| SDL3 | 3.4.16 | zlib | https://github.com/libsdl-org/SDL |
| nlohmann/json | 3.12.0 (Windows, épinglée) ; celle de Homebrew sur macOS | MIT | https://github.com/nlohmann/json — en-têtes compilés dans l'exécutable |
| libsodium | 1.0.22 (Windows) ; source de la formule Homebrew sur macOS | ISC | https://github.com/jedisct1/libsodium — liée statiquement (moteur de mise à jour) |
| SQLite | 3.46.1 (Windows, amalgamation épinglée) ; celle du système sur macOS et Linux | domaine public | https://sqlite.org |

Les binaires publics de CEF n'ont pas les codecs propriétaires de Chromium (H.264,
AAC) : aucun brevet de codec n'entre par la coquille ; la lecture passe par mpv.

## Lecteur vidéo — mpv et FFmpeg, par système

| Système | Ce qui est livré | Licence effective | Source / recette |
|---------|------------------|-------------------|------------------|
| **macOS** (Apple Silicon) | libmpv du **fork** `andrewrabert/mpv` (branche `jellium-desktop`, `ab0467ff24`) + nos correctifs `scripts/deps/mpv-patches/`, `-Dgpl=false` ; FFmpeg **n9.0.2** `--disable-gpl --disable-nonfree --disable-autodetect`, sans encodeur ni OpenSSL ; **20 bibliothèques dynamiques** dans `Contents/Frameworks` | **LGPL-2.1-or-later** (le build vérifie `CONFIG_GPL 0`) | `scripts/deps/paquet-deps.sh`, `paquet-libs.sh`, `ffmpeg-components.sh` (versions, options et correctifs y figurent) |
| **Windows** | `libmpv-2.dll` de zhongfly/mpv-winbuild (variante LGPL) : mpv 0.41.0-233 (`f28cea85c`), FFmpeg 8.x `--enable-version3` + OpenSSL 3, tout lié statiquement dans la DLL — la même DLL que le bureau d'avant, rangée dans `resources/windows/mpv/` (`scripts/dev/windows-deps.mjs`, `MPV_PIN`) | **LGPL-3.0-or-later** | https://github.com/zhongfly/mpv-winbuild — voir « Restes » |
| **Linux** | notre libmpv (même fork, correctifs `mpv-patches/` + `mpv-patches-linux/`), `-Dgpl=false` ; FFmpeg, libplacebo, libass : ceux de la distribution | **LGPL-2.1-or-later** | `scripts/dev/mpv-linux.mjs` — aucun paquet Linux de cette coquille à ce jour |

Bibliothèques de la chaîne macOS (même version que Homebrew, construites pour
macOS 14.0) : libplacebo 7.360.1 (LGPL-2.1+, glslang lié dedans), FriBidi 1.0.17
(LGPL-2.1+), uchardet (LGPL-2.1+, triple licence), libass 0.17.5 (ISC), FreeType
2.15.0 (FTL — « Portions of this software are copyright © The FreeType Project
(www.freetype.org). All rights reserved. »), HarfBuzz 14.5.1 (MIT), Little CMS
2.19.1 (MIT), dav1d 1.5.4 (BSD-2-Clause), chargeur Vulkan 1.4.357 et glslang
(Apache-2.0 et BSD/MIT), MoltenVK (Apache-2.0, celle de Homebrew). zlib, bzip2,
iconv et libcurl sont celles du système.

Aucune bibliothèque GPL, aucun encodeur GPL (x264, x265), aucun composant
`nonfree`. Liaison dynamique : la libmpv et les bibliothèques FFmpeg du paquet sont
des fichiers séparés, remplaçables par une version modifiée (LGPL : « relier »).

## Fichiers de licence dans le paquet

`scripts/build.sh --dist` (macOS) copie dans `Contents/Resources/licenses/`
(`cmake/MacBundle.cmake`) : la licence de Tentacle TV (`LICENSE`, AGPL-3.0-or-later),
`LICENSE-EXCEPTIONS`, ce fichier, `CEF.txt` (LICENSE de CEF), `CREDITS-Chromium.html`,
les licences des 16 bibliothèques tierces (`FFmpeg-n9.0.2.txt`, `mpv.txt`,
`libplacebo.txt`, `libass.txt`, `harfbuzz.txt`, `freetype.txt`, `fribidi.txt`,
`dav1d.txt`, `lcms2.txt`, `uchardet.txt`, `SDL3.txt`, `Vulkan-Loader.txt`,
`glslang.txt`, `MoltenVK.txt`, `libsodium.txt`, `nlohmann-json.txt` — écrites par
`scripts/deps/paquet-deps.sh`, à relancer une fois pour qu'un cache d'avant les ait) et un
`LISEZMOI.txt` qui dit où refaire le build.

## Restes (non conformes à ce jour)

- **Windows, Linux** : aucune recette de paquet ne copie encore de licence (CEF,
  `CREDITS-Chromium.html`, SDL3, libmpv-2.dll et ses bibliothèques).
- **Windows** : la source de `libmpv-2.dll` est documentée (mpv `f28cea85c`, FFmpeg
  `aa483bc42`, recettes zhongfly/mpv-winbuild `198a40e` sur shinchiro/mpv-winbuild-cmake
  `965bf378`), mais les révisions des AUTRES bibliothèques LGPL liées dans la DLL
  (libplacebo, FriBidi, libbluray, uchardet, LAME) ne sont pas gravées dans le binaire :
  reconstruire la DLL à révisions épinglées. Elle vit dans `resources/windows/mpv/`
  (épinglée par empreinte, `scripts/dev/windows-deps.mjs`).
- **Sources** : l'offre de sources (`.github/scripts/lib/source-offer.mjs`, `desktop`)
  pointe le fork `andrewrabert/mpv@ab0467ff24`, FFmpeg n9.0.2, libplacebo, FriBidi et
  uchardet ; elle n'est jouée que par la CI de livraison du bureau, à réécrire pour CEF.
