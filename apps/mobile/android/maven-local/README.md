# Lecteurs Android en LGPL — dépôt Maven local du mobile

L'APK du mobile embarque **Firebase / Google Play services**, propriétaires : la GPL de
mpv et de FFmpeg n'admet pas d'y être combinée. Les deux lecteurs natifs sont donc
reconstruits **sans aucun composant GPL** et rangés ici, servis par
`android/build.gradle` (`maven { url = uri("$rootDir/maven-local") }`). La garde
`.github/scripts/check-android-player-license.mjs` (job `prepare` de `mobile.yml`) refuse
tout artefact GPL à côté de Firebase et lit la licence gravée dans chaque AAR d'ici.

| Artefact | Remplace | Contenu | Licence |
|---|---|---|---|
| `app.tentacletv:libmpv-lgpl:1.0.0` | `dev.jdtech.mpv:libmpv:1.0.0` (GPL v3) | libmpv-android v1.0.0 : mpv 0.41.0 `-Dgpl=false`, FFmpeg n8.1 **sans** `--enable-gpl` (avec `--enable-version3`, qu'exige mbedTLS), mêmes dépendances (`depinfo.sh`) | **LGPL-3.0-or-later** (mpv LGPL-2.1+, FFmpeg LGPL-3.0+) ; pont JNI et `classes.jar` MIT (mpv-android) |
| `app.tentacletv:media3-decoder-ffmpeg:1.9.0` | `org.jellyfin.media3:media3-ffmpeg-decoder:1.9.0+1` (GPL v3) | `libraries/decoder_ffmpeg` d'androidx/media **1.9.0**, FFmpeg 6.0 (`release/6.0`, `b4a62c32`) sans `--enable-gpl`, décodeurs `flac alac pcm_mulaw pcm_alaw mp3 aac ac3 eac3 dca mlp truehd` — ceux de Jellyfin | **Apache-2.0** (code Java/JNI) + **LGPL-2.1-or-later** (FFmpeg lié dans `libffmpegJNI.so`) |

Vérifié le 2026-10-07 contre les AAR remplacés : mêmes classes Java, mêmes points
d'entrée JNI, mêmes décodeurs (décodeur Media3) ; mêmes bibliothèques et mêmes ABI
(`arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`) pour libmpv. En LGPL, mpv ne perd que des
fonctions absentes d'Android (CD audio, DVB, DVD, JACK, OSS, X11) et FFmpeg que `postproc`
et les filtres GPL, déjà désactivés (`--disable-filters`).

L'Android TV, qui n'embarque rien de propriétaire, garde les artefacts GPL d'origine.

## Recette — libmpv-lgpl

```bash
git clone --depth 1 --branch v1.0.0 https://github.com/jarnedemeulemeester/libmpv-android.git
cd libmpv-android/buildscripts
# LGPL : deux lignes changent.
sed -i 's/--enable-{gpl,version3}/--enable-version3/' scripts/ffmpeg.sh
sed -i 's/-Dlibmpv=true -Dcplayer=false \\/-Dlibmpv=true -Dcplayer=false -Dgpl=false \\/' scripts/mpv.sh
./download.sh && ./patch.sh            # macOS : coreutils, gnu-sed, meson ≥ 1.6.1, jinja2
for a in arm64 armv7l x86_64 x86; do ./build.sh --arch $a mpv; done
```

L'AAR reprend celui de libmpv-android v1.0.0 (`classes.jar`, `libplayer.so` — le pont JNI
MIT —, `libc++_shared.so`) et remplace dans `jni/<abi>/` les bibliothèques construites :
`libmpv.so`, `libavcodec.so`, `libavdevice.so`, `libavfilter.so`, `libavformat.so`,
`libavutil.so`, `libswresample.so`, `libswscale.so` (depuis `prefix/<abi>/lib`).
Contrôle : `unzip -p <aar> jni/arm64-v8a/libavutil.so | strings | grep 'license:'` →
`libavutil license: LGPL version 3 or later`.

## Recette — media3-decoder-ffmpeg

```bash
git clone --depth 1 --branch 1.9.0 https://github.com/androidx/media.git
git clone --depth 1 --branch release/6.0 https://github.com/FFmpeg/FFmpeg.git ffmpeg   # b4a62c32
M=media/libraries/decoder_ffmpeg/src/main
ln -s "$PWD/ffmpeg" $M/jni/ffmpeg
(cd $M/jni && ./build_ffmpeg.sh "$PWD/.." "$ANDROID_HOME/ndk/26.1.10909125" darwin-x86_64 23 \
  flac alac pcm_mulaw pcm_alaw mp3 aac ac3 eac3 dca mlp truehd)   # linux-x86_64 sous Linux
(cd media && ./gradlew :lib-decoder-ffmpeg:assembleRelease)
# → media/libraries/decoder_ffmpeg/buildout/outputs/aar/lib-decoder-ffmpeg-release.aar
```

`build_ffmpeg.sh` d'androidx ne passe pas `--enable-gpl` : FFmpeg y est « LGPL version 2.1
or later » (`config.h`).

## Sources

Les archives amont de ces composants (et la recette) sont miroitées à chaque livraison
dans la pré-version `sources-mobile-vX.Y.Z` (`.github/workflows/sources.yml`,
`.github/scripts/lib/source-offer.mjs`). Licences et inventaire :
`apps/mobile/THIRD-PARTY-LICENSES.md`, `docs/LICENCES.md`.
