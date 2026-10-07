# Licences tierces — Tentacle TV (téléviseurs)

Tentacle TV est distribué sous **GNU AGPL v3.0 ou ultérieure** (`LICENSE`), avec
les permissions additionnelles de `LICENSE-EXCEPTIONS`. Source de chaque version :
tag `tv-vX.Y.Z` de https://github.com/Knaox/Tentacle-TV. Les versions publiées avant
le 2026-10-07 restent sous licence MIT.

**Réglages › Licences** (Apple TV et Android TV) : la mention de l'AGPL, la source de
la version, les composants embarqués et le **texte complet** de chaque licence, lisible
à la télécommande et sans réseau (catalogue : `packages/shared/src/licenses/`).

## Apple TV — PrismCore et MPVKit

L'application tvOS lit en direct ce qu'AVPlayer n'ouvre pas tel quel (MKV, DTS /
TrueHD, HDR et Dolby Vision) grâce à **PrismCore**, qui démuxe et remuxe en HLS-fMP4
servi en local ; rien n'est ré-encodé.

| Composant | Version | Licence | Source |
|-----------|---------|---------|--------|
| PrismCore | 3.2.2 (commit `9fa49af`), **copie modifiée** dans `apps/tv/ios/Vendor/PrismCore` | **LGPL-2.1-or-later avec Application Store Exception** | https://github.com/Wenzlik/PrismCore |
| MPVKit (produit `MPVKit`, **non GPL**) | 1.0.0, révision `288527d` (`Package.resolved`) | LGPL-3.0 (scripts) | https://github.com/mpvkit/MPVKit |
| FFmpeg (libavcodec, libavformat, libavutil, libswresample, libswscale) | n8.1.2, sans `--enable-gpl`, `--enable-version3` | **LGPL-3.0-or-later** | https://ffmpeg.org |
| GnuTLS 3.8.11, FriBidi, libplacebo 7.360.1 | — | LGPL-2.1-or-later | gnutls.org, github.com/fribidi, code.videolan.org |
| GMP, Nettle | — | LGPL-3.0-or-later (ou GPL-2+, option non retenue) | gmplib.org, lysator.liu.se/~nisse/nettle |
| dav1d 1.5.3 · uavs3d 1.2.1 · libass 0.17.5 · FreeType · HarfBuzz · lcms2 2.17 · libunibreak · libdovi 3.3.2 | — | BSD-2 · BSD-3 · ISC · FTL · MIT · MIT · zlib · MIT | voir l'écran Licences |
| shaderc 2025.5, MoltenVK 1.4.2, OpenSSL 3.3.5 | — | Apache-2.0 | github.com/KhronosGroup, openssl.org |

Aucun code GPL dans le binaire (vérifié sur le build Release du 2026-10-03 : ni
`libmpv`, ni libsmbclient, ni LuaJIT).

**Liaison STATIQUE.** Les xcframeworks de MPVKit 1.0.0 sont des archives statiques :
FFmpeg et ses dépendances sont DANS l'exécutable, et les `Frameworks/*.framework` de
l'app sont des bouchons vides. (Ce fichier, l'écran « À propos » et le `NOTICE.md` de
PrismCore disaient « liés dynamiquement » : c'était faux.) La LGPL est tenue comme pour
le mobile : le code de l'application, publié à chaque tag livré, permet de la
reconstruire avec une bibliothèque modifiée (LGPL-3 §4 d 0).

**L'exception de PrismCore** dispense de la §6 de la LGPL pour la distribution en
boutique, à deux conditions : (1) les modifications de PrismCore restent sous LGPL et
publiées — `apps/tv/ios/Vendor/PrismCore` ; (2) l'app dit qu'elle embarque PrismCore,
où en trouver la source, **avec une copie de la licence** — l'onglet Licences porte
désormais le texte intégral (il manquait jusqu'en 1.10.x). L'exception ne couvre pas
FFmpeg ni les autres bibliothèques.

## Android TV — Media3, libmpv-android et le décodeur FFmpeg de Jellyfin

| Composant | Version | Licence | Source |
|-----------|---------|---------|--------|
| Media3 / ExoPlayer (`media3-exoplayer`, `-hls`, `-ui`) | 1.8.0 | Apache-2.0 | https://github.com/androidx/media |
| libmpv-android `dev.jdtech.mpv:libmpv` : mpv 0.41.0 (GPL-2+), FFmpeg n8.1 (`--enable-gpl --enable-version3`), libass, libplacebo, FreeType, HarfBuzz, FriBidi, fontconfig, libunibreak, libxml2, Lua 5.2.4, mbedTLS 3.6.6, dav1d 1.5.3 — le POM dit « MIT » : licence des scripts | 1.0.0 | **GPL-3.0-or-later** | https://github.com/jarnedemeulemeester/libmpv-android (`buildscripts/include/depinfo.sh`) |
| `org.jellyfin.media3:media3-ffmpeg-decoder` — décodeurs AUDIO seulement (son FFmpeg 6.0 est LGPL-2.1+) | 1.8.0+1 | **GPL-3.0** | https://github.com/jellyfin/jellyfin-androidx-media |
| `com/tentacletv/mpv/MPVLib.kt`, dérivé de Streamyfin (`4faddc5f`) | — | MPL-2.0 | https://github.com/streamyfin/streamyfin |
| `app/src/main/assets/mpv/cacert.pem` (racines de Mozilla, extrait par curl) | — | MPL-2.0 | https://curl.se/docs/caextract.html |
| libc++ du NDK | 29 | Apache-2.0 WITH LLVM-exception | llvm.org |

Les composants GPL v3 sont compatibles avec l'AGPL v3 (section 13) ; l'APK Android TV
ne contient aucun composant propriétaire. `DvCompatRenderer.kt` reprend une TECHNIQUE
citée par JellyDV / VoidTV (VoidTV : GPL-3.0), sans code copié.

## Interface

react-native-tvos 0.80 (MIT), Hermes (MIT), react-native-video (MIT), FlashList,
Reanimated, react-native-svg (MIT), folly (Apache-2.0), boost (BSL-1.0), glog,
double-conversion, SocketRocket (BSD-3), {fmt} (MIT) ; police **Inter** v4.001 (OFL-1.1,
`assets/Inter-OFL.txt`) ; pictogrammes : tracés de **Lucide** (ISC, avec des portions
de Feather sous MIT) recopiés dans `src/redesign/icons/iconPaths.ts`.
