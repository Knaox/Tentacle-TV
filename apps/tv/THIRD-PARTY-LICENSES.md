# Licences tierces — Tentacle TV (téléviseurs)

Tentacle TV (application) est distribué sous licence **MIT**.

## Apple TV — PrismCore

L'application tvOS lit en direct ce qu'AVPlayer n'ouvre pas tel quel (MKV,
DTS / TrueHD, HDR et Dolby Vision) grâce à **PrismCore** : il démuxe la source,
la remuxe en HLS-fMP4 et la sert en local ; AVPlayer et l'interface restent
celles de Tentacle TV. Rien n'est ré-encodé.

| Composant | Version | Licence | Source |
|-----------|---------|---------|--------|
| PrismCore | 3.2.2, **copie modifiée** dans `apps/tv/ios/Vendor/PrismCore` | **LGPL-2.1-or-later avec Application Store Exception** | https://github.com/Wenzlik/PrismCore — modifications : `apps/tv/ios/Vendor/PrismCore/README.md` |
| FFmpeg (libavcodec, libavformat, libavutil, libswresample, libswscale) | celle de MPVKit 1.0.x | **LGPL v2.1+** (sans `--enable-gpl`) | https://ffmpeg.org — binaires et recette : https://github.com/mpvkit/MPVKit |
| MPVKit (empaquetage, xcframeworks **dynamiques**) | 1.0.x | LGPL v3 (scripts) ; chaque bibliothèque garde sa licence | https://github.com/mpvkit/MPVKit |
| libdovi (conversion Dolby Vision 7 → 8.1) | via MPVKit | MIT | https://github.com/quietvoid/dovi_tool |

**Ce que l'exception demande, et ce qu'on fait.** La LGPL §6 exige qu'un
utilisateur puisse relier l'application avec une version modifiée de la
bibliothèque, ce qu'un `.ipa` signé ne permet pas ; l'exception de PrismCore
lève cette exigence pour la distribution en boutique, à deux conditions :

1. **Les modifications de PrismCore sont publiées sous LGPL.** Tentacle TV
   embarque une copie de la 3.2.2 dont le pont audio est corrigé (l'AAC
   ponté des pistes DTS / TrueHD portait une disposition que les décodeurs
   d'Apple refusent) ; cette copie, sa licence et la description du
   changement vivent dans `apps/tv/ios/Vendor/PrismCore`, dans ce dépôt public.
2. **La mention est visible** : l'écran « À propos » de l'application dit qu'elle
   embarque PrismCore, sous quelle licence, et où en trouver la source. Le texte
   de la licence (LGPL-2.1 + exception) est le fichier `LICENSE` du dépôt de
   PrismCore, référencé ici et dans l'application.

FFmpeg n'est **pas** couvert par l'exception : il arrive en frameworks
**dynamiques**, embarqués et signés par SwiftPM. C'est cette liaison dynamique
qui satisfait la §6 de la LGPL v2.1 — remplacer les frameworks suffit à
relier — sans le raisonnement « liaison statique » du mobile
(`apps/mobile/THIRD-PARTY-LICENSES.md`), qui ne s'applique pas ici.

## Android TV — Media3, libmpv-android et le décodeur FFmpeg de Jellyfin

Le lecteur principal est Media3/ExoPlayer (rendu direct sur la surface, HDR
et Dolby Vision natifs) ; libmpv ne sert qu'au transcodage.

| Composant | Licence | Source |
|-----------|---------|--------|
| Media3 / ExoPlayer (`androidx.media3`, version dans `apps/tv/android/app/build.gradle`) | Apache 2.0 | https://github.com/androidx/media |
| libmpv-android (`dev.jdtech.mpv:libmpv`, version dans le même fichier) : mpv, FFmpeg (`--enable-gpl --enable-version3`), libass, dav1d | **GPL v3** | https://github.com/jarnedemeulemeester/libmpv-android |
| `org.jellyfin.media3:media3-ffmpeg-decoder` (extension audio FFmpeg pour Media3) | **GPL v3** | https://github.com/jellyfin/jellyfin-androidx-media |
| `com/tentacletv/mpv/MPVLib.kt` — enveloppe par instance de libmpv-android, dérivée du module `mpv-player` de Streamyfin (révision `4faddc5f` du 2026-09-12) ; chaque modification y reste sous la même licence | **MPL-2.0** | https://github.com/streamyfin/streamyfin — https://mozilla.org/MPL/2.0/ |
| `app/src/main/assets/mpv/cacert.pem` — certificats racine de Mozilla (extrait par curl, https://curl.se/docs/caextract.html), même copie que le mobile ; le FFmpeg de libmpv-android parle mbedTLS, sans magasin système | **MPL-2.0** | https://curl.se/docs/caextract.html |

Ces composants GPL sont compatibles avec la licence MIT de l'application, dont
les sources sont publiées ; Google Play n'y oppose aucune règle.

## Autres dépendances

react-native-tvos (MIT), react-native-video (MIT) et les dépendances
JavaScript de l'application sont sous licences permissives ; voir le
`package.json` de chaque paquet.
