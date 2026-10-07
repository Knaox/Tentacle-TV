# Licences tierces — Tentacle TV Desktop

Tentacle TV est distribué sous **GNU AGPL v3.0 ou ultérieure** (`LICENSE`), avec
les permissions additionnelles de `LICENSE-EXCEPTIONS` (boutiques d'applications,
bibliothèques de plateforme). Source de chaque version : tag `desktop-vX.Y.Z` de
https://github.com/Knaox/Tentacle-TV. Les versions publiées avant le 2026-10-07
restent sous licence MIT.

L'écran **Crédits › Licences** de l'application liste chaque composant embarqué
avec sa mention et ouvre le texte complet de chaque licence, hors ligne (catalogue :
`packages/shared/src/licenses/components/desktop.ts`). Inventaire général :
`docs/LICENCES.md`.

## Lecteur vidéo — mpv et FFmpeg, par système

| Canal | Ce qui est livré | Licence effective | Source / recette |
|-------|------------------|-------------------|------------------|
| **Mac App Store** | mpv **0.40.0** `-Dgpl=false -Drubberband=disabled` + FFmpeg **n7.1.1** `--disable-gpl --disable-nonfree`, en **bibliothèques dynamiques séparées** (`Contents/Frameworks`) | **LGPL-2.1-or-later** — vérifié dans l'app installée (« libavutil license: LGPL version 2.1 or later ») | `scripts/build-mpv-lgpl-macos.sh` ; dépendances Homebrew (libplacebo, FriBidi, GLib, gettext, Graphite2, dav1d, libass, FreeType, HarfBuzz, lcms2, libpng, libjpeg-turbo, PCRE2, libX11/xcb, shaderc, chargeur Vulkan, **MoltenVK**) |
| **Microsoft Store** | `lib/mpv/libmpv-2.dll`, binaire **tiers** de zhongfly/mpv-winbuild (variante LGPL) : mpv master 0.41.0-233, FFmpeg 8.x `--enable-version3` + OpenSSL 3, tout lié statiquement dans la DLL | **LGPL-3.0-or-later** (et non v2.1+ comme on l'écrivait) | https://github.com/zhongfly/mpv-winbuild — ⚠️ build non reproductible, plus téléchargeable (voir « Restes ») |
| **Linux** (Releases GitHub) | mpv **0.41.0** `-Dgpl=true` — la sortie vidéo X11 n'existe pas autrement — avec FFmpeg **n7.1.1** LGPL lié dedans, + bibliothèques apt d'Ubuntu 22.04 dans `resources/lib` | **GPL-2.0-or-later** (GPL-3 une fois combiné ; compatible AGPL-3) | `scripts/build-mpv-linux.sh` |

Le paquet Mac App Store porte dans `Contents/Resources/licenses` la licence de Tentacle
TV, ses permissions, ce fichier, la licence d'Electron et `LICENSES.chromium.html`
(`scripts/macosLicenses.mjs` ; jusqu'en 1.26.x, les deux derniers manquaient).

Aucune bibliothèque GPL-2.0-only, aucun encodeur GPL (x264, x265), aucun composant
`nonfree`. Liaison dynamique : la libmpv livrée est remplaçable, et la variable
d'environnement `TENTACLE_MPV_LIB` charge une libmpv modifiée (LGPL : « relier »).

## Electron et le reste

| Composant | Version | Licence |
|-----------|---------|---------|
| Electron (+ Chromium et son FFmpeg, avis dans `LICENSES.chromium.html`) | 43.2.0 | MIT (+ licences de Chromium) |
| koffi | 3.1.2 | MIT (koffi 1.x était AGPL : ne pas rétrograder) |
| zod | 3.25 | MIT |
| MoltenVK, chargeur Vulkan, shaderc | Homebrew | Apache-2.0 (licence et avis dans l'écran Licences) |
| FreeType | — | FTL — « Portions of this software are copyright © The FreeType Project (www.freetype.org). All rights reserved. » |
| libjpeg-turbo (macOS) | — | IJG + BSD-3 + zlib — « This software is based in part on the work of the Independent JPEG Group. » |
| Client web (React, hls.js, Inter…) | — | voir `apps/web/THIRD-PARTY-LICENSES.md` |

## Restes (non conformes à ce jour)

- **Windows** : la source exacte de `libmpv-2.dll` n'est plus disponible ; construire
  la DLL soi-même à tags épinglés, ou archiver sa source avec chaque Release.
- **Sources** : joindre à chaque Release `desktop-vX.Y.Z` les sources de la chaîne mpv
  et le manifeste des versions Homebrew / apt réellement embarquées.
- `lib/mpv/libmpv.dylib` (mpv Homebrew **GPL**, jamais chargée) et `libmpv-wrapper.*`
  sont distribués par le dépôt sans source : à retirer.
