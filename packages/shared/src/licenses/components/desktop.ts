import type { ThirdPartyComponent } from "../licenseTypes";
import { DESKTOP } from "./platforms";

// Le bureau depuis la 1.50.0 : la coquille CEF (`apps/desktop-cef` — Chromium Embedded
// Framework, SDL3, libmpv), et la chaîne mpv + FFmpeg de chaque système.
// - macOS : construite par scripts/deps/paquet-libs.sh et paquet-deps.sh, LGPL, bibliothèques
//   dynamiques dans Contents/Frameworks (remplaçables : la LGPL permet de relier) ; licences
//   copiées dans Contents/Resources/licenses (cmake/MacBundle.cmake) ;
// - Windows : la libmpv-2.dll de mpv-winbuild (variante LGPL, FFmpeg en --enable-version3 lié
//   dedans), donc LGPL v3, la même que le bureau d'avant ;
// - Linux : notre libmpv (fork + correctifs, -Dgpl=false) ; FFmpeg, libplacebo et libass sont
//   ceux de la distribution, pas encore embarqués (aucun paquet Linux de cette coquille).

const CEF_DEPS = "apps/desktop-cef/scripts/deps";
const MAC = `${CEF_DEPS}/paquet-deps.sh, paquet-libs.sh`;
const LINUX = "apps/desktop-cef/scripts/dev/mpv-linux.mjs";
const MPV_FORK = "https://github.com/andrewrabert/mpv (branch jellium-desktop, ab0467ff24)";
const WINBUILD = "https://github.com/zhongfly/mpv-winbuild (LGPL variant, mpv-winbuild-cmake)";
const MAC_WIN: ThirdPartyComponent["platforms"] = ["macos", "windows"];

