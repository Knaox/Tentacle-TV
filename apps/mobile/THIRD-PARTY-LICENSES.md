# Licences tierces — Tentacle TV Mobile

Tentacle TV est distribué sous **GNU AGPL v3.0 ou ultérieure** (`LICENSE`), avec
les permissions additionnelles de `LICENSE-EXCEPTIONS` (boutiques d'applications ;
bibliothèques de plateforme non libres comme Firebase, pour le seul code de Tentacle).
Source de chaque version : tag `mobile-vX.Y.Z` de https://github.com/Knaox/Tentacle-TV.
Les versions publiées avant le 2026-10-07 restent sous licence MIT.

**Crédits › Licences** dans l'app : la mention de l'AGPL, la source de la version, les
composants embarqués (selon iOS ou Android) et le texte complet de chaque licence, hors
ligne (catalogue : `packages/shared/src/licenses/`). Inventaire général : `docs/LICENCES.md`.

## Lecteur avancé (libmpv)

L'application embarque **libmpv** pour lire tel quel ce que le lecteur système ne lit
pas (MKV, DTS, TrueHD, Opus, ASS stylé, PGS, codecs anciens…). Le lecteur système
(AVPlayer sur iOS, ExoPlayer sur Android) reste le premier choix là où il gagne.

### iOS — MPVKit

| Versions | Binaires | Licence |
|----------|----------|---------|
| ≤ 1.10.x (livrées) | fork Streamyfin `0.41.0-av5` tel quel : mpv `-Dgpl=true`, **libsmbclient**, LuaJIT, FFmpeg `--enable-nonfree` (« nonfree and unredistributable »), archive statique | **GPL v3** — incompatible avec l'App Store : **non conforme** |
| ≥ 1.11.0 | variante construite par `.github/workflows/mpvkit.yml` : mpv `-Dgpl=false`, FFmpeg n8.1 **sans** `--enable-gpl` ni `--enable-nonfree`, libsmbclient et LuaJIT **retirés** avant la combinaison | **LGPL** — mpv LGPL-2.1+, FFmpeg **LGPL-3.0+** (`--enable-version3`, GMP) |

La garde `check-podspec-license.mjs` (job `prepare` de `mobile.yml`) **refuse** toute
livraison iOS au cran test ou store si `ios/MPVKit.podspec` déclare une licence GPL ou
si sa source n'est pas une Release `mpvkit-lgpl-*` de ce dépôt. Le `mpvkit.yml` vérifie
dans le binaire (chaînes gravées par libavutil, traces de Samba et LuaJIT) qu'il est LGPL.

Composants de la variante LGPL (script du fork, `Sources/BuildScripts/XCFrameworkBuild/main.swift`) :

