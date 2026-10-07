import type { ThirdPartyComponent } from "../licenseTypes";
import { ANDROID } from "./platforms";

// Les lecteurs Android. Deux régimes, et la garde de la CI les tient
// (.github/scripts/lib/android-player-license.mjs) :
// - le MOBILE embarque Firebase (propriétaire) : ses lecteurs sont LGPL —
//   libmpv-android et le décodeur FFmpeg de Media3 reconstruits sans GPL
//   (apps/mobile/android/maven-local) ;
// - l'ANDROID TV n'embarque rien de propriétaire : libmpv-android et le
//   décodeur de Jellyfin y restent GPL v3, ce que l'AGPL v3 permet (§13).
// Le POM de libmpv-android dit « MIT » : c'est la licence de ses SCRIPTS.

const LIBMPV = "https://github.com/jarnedemeulemeester/libmpv-android (v1.0.0, buildscripts/include/depinfo.sh)";
const LGPL_BUILD = "rebuilt without GPL for Tentacle TV — recipe: apps/mobile/android/maven-local/README.md";
const GPL3 = ["GPL-3.0"] as const;
const LGPL3 = ["LGPL-3.0", "GPL-3.0"] as const;

export const ANDROID_MEDIA: readonly ThirdPartyComponent[] = [
  {
    name: "libmpv-android", version: "1.0.0", license: "GPL-3.0-or-later", texts: GPL3,
    source: LIBMPV, platforms: ["androidtv"], note: "The binaries as a whole are GPL; the build scripts are MIT.",
  },
  { name: "mpv (in libmpv-android)", version: "0.41.0", license: "GPL-2.0-or-later", texts: GPL3, notice: "Copyright © the mpv developers.", source: `https://github.com/mpv-player/mpv — ${LIBMPV}`, platforms: ["androidtv"] },
  { name: "FFmpeg (in libmpv-android)", version: "8.1", license: "GPL-3.0-or-later", texts: GPL3, notice: "Copyright © the FFmpeg developers.", source: `https://ffmpeg.org — ${LIBMPV}`, platforms: ["androidtv"], note: "Configured with --enable-gpl --enable-version3." },
  {
    name: "libmpv-android (LGPL build)", version: "1.0.0", license: "LGPL-3.0-or-later", texts: LGPL3,
    source: `${LIBMPV} — ${LGPL_BUILD}`, platforms: ["android"],
  },
  { name: "mpv (in libmpv-android)", version: "0.41.0", license: "LGPL-2.1-or-later", texts: ["LGPL-2.1"], notice: "Copyright © the mpv developers.", source: `https://github.com/mpv-player/mpv — ${LGPL_BUILD}`, platforms: ["android"], note: "Built with -Dgpl=false." },
  { name: "FFmpeg (in libmpv-android)", version: "8.1", license: "LGPL-3.0-or-later", texts: LGPL3, notice: "Copyright © the FFmpeg developers.", source: `https://ffmpeg.org — ${LGPL_BUILD}`, platforms: ["android"], note: "Configured with --enable-version3 (mbedTLS), without --enable-gpl." },
  { name: "mbedTLS", version: "3.6.6", license: "Apache-2.0", texts: ["Apache-2.0"], notice: "Copyright © The Mbed TLS Contributors.", source: "https://github.com/Mbed-TLS/mbedtls", platforms: ANDROID, note: "Dual-licensed Apache-2.0 OR GPL-2.0-or-later; used under Apache-2.0." },
  { name: "libplacebo", version: "7.360.1", license: "LGPL-2.1-or-later", texts: ["LGPL-2.1"], source: "https://code.videolan.org/videolan/libplacebo", platforms: ANDROID },
  { name: "FriBidi", version: "1.0.16", license: "LGPL-2.1-or-later", texts: ["LGPL-2.1"], source: "https://github.com/fribidi/fribidi", platforms: ANDROID },
  { name: "libass", version: "0.17.4", license: "ISC", texts: ["ISC"], notice: "Copyright © the libass contributors.", source: "https://github.com/libass/libass", platforms: ANDROID },
  {
    name: "FreeType", version: "2.14.3", license: "FTL", texts: ["FTL"],
    notice: "Portions of this software are copyright © The FreeType Project (www.freetype.org). All rights reserved.",
    source: "https://freetype.org", platforms: ANDROID,
  },
  { name: "HarfBuzz", version: "14.1.0", license: "MIT", texts: ["MIT"], notice: "Copyright © the HarfBuzz authors.", source: "https://github.com/harfbuzz/harfbuzz", platforms: ANDROID },
  { name: "fontconfig", version: "2.17.1", license: "MIT", texts: ["MIT"], notice: "Copyright © Keith Packard and the fontconfig authors.", source: "https://gitlab.freedesktop.org/fontconfig/fontconfig", platforms: ANDROID },
  { name: "libunibreak", version: "6.1", license: "Zlib", texts: ["Zlib"], notice: "Copyright © Wu Yongwei and contributors.", source: "https://github.com/adah1972/libunibreak", platforms: ANDROID },
  { name: "libxml2", version: "2.15.2", license: "MIT", texts: ["MIT"], notice: "Copyright © Daniel Veillard and the libxml2 authors.", source: "https://gitlab.gnome.org/GNOME/libxml2", platforms: ANDROID },
  { name: "Lua", version: "5.2.4", license: "MIT", texts: ["MIT"], notice: "Copyright © 1994–2015 Lua.org, PUC-Rio.", source: "https://www.lua.org", platforms: ANDROID },
  { name: "dav1d", version: "1.5.3", license: "BSD-2-Clause", texts: ["BSD-2-Clause"], notice: "Copyright © VideoLAN and dav1d authors.", source: "https://code.videolan.org/videolan/dav1d", platforms: ANDROID },
  { name: "mpv-android (JNI bridge)", version: null, license: "MIT", texts: ["MIT"], notice: "Copyright © Ilya Zhuravlev and sfan5.", source: LIBMPV, platforms: ANDROID },
  {
    name: "AndroidX Media3 FFmpeg decoder (LGPL build)", version: "1.9.0", license: "Apache-2.0 AND LGPL-2.1-or-later", texts: ["Apache-2.0", "LGPL-2.1"],
    notice: "Copyright © The Android Open Source Project; FFmpeg © the FFmpeg developers.",
    source: `https://github.com/androidx/media (1.9.0, libraries/decoder_ffmpeg) with FFmpeg 6.0 — ${LGPL_BUILD}`, platforms: ["android"],
    note: "Audio decoders only (AC-3, E-AC-3, DTS, TrueHD, FLAC, ALAC, MP3, AAC, PCM). Replaces Jellyfin's GPL-3.0 build.",
  },
  {
    name: "Jellyfin Media3 FFmpeg decoder", version: "1.8.0+1", license: "GPL-3.0-only", texts: GPL3,
    source: "https://github.com/jellyfin/jellyfin-androidx-media (v1.8.0+1)", platforms: ["androidtv"],
    note: "Audio decoders only; the FFmpeg 6.0 it contains is LGPL-2.1-or-later.",
  },
  { name: "AndroidX Media3 (ExoPlayer)", version: "1.9.0", license: "Apache-2.0", texts: ["Apache-2.0"], notice: "Copyright © The Android Open Source Project.", source: "https://github.com/androidx/media", platforms: ["android"] },
  { name: "AndroidX Media3 (ExoPlayer)", version: "1.8.0", license: "Apache-2.0", texts: ["Apache-2.0"], notice: "Copyright © The Android Open Source Project.", source: "https://github.com/androidx/media", platforms: ["androidtv"] },
  { name: "LLVM libc++ (NDK)", version: "29", license: "Apache-2.0 WITH LLVM-exception", texts: ["Apache-2.0", "LLVM-exception"], source: "https://github.com/llvm/llvm-project", platforms: ANDROID },
  {
    name: "Firebase Cloud Messaging, Google Play services", version: "24.0.1", license: "LicenseRef-Android-SDK", texts: [],
    notice: "Copyright © Google LLC. Proprietary platform library (Android Software Development Kit License).",
    source: "https://developer.android.com/studio/terms", platforms: ["android"],
    note: "Push notifications only. Not free software: see LICENSE-EXCEPTIONS, section 2.",
  },
];