export const DESKTOP_MEDIA: readonly ThirdPartyComponent[] = [
  {
    name: "Chromium Embedded Framework (CEF)", version: "156.0.15", license: "BSD-3-Clause", texts: ["BSD-3-Clause"],
    notice: "Copyright © Marshall A. Greenblatt. Portions copyright © The Chromium Authors.",
    source: "https://github.com/chromiumembedded/cef — binaries: https://cef-builds.spotifycdn.com", platforms: DESKTOP,
  },
  {
    name: "Chromium", version: "156.0.8078.80", license: "BSD-3-Clause", texts: ["BSD-3-Clause"],
    notice: "Copyright © The Chromium Authors.", source: "https://chromium.googlesource.com/chromium/src", platforms: DESKTOP,
    note: "Includes third-party code under its own licenses; the full notices ship as CREDITS-Chromium.html.",
  },
  { name: "SDL3", version: "3.4.16", license: "Zlib", texts: ["Zlib"], notice: "Copyright © Sam Lantinga.", source: "https://github.com/libsdl-org/SDL", platforms: DESKTOP },
  { name: "JSON for Modern C++ (nlohmann/json)", version: "3.12.0", license: "MIT", texts: ["MIT"], notice: "Copyright © Niels Lohmann.", source: "https://github.com/nlohmann/json", platforms: DESKTOP },
  { name: "libsodium", version: "1.0.22", license: "ISC", texts: ["ISC"], notice: "Copyright © Frank Denis.", source: "https://github.com/jedisct1/libsodium", platforms: DESKTOP, note: "Statically linked into the updater." },
  { name: "SQLite", version: "3.46.1", license: "blessing", texts: [], source: "https://sqlite.org", platforms: ["windows"], note: "Public domain. macOS and Linux use the system's SQLite." },
  {
    name: "mpv (libmpv)", version: "ab0467ff24 + patches", license: "LGPL-2.1-or-later", texts: ["LGPL-2.1"], notice: "Copyright © the mpv developers.",
    source: `${MPV_FORK}; patches: ${CEF_DEPS}/mpv-patches — recipe: ${MAC}`, platforms: ["macos"],
    note: "Built with -Dgpl=false; shipped as a separate, replaceable dynamic library.",
  },
  { name: "FFmpeg", version: "9.0.2", license: "LGPL-2.1-or-later", texts: ["LGPL-2.1"], notice: "Copyright © the FFmpeg developers.", source: `https://ffmpeg.org — recipe: ${MAC}`, platforms: ["macos"], note: "Configured with --disable-gpl --disable-nonfree; dynamic libraries." },
  {
    name: "mpv (libmpv, Linux)", version: "ab0467ff24 + patches", license: "LGPL-2.1-or-later", texts: ["LGPL-2.1"], notice: "Copyright © the mpv developers.",
    source: `${MPV_FORK}; patches: ${CEF_DEPS}/mpv-patches, mpv-patches-linux — recipe: ${LINUX}`, platforms: ["linux"],
    note: "Built with -Dgpl=false. FFmpeg, libplacebo and libass come from the distribution.",
  },
  { name: "mpv (libmpv-2.dll)", version: "0.41.0-dev", license: "LGPL-2.1-or-later", texts: ["LGPL-2.1"], notice: "Copyright © the mpv developers.", source: `https://github.com/mpv-player/mpv — ${WINBUILD}`, platforms: ["windows"], note: "Built with -Dgpl=false." },
  { name: "FFmpeg (in libmpv-2.dll)", version: "8", license: "LGPL-3.0-or-later", texts: ["LGPL-3.0", "GPL-3.0"], notice: "Copyright © the FFmpeg developers.", source: `https://ffmpeg.org — ${WINBUILD}`, platforms: ["windows"], note: "Configured with --enable-version3, without --enable-gpl." },
  { name: "libplacebo", version: null, license: "LGPL-2.1-or-later", texts: ["LGPL-2.1"], source: "https://code.videolan.org/videolan/libplacebo", platforms: MAC_WIN, note: "macOS: 7.360.1, with glslang linked in." },
  { name: "FriBidi", version: null, license: "LGPL-2.1-or-later", texts: ["LGPL-2.1"], source: "https://github.com/fribidi/fribidi", platforms: MAC_WIN },
  { name: "uchardet", version: null, license: "LGPL-2.1-or-later", texts: ["LGPL-2.1"], source: "https://www.freedesktop.org/wiki/Software/uchardet/", platforms: MAC_WIN, note: "Triple-licensed; used under the LGPL." },
  { name: "libbluray", version: null, license: "LGPL-2.1-or-later", texts: ["LGPL-2.1"], source: "https://www.videolan.org/developers/libbluray.html", platforms: ["windows"] },
  { name: "LAME", version: null, license: "LGPL-2.0-or-later", texts: ["LGPL-2.1"], source: "https://lame.sourceforge.io", platforms: ["windows"] },
  { name: "libass", version: null, license: "ISC", texts: ["ISC"], notice: "Copyright © the libass contributors.", source: "https://github.com/libass/libass", platforms: MAC_WIN },
  {
    name: "FreeType", version: null, license: "FTL", texts: ["FTL"],
    notice: "Portions of this software are copyright © The FreeType Project (www.freetype.org). All rights reserved.",
    source: "https://freetype.org", platforms: MAC_WIN,
  },
  { name: "HarfBuzz", version: null, license: "MIT", texts: ["MIT"], notice: "Copyright © the HarfBuzz authors.", source: "https://github.com/harfbuzz/harfbuzz", platforms: MAC_WIN },
  { name: "Little CMS 2", version: null, license: "MIT", texts: ["MIT"], notice: "Copyright © Marti Maria Saguer.", source: "https://github.com/mm2/Little-CMS", platforms: MAC_WIN },
  { name: "dav1d", version: null, license: "BSD-2-Clause", texts: ["BSD-2-Clause"], notice: "Copyright © VideoLAN and dav1d authors.", source: "https://code.videolan.org/videolan/dav1d", platforms: MAC_WIN },
  { name: "libunibreak", version: null, license: "Zlib", texts: ["Zlib"], notice: "Copyright © Wu Yongwei and contributors.", source: "https://github.com/adah1972/libunibreak", platforms: ["windows"] },
  {
    name: "glslang", version: "vulkan-sdk-1.4.357.0", license: "BSD-3-Clause AND BSD-2-Clause AND MIT AND Apache-2.0", texts: ["BSD-3-Clause", "BSD-2-Clause", "MIT", "Apache-2.0"],
    notice: "Copyright © The Khronos Group Inc., 3Dlabs Inc. Ltd., Google Inc. and others.", source: "https://github.com/KhronosGroup/glslang", platforms: ["macos"],
    note: "Statically linked into libplacebo.",
  },
  { name: "Vulkan loader", version: "1.4.357", license: "Apache-2.0", texts: ["Apache-2.0"], notice: "Copyright © The Khronos Group Inc., Valve Corporation and LunarG Inc.", source: "https://github.com/KhronosGroup/Vulkan-Loader", platforms: ["macos"] },
  { name: "MoltenVK", version: null, license: "Apache-2.0", texts: ["Apache-2.0"], notice: "Copyright © The Brenwill Workshop Ltd. and The Khronos Group Inc.", source: "https://github.com/KhronosGroup/MoltenVK", platforms: ["macos"] },
  { name: "Vulkan loader, shaderc, glslang, SPIRV-Cross (in libmpv-2.dll)", version: null, license: "Apache-2.0", texts: ["Apache-2.0"], notice: "Copyright © The Khronos Group Inc., LunarG Inc. and Google LLC.", source: "https://github.com/KhronosGroup", platforms: ["windows"] },
  { name: "OpenSSL", version: "3", license: "Apache-2.0", texts: ["Apache-2.0"], notice: "Copyright © The OpenSSL Project Authors.", source: "https://www.openssl.org", platforms: ["windows"], note: "Linked into libmpv-2.dll." },
  { name: "ANGLE (in libmpv-2.dll)", version: null, license: "BSD-3-Clause", texts: ["BSD-3-Clause"], notice: "Copyright © The ANGLE Project Authors.", source: "https://chromium.googlesource.com/angle/angle", platforms: ["windows"] },
  {
    name: "Other libraries linked into libmpv-2.dll", version: null, license: "BSD-2-Clause AND BSD-3-Clause AND BSD-3-Clause-Clear AND MIT AND ISC AND Zlib AND WTFPL",
    texts: ["BSD-2-Clause", "BSD-3-Clause", "BSD-3-Clause-Clear", "MIT", "ISC", "Zlib", "WTFPL"], source: WINBUILD, platforms: ["windows"],
    note: "libarchive, libxml2, LuaJIT, mujs, fontconfig, SDL2, zimg, libvpx, libaom, SVT-AV1, libjxl, libwebp, Opus, Vorbis, Speex, libopenmpt, libmodplug, libmysofa, uavs3d, libaribcaption, AMF, libvpl, nv-codec-headers.",
  },
];
