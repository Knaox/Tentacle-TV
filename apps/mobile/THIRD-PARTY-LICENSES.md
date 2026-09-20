# Licences tierces — Tentacle TV Mobile

Tentacle TV (application) est distribué sous licence **MIT**.

## Lecteur avancé (libmpv)

L'application mobile embarque **libmpv** pour lire tel quel ce que le lecteur
système ne lit pas (MKV, DTS, TrueHD, Opus, ASS stylé, PGS, codecs anciens…).
Le lecteur système (AVPlayer sur iOS, ExoPlayer sur Android) reste le premier
choix là où il gagne.

### iOS — MPVKit

| Version | Licence des binaires | Usage |
|---------|----------------------|-------|
| Binaires du fork Streamyfin `0.41.0-av5` (`apps/mobile/ios/MPVKit.podspec`) | **GPL v3** (mpv avec composants GPL, libsmbclient) | Développement et TestFlight **seulement** |
| Variante LGPL construite par `.github/workflows/mpvkit.yml` | **LGPL v2.1+ / LGPL v3** (mpv `-Dgpl=false`, FFmpeg sans `--enable-gpl`, sans smbclient) | **Obligatoire avant toute soumission à l'App Store** |

Avant soumission : lancer `mpvkit.yml` (dispatch manuel), reporter l'URL et la
somme SHA-256 de la Release `mpvkit-lgpl-<version>` dans
`apps/mobile/ios/MPVKit.podspec` (`:http`, `:sha256`, `version`, `license`).

Composants de MPVKit (liste du script de construction du fork, `Sources/BuildScripts/XCFrameworkBuild/main.swift`) :

| Composant | Licence | Source |
|-----------|---------|--------|
| mpv 0.41 (+ `vo_avfoundation` du fork) | LGPL v2.1+ (`-Dgpl=false`) | https://github.com/mpv-player/mpv — fork : https://github.com/streamyfin/MPVKit |
| FFmpeg 8.1 | LGPL v2.1+ (sans `--enable-gpl`) | https://ffmpeg.org |
| libass | ISC | https://github.com/libass/libass |
| libplacebo 7 | LGPL v2.1+ | https://code.videolan.org/videolan/libplacebo |
| MoltenVK, Vulkan headers, shaderc | Apache 2.0 | https://github.com/KhronosGroup |
| dav1d (construit **sans assembleur**) | BSD-2 | https://code.videolan.org/videolan/dav1d |
| libdovi | MIT | https://github.com/quietvoid/dovi_tool |
| uavs3d | BSD-3 | https://github.com/uavs3/uavs3d |
| FreeType | FTL (BSD-like) | https://freetype.org |
| HarfBuzz | MIT | https://github.com/harfbuzz/harfbuzz |
| FriBidi | LGPL v2.1+ | https://github.com/fribidi/fribidi |
| libunibreak | Zlib | https://github.com/adah1972/libunibreak |
| Little CMS 2 | MIT | https://github.com/mm2/Little-CMS |
| uchardet | MPL 1.1 / GPL / LGPL (triple) | https://www.freedesktop.org/wiki/Software/uchardet |
| GnuTLS, Nettle, GMP | LGPL v2.1+ / LGPL v3 (GMP : LGPL v3 ou GPL v2) | https://www.gnutls.org |
| OpenSSL | Apache 2.0 | https://www.openssl.org |
| libbluray | LGPL v2.1+ | https://www.videolan.org/developers/libbluray.html |
| libsmbclient (Samba) | **GPL v3 — build GPL seulement**, absent de la variante LGPL | https://www.samba.org |
| LuaJIT | MIT — build GPL seulement ; aucun script n'est chargé | https://luajit.org |
| MPVKit (empaquetage, scripts) | LGPL v3 | https://github.com/mpvkit/MPVKit |

Conformité LGPL : les sources des versions utilisées et la recette de
compilation sont publiques (dépôts ci-dessus, workflow `mpvkit.yml` versionné
ici) ; la mention figure dans « À propos › Crédits » de l'application.

**Liaison statique — tranché (2026-09-20).** Le xcframework est statique et le
reste. La LGPL (v2.1 §6 a, v3 §4 d 0) exige qu'un utilisateur puisse
**relier** l'application avec une version modifiée de la bibliothèque ; elle
n'impose pas une bibliothèque partagée. Tentacle TV est publié sous MIT, code
complet sur GitHub, chaque version livrée étant taguée (`mobile-vX.Y.Z`) :
quiconque peut reconstruire l'application depuis ses sources avec un autre
MPVKit. C'est le « code de l'application » en forme source que la licence
demande. Trois obligations en découlent, et rien d'autre : le tag de chaque
version soumise reste public ; ce fichier et les crédits restent à jour ; la
variante LGPL (`mpvkit.yml`) est celle du paquet soumis à l'App Store.

### Android — libmpv-android et le décodeur FFmpeg de Jellyfin

| Composant | Licence | Source |
|-----------|---------|--------|
| libmpv-android 1.0.0 (`dev.jdtech.mpv:libmpv`) : mpv 0.41, FFmpeg 8.1 (`--enable-gpl --enable-version3`), libass, fontconfig, dav1d | **GPL v3** | https://github.com/jarnedemeulemeester/libmpv-android |
| `org.jellyfin.media3:media3-ffmpeg-decoder` 1.9.0+1 (extension audio FFmpeg pour Media3/ExoPlayer) | **GPL v3** | https://github.com/jellyfin/jellyfin-androidx-media |

Ces composants GPL sont compatibles avec la licence MIT de l'application,
dont les sources sont publiées ; Google Play n'y oppose aucune règle.

## Module natif dérivé de Streamyfin (MPL-2.0)

Le module `apps/mobile/modules/mpv-player` (Swift, Kotlin, TypeScript) est
dérivé du module `mpv-player` de **Streamyfin** — https://github.com/streamyfin/streamyfin,
révision `4faddc5f` du 2026-09-12 — publié sous **Mozilla Public License 2.0**.
Chaque fichier dérivé conserve cette licence (en-tête d'attribution) ; les
modifications y restent sous MPL-2.0. Texte de la licence :
https://mozilla.org/MPL/2.0/.

## Police embarquée

`Noto Sans Regular` (`modules/mpv-player/ios/Fonts/NotoSans-Regular.ttf`),
police latine de repli des sous-titres du lecteur avancé — **SIL Open Font
License 1.1** (`Fonts/OFL.txt`).

## Autres dépendances

react-native-video (MIT), Media3/ExoPlayer (Apache 2.0) et les dépendances
JavaScript de l'application sont sous licences permissives ; voir le
`package.json` de chaque paquet.
