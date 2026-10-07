import type { ThirdPartyComponent } from "../licenseTypes";
import { APPLE_PLAYERS } from "./platforms";

// Les lecteurs Apple : le lecteur avancé de l'iPhone (MPVKit, variante LGPL
// construite par mpvkit.yml) et celui de l'Apple TV (PrismCore, qui s'appuie
// sur le MPVKit amont). Tout y est LIÉ STATIQUEMENT : la LGPL est tenue par
// la publication du code de l'application à chaque tag livré, qui permet de
// la relier à une bibliothèque modifiée. AUCUN composant GPL n'est admis ici
// (licenseCatalog.test.ts le vérifie) : l'App Store ne le tolère pas.

const MPVKIT_FORK = "https://github.com/streamyfin/MPVKit (tag 0.41.0-av5, built LGPL by .github/workflows/mpvkit.yml)";
const MPVKIT_UPSTREAM = "https://github.com/mpvkit/MPVKit (1.0.0, revision 288527d)";
const LGPL21 = ["LGPL-2.1"] as const;
// La LGPL v3 n'est qu'un jeu de permissions sur la GPL v3 : les deux textes vont ensemble.
const LGPL3 = ["LGPL-3.0", "GPL-3.0"] as const;

export const APPLE_MEDIA: readonly ThirdPartyComponent[] = [
  {
    name: "PrismCore", version: "3.2.2 (modified)", license: "LGPL-2.1-or-later WITH PrismCore Application Store Exception",
    texts: ["PrismCore", ...LGPL21], notice: "Copyright © 2026 Václav Zmrhal. Modified for Tentacle TV (audio bridge).",
    source: "https://github.com/Wenzlik/PrismCore — modified copy: apps/tv/ios/Vendor/PrismCore", platforms: ["tvos"],
  },
  {
    name: "mpv (libmpv)", version: "0.41.0 + vo_avfoundation", license: "LGPL-2.1-or-later",
    texts: LGPL21, notice: "Copyright © the mpv developers.", source: `https://github.com/mpv-player/mpv — ${MPVKIT_FORK}`,
    platforms: ["ios"], note: "Built with -Dgpl=false.",
  },
  {
    name: "FFmpeg", version: "8.1", license: "LGPL-3.0-or-later", texts: LGPL3,
    notice: "Copyright © the FFmpeg developers.", source: `https://ffmpeg.org — ${MPVKIT_FORK}`, platforms: ["ios"],
    note: "Configured without --enable-gpl and without --enable-nonfree.",
  },
  {
    name: "FFmpeg", version: "8.1.2", license: "LGPL-3.0-or-later", texts: LGPL3,
    notice: "Copyright © the FFmpeg developers.", source: `https://ffmpeg.org — ${MPVKIT_UPSTREAM}`, platforms: ["tvos"],
    note: "Configured without --enable-gpl.",
  },
  {
    name: "MPVKit (build scripts and packaging)", version: null, license: "LGPL-3.0-or-later", texts: LGPL3,
    source: `${MPVKIT_FORK} — ${MPVKIT_UPSTREAM}`, platforms: APPLE_PLAYERS,
  },
  { name: "libplacebo", version: "7.360.1", license: "LGPL-2.1-or-later", texts: LGPL21, source: "https://code.videolan.org/videolan/libplacebo", platforms: APPLE_PLAYERS },
  { name: "FriBidi", version: null, license: "LGPL-2.1-or-later", texts: LGPL21, source: "https://github.com/fribidi/fribidi", platforms: APPLE_PLAYERS },
  { name: "GnuTLS", version: "3.8.11", license: "LGPL-2.1-or-later", texts: LGPL21, source: "https://www.gnutls.org", platforms: APPLE_PLAYERS },
  { name: "Nettle", version: null, license: "LGPL-3.0-or-later", texts: LGPL3, source: "https://www.lysator.liu.se/~nisse/nettle/", platforms: APPLE_PLAYERS },
  { name: "GMP", version: null, license: "LGPL-3.0-or-later", texts: LGPL3, source: "https://gmplib.org", platforms: APPLE_PLAYERS },
  { name: "libbluray", version: null, license: "LGPL-2.1-or-later", texts: LGPL21, source: "https://www.videolan.org/developers/libbluray.html", platforms: ["ios"] },
  {
    name: "uchardet", version: null, license: "LGPL-2.1-or-later", texts: LGPL21, source: "https://www.freedesktop.org/wiki/Software/uchardet/",
    platforms: ["ios"], note: "Triple-licensed MPL-1.1 / GPL-2.0-or-later / LGPL-2.1-or-later; used under the LGPL.",
  },
  { name: "libass", version: "0.17", license: "ISC", texts: ["ISC"], notice: "Copyright © the libass contributors.", source: "https://github.com/libass/libass", platforms: APPLE_PLAYERS },
  {
    name: "FreeType", version: null, license: "FTL", texts: ["FTL"],
    notice: "Portions of this software are copyright © The FreeType Project (www.freetype.org). All rights reserved.",
    source: "https://freetype.org", platforms: APPLE_PLAYERS,
  },
  { name: "HarfBuzz", version: null, license: "MIT", texts: ["MIT"], notice: "Copyright © the HarfBuzz authors.", source: "https://github.com/harfbuzz/harfbuzz", platforms: APPLE_PLAYERS },
  { name: "Little CMS 2", version: "2.17", license: "MIT", texts: ["MIT"], notice: "Copyright © Marti Maria Saguer.", source: "https://github.com/mm2/Little-CMS", platforms: APPLE_PLAYERS },
  { name: "libunibreak", version: null, license: "Zlib", texts: ["Zlib"], notice: "Copyright © Wu Yongwei and contributors.", source: "https://github.com/adah1972/libunibreak", platforms: APPLE_PLAYERS },
  { name: "dav1d", version: "1.5.3", license: "BSD-2-Clause", texts: ["BSD-2-Clause"], notice: "Copyright © VideoLAN and dav1d authors.", source: "https://code.videolan.org/videolan/dav1d", platforms: APPLE_PLAYERS },
  { name: "uavs3d", version: "1.2.1", license: "BSD-3-Clause", texts: ["BSD-3-Clause"], notice: "Copyright © the uavs3d project authors.", source: "https://github.com/uavs3/uavs3d", platforms: APPLE_PLAYERS },
  { name: "libdovi (dovi_tool)", version: "3.3.2", license: "MIT", texts: ["MIT"], notice: "Copyright © quietvoid.", source: "https://github.com/quietvoid/dovi_tool", platforms: APPLE_PLAYERS },
  { name: "MoltenVK", version: "1.4.2", license: "Apache-2.0", texts: ["Apache-2.0"], notice: "Copyright © The Brenwill Workshop Ltd. and The Khronos Group Inc.", source: "https://github.com/KhronosGroup/MoltenVK", platforms: APPLE_PLAYERS },
  { name: "shaderc, glslang, SPIRV-Tools, Vulkan headers", version: null, license: "Apache-2.0", texts: ["Apache-2.0"], notice: "Copyright © The Khronos Group Inc. and Google LLC.", source: "https://github.com/KhronosGroup", platforms: APPLE_PLAYERS },
  { name: "OpenSSL", version: "3", license: "Apache-2.0", texts: ["Apache-2.0"], notice: "Copyright © The OpenSSL Project Authors.", source: "https://www.openssl.org", platforms: APPLE_PLAYERS },
];