| Composant | Licence | Source |
|-----------|---------|--------|
| mpv 0.41 (+ `vo_avfoundation` du fork) | LGPL-2.1+ (`-Dgpl=false`) | https://github.com/mpv-player/mpv — fork : https://github.com/streamyfin/MPVKit |
| FFmpeg n8.1 | LGPL-3.0+ | https://ffmpeg.org |
| libplacebo 7.360.1, FriBidi, GnuTLS 3.8.11, libbluray 1.4.0 | LGPL-2.1+ | code.videolan.org, github.com/fribidi, gnutls.org |
| GMP, Nettle | LGPL-3.0+ (ou GPL-2+, non retenue) | gmplib.org |
| uchardet | MPL-1.1 / GPL-2+ / LGPL-2.1+ — utilisé sous LGPL | freedesktop.org |
| libass 0.17.4 | ISC | github.com/libass/libass |
| FreeType | FTL (mention de crédit dans l'écran Licences) | freetype.org |
| HarfBuzz, Little CMS 2.17, libdovi 3.3.2 | MIT | — |
| dav1d 1.5.2 (sans assembleur), uavs3d 1.2.1 | BSD-2 / BSD-3 | — |
| libunibreak | zlib | — |
| MoltenVK, Vulkan, shaderc 2025.5, OpenSSL 3.3.5 | Apache-2.0 | github.com/KhronosGroup, openssl.org |
| MPVKit (empaquetage, scripts) | LGPL-3.0 | https://github.com/mpvkit/MPVKit |

**Liaison statique — tranché (2026-09-20).** Le xcframework est statique et le reste.
La LGPL (v2.1 §6 a, v3 §4 d 0) exige qu'un utilisateur puisse **relier** l'application
avec une version modifiée de la bibliothèque ; elle n'impose pas une bibliothèque
partagée. Le code complet de l'application est public, chaque version soumise taguée
(`mobile-vX.Y.Z`) : quiconque peut la reconstruire avec un autre MPVKit. Obligations : le
tag de chaque version soumise reste public ; ce fichier et l'écran Licences restent à
jour ; seule la variante LGPL part vers TestFlight et l'App Store (garde CI).

### Android — libmpv-android et le décodeur FFmpeg de Media3, en LGPL

L'APK embarque Firebase / Google Play services (notifications), **propriétaires** : la GPL
de mpv et de FFmpeg n'admet pas d'y être combinée. Jusqu'en 1.10.x, l'APK réunissait
pourtant libmpv-android (GPL v3) et le décodeur de Jellyfin (GPL v3) avec Firebase —
**non conforme**. Depuis 1.11.0, les deux lecteurs sont reconstruits SANS composant GPL et
servis par `android/maven-local` (recette : `android/maven-local/README.md`) ; la garde
`check-android-player-license.mjs` (`mobile.yml`, crans test et store) refuse tout retour
d'un artefact GPL à côté de Firebase.

| Composant | Version | Licence | Source |
|-----------|---------|---------|--------|
| libmpv-android, construction LGPL (`app.tentacletv:libmpv-lgpl`) : mpv 0.41.0 `-Dgpl=false`, FFmpeg n8.1 `--enable-version3` sans `--enable-gpl`, libass 0.17.4, libplacebo 7.360.1, FreeType 2.14.3, HarfBuzz 14.1.0, FriBidi 1.0.16, fontconfig 2.17.1, libunibreak 6.1, libxml2 2.15.2, Lua 5.2.4, mbedTLS 3.6.6 (Apache-2.0), dav1d 1.5.3 ; pont JNI MIT | 1.0.0 | **LGPL-3.0-or-later** | https://github.com/jarnedemeulemeester/libmpv-android |
| Décodeur FFmpeg de Media3, construction LGPL (`app.tentacletv:media3-decoder-ffmpeg`) : `decoder_ffmpeg` d'androidx/media avec FFmpeg 6.0 sans `--enable-gpl`, décodeurs audio seulement | 1.9.0 | **Apache-2.0 + LGPL-2.1-or-later** | https://github.com/androidx/media |
| Media3 / ExoPlayer | 1.9.0 | Apache-2.0 | https://github.com/androidx/media |
| Firebase Cloud Messaging + Google Play services (notifications) | 24.0.1 | Apache-2.0 / **propriétaire** (Android SDK License) | — |

Le code de Tentacle se lie à Firebase par la permission de `LICENSE-EXCEPTIONS` §2 ; les
composants LGPL l'admettent (bibliothèques remplaçables : AAR et `.so` séparés, sources
publiées).

### Certificats racine

`modules/mpv-player/ios/Resources/mpv/cacert.pem` (servi aussi à Android par
`assets.srcDirs`) : le paquet de certificats racine de Mozilla, extrait par curl
(https://curl.se/docs/caextract.html), **MPL-2.0**. Le FFmpeg de libmpv-android parle
mbedTLS, qui ne lit aucun magasin système : sans ce fichier (`tls-ca-file`), tout https
échouerait dans le lecteur avancé.

## Module natif dérivé de Streamyfin (MPL-2.0)

`modules/mpv-player` (Swift, Kotlin, TypeScript) dérive du module `mpv-player` de
**Streamyfin** — https://github.com/streamyfin/streamyfin, révision `4faddc5f` du
2026-09-12 — sous **Mozilla Public License 2.0**. Chaque fichier dérivé garde cette
licence (en-tête d'attribution) ; ses modifications restent sous MPL-2.0. Les fichiers
propres du module (`DisplayModeBridge.kt`, `DisplayRefreshMatcher.kt`, `MpvLoadConfig.kt`,
`MpvLogger.kt`, `ios/MpvLoadConfig.swift`) sont sous AGPL-3.0-or-later.

## Polices et icônes

Inter v3.019 (`@expo-google-fonts/inter`) et Noto Sans Regular v2.015
(`modules/mpv-player/ios/Fonts/NotoSans-Regular.ttf`, repli des sous-titres) — **SIL Open
Font License 1.1**, texte dans l'écran Licences et `Fonts/OFL.txt`. Feather
(`@expo/vector-icons`, MIT), Lucide (`lucide-react-native`, ISC).

## Autres dépendances

React Native 0.81, Expo 54, Hermes, react-native-video, Fresco, SDWebImage (MIT) ; folly
(Apache-2.0), boost (BSL-1.0), glog, double-conversion, SocketRocket, libwebp (BSD-3),
libavif (BSD-2) ; voir l'écran Licences et le `package.json` de chaque paquet.
