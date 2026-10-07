import type { ThirdPartyComponent } from "../licenseTypes";
import { DESKTOP } from "./platforms";

// Le bureau : Electron, et la chaîne mpv + FFmpeg de chaque système.
// - macOS (Mac App Store) : construite par build-mpv-lgpl-macos.sh, LGPL,
//   bibliothèques dynamiques dans Contents/Frameworks ;
// - Windows (Microsoft Store) : libmpv-2.dll de mpv-winbuild (variante
//   LGPL, FFmpeg en --enable-version3 lié dedans), donc LGPL v3 ;
// - Linux : construite par build-mpv-linux.sh, mpv en GPL (sa sortie X11
//   n'existe pas autrement), FFmpeg LGPL lié dedans.
// La variable TENTACLE_MPV_LIB charge une libmpv modifiée (LGPL : relier).

const MAC = "apps/desktop-electron/scripts/build-mpv-lgpl-macos.sh";
const LINUX = "apps/desktop-electron/scripts/build-mpv-linux.sh";
const WINBUILD = "https://github.com/zhongfly/mpv-winbuild (LGPL variant, mpv-winbuild-cmake)";

export const DESKTOP_MEDIA: readonly ThirdPartyComponent[] = [
  {
    name: "Electron", version: "43.2.0", license: "MIT", texts: ["MIT"], notice: "Copyright © Electron contributors; Copyright © GitHub Inc.",
    source: "https://github.com/electron/electron", platforms: DESKTOP,
    note: "Includes Chromium, whose third-party notices ship as LICENSES.chromium.html.",
  },
  { name: "koffi", version: "3.1.2", license: "MIT", texts: ["MIT"], notice: "Copyright © Niels Martignène.", source: "https://koffi.dev", platforms: DESKTOP },
  { name: "mpv (libmpv)", version: "0.40.0", license: "LGPL-2.1-or-later", texts: ["LGPL-2.1"], notice: "Copyright © the mpv developers.", source: `https://github.com/mpv-player/mpv — recipe: ${MAC}`, platforms: ["macos"], note: "Built with -Dgpl=false; shipped as a separate dynamic library." },
  { name: "FFmpeg", version: "7.1.1", license: "LGPL-2.1-or-later", texts: ["LGPL-2.1"], notice: "Copyright © the FFmpeg developers.", source: `https://ffmpeg.org — recipe: ${MAC}`, platforms: ["macos"], note: "Configured with --disable-gpl --disable-nonfree; dynamic libraries." },
  { name: "mpv (libmpv-2.dll)", version: "0.41.0-dev", license: "LGPL-2.1-or-later", texts: ["LGPL-2.1"], notice: "Copyright © the mpv developers.", source: `https://github.com/mpv-player/mpv — ${WINBUILD}`, platforms: ["windows"], note: "Built with -Dgpl=false." },
  { name: "FFmpeg (in libmpv-2.dll)", version: "8", license: "LGPL-3.0-or-later", texts: ["LGPL-3.0", "GPL-3.0"], notice: "Copyright © the FFmpeg developers.", source: `https://ffmpeg.org — ${WINBUILD}`, platforms: ["windows"], note: "Configured with --enable-version3, without --enable-gpl." },
  { name: "mpv (libmpv.so)", version: "0.41.0", license: "GPL-2.0-or-later", texts: ["GPL-3.0", "GPL-2.0"], notice: "Copyright © the mpv developers.", source: `https://github.com/mpv-player/mpv — recipe: ${LINUX}`, platforms: ["linux"], note: "Built with -Dgpl=true, required by its X11 video output." },
  { name: "FFmpeg (in libmpv.so)", version: "7.1.1", license: "LGPL-2.1-or-later", texts: ["LGPL-2.1"], notice: "Copyright © the FFmpeg developers.", source: `https://ffmpeg.org — recipe: ${LINUX}`, platforms: ["linux"] },
  { name: "libplacebo", version: null, license: "LGPL-2.1-or-later", texts: ["LGPL-2.1"], source: "https://code.videolan.org/videolan/libplacebo", platforms: DESKTOP },
  { name: "FriBidi", version: null, license: "LGPL-2.1-or-later", texts: ["LGPL-2.1"], source: "https://github.com/fribidi/fribidi", platforms: DESKTOP },
  { name: "GLib, gettext (libintl)", version: null, license: "LGPL-2.1-or-later", texts: ["LGPL-2.1"], source: "https://gitlab.gnome.org/GNOME/glib — https://www.gnu.org/software/gettext/", platforms: ["macos"] },
  { name: "Graphite2", version: null, license: "LGPL-2.1-or-later", texts: ["LGPL-2.1"], source: "https://github.com/silnrsi/graphite", platforms: ["macos", "linux"], note: "Multi-licensed; used under the LGPL." },
  { name: "libbluray", version: null, license: "LGPL-2.1-or-later", texts: ["LGPL-2.1"], source: "https://www.videolan.org/developers/libbluray.html", platforms: ["windows"] },
  { name: "libsoxr", version: null, license: "LGPL-2.1-or-later", texts: ["LGPL-2.1"], source: "https://sourceforge.net/projects/soxr/", platforms: ["linux"] },
  { name: "LAME", version: null, license: "LGPL-2.0-or-later", texts: ["LGPL-2.1"], source: "https://lame.sourceforge.io", platforms: ["windows"] },
  { name: "uchardet", version: null, license: "LGPL-2.1-or-later", texts: ["LGPL-2.1"], source: "https://www.freedesktop.org/wiki/Software/uchardet/", platforms: ["windows"], note: "Triple-licensed; used under the LGPL." },
  { name: "libass", version: null, license: "ISC", texts: ["ISC"], notice: "Copyright © the libass contributors.", source: "https://github.com/libass/libass", platforms: DESKTOP },
  {
    name: "FreeType", version: null, license: "FTL", texts: ["FTL"],
    notice: "Portions of this software are copyright © The FreeType Project (www.freetype.org). All rights reserved.",
    source: "https://freetype.org", platforms: DESKTOP,
  },
  { name: "HarfBuzz", version: null, license: "MIT", texts: ["MIT"], notice: "Copyright © the HarfBuzz authors.", source: "https://github.com/harfbuzz/harfbuzz", platforms: DESKTOP },
  { name: "Little CMS 2", version: null, license: "MIT", texts: ["MIT"], notice: "Copyright © Marti Maria Saguer.", source: "https://github.com/mm2/Little-CMS", platforms: DESKTOP },
  { name: "dav1d", version: null, license: "BSD-2-Clause", texts: ["BSD-2-Clause"], notice: "Copyright © VideoLAN and dav1d authors.", source: "https://code.videolan.org/videolan/dav1d", platforms: DESKTOP },
  { name: "libunibreak", version: null, license: "Zlib", texts: ["Zlib"], notice: "Copyright © Wu Yongwei and contributors.", source: "https://github.com/adah1972/libunibreak", platforms: DESKTOP },
  { name: "libpng", version: "1.6", license: "libpng-2.0", texts: ["libpng-2.0"], notice: "Copyright © the PNG Reference Library Authors.", source: "http://www.libpng.org/pub/png/libpng.html", platforms: ["macos", "linux"] },
  {
    name: "libjpeg-turbo", version: null, license: "IJG AND BSD-3-Clause AND Zlib", texts: ["IJG", "BSD-3-Clause", "Zlib"],
    notice: "This software is based in part on the work of the Independent JPEG Group.", source: "https://libjpeg-turbo.org", platforms: ["macos"],
  },
  { name: "PCRE2", version: null, license: "BSD-3-Clause", texts: ["BSD-3-Clause"], notice: "Copyright © University of Cambridge.", source: "https://github.com/PCRE2Project/pcre2", platforms: ["macos"] },
  { name: "libX11, libxcb, libXau, libXdmcp", version: null, license: "MIT", texts: ["MIT"], notice: "Copyright © The X.Org Foundation and contributors.", source: "https://gitlab.freedesktop.org/xorg", platforms: ["macos"] },
  { name: "Vulkan loader, shaderc, glslang, SPIRV-Cross", version: null, license: "Apache-2.0", texts: ["Apache-2.0"], notice: "Copyright © The Khronos Group Inc., LunarG Inc. and Google LLC.", source: "https://github.com/KhronosGroup", platforms: ["macos", "windows"] },
  { name: "MoltenVK", version: null, license: "Apache-2.0", texts: ["Apache-2.0"], notice: "Copyright © The Brenwill Workshop Ltd. and The Khronos Group Inc.", source: "https://github.com/KhronosGroup/MoltenVK", platforms: ["macos"] },
  { name: "OpenSSL", version: "3", license: "Apache-2.0", texts: ["Apache-2.0"], notice: "Copyright © The OpenSSL Project Authors.", source: "https://www.openssl.org", platforms: ["windows"] },
  { name: "ANGLE", version: null, license: "BSD-3-Clause", texts: ["BSD-3-Clause"], notice: "Copyright © The ANGLE Project Authors.", source: "https://chromium.googlesource.com/angle/angle", platforms: ["windows"] },
  {
    name: "Other libraries linked into libmpv-2.dll", version: null, license: "BSD-2-Clause AND BSD-3-Clause AND BSD-3-Clause-Clear AND MIT AND ISC AND Zlib AND WTFPL",
    texts: ["BSD-2-Clause", "BSD-3-Clause", "BSD-3-Clause-Clear", "MIT", "ISC", "Zlib", "WTFPL"], source: WINBUILD, platforms: ["windows"],
    note: "libarchive, libxml2, LuaJIT, mujs, fontconfig, SDL2, zimg, libvpx, libaom, SVT-AV1, libjxl, libwebp, Opus, Vorbis, Speex, libopenmpt, libmodplug, libmysofa, uavs3d, libaribcaption, AMF, libvpl, nv-codec-headers.",
  },
  {
    name: "Other libraries shipped with libmpv.so", version: null, license: "MIT AND BSD-3-Clause AND bzip2-1.0.6 AND WTFPL",
    texts: ["MIT", "BSD-3-Clause", "bzip2-1.0.6", "WTFPL"], source: LINUX, platforms: ["linux"],
    note: "zimg, bzip2, Brotli, Opus, Vorbis, Ogg, libva, libvdpau, libunwind.",
  },
];
