import type { ThirdPartyComponent } from "../licenseTypes";
import { EVERY_CLIENT, MOBILE, REACT_NATIVE, TV, WEB_CLIENTS } from "./platforms";

// Les bibliothèques JavaScript et natives des interfaces, les polices et les
// icônes. Liste des composants qui comptent (et de tous ceux dont la licence
// demande plus qu'un en-tête) ; l'inventaire complet des paquets npm se lit
// par `pnpm licenses list --prod` (docs/LICENCES.md).

export const INTERFACE_LIBRARIES: readonly ThirdPartyComponent[] = [
  { name: "React", version: "19", license: "MIT", texts: ["MIT"], notice: "Copyright © Meta Platforms, Inc. and affiliates.", source: "https://github.com/facebook/react", platforms: EVERY_CLIENT },
  { name: "TanStack Query", version: "5", license: "MIT", texts: ["MIT"], notice: "Copyright © Tanner Linsley.", source: "https://github.com/TanStack/query", platforms: EVERY_CLIENT },
  { name: "i18next, react-i18next", version: "25 / 16", license: "MIT", texts: ["MIT"], notice: "Copyright © i18next contributors.", source: "https://github.com/i18next", platforms: EVERY_CLIENT },
  { name: "React Router", version: "7", license: "MIT", texts: ["MIT"], notice: "Copyright © React Training LLC, Remix Software Inc. and Shopify Inc.", source: "https://github.com/remix-run/react-router", platforms: WEB_CLIENTS },
  { name: "TanStack Virtual", version: "3", license: "MIT", texts: ["MIT"], notice: "Copyright © Tanner Linsley.", source: "https://github.com/TanStack/virtual", platforms: WEB_CLIENTS },
  { name: "Framer Motion", version: "11", license: "MIT", texts: ["MIT"], notice: "Copyright © Framer B.V.", source: "https://github.com/motiondivision/motion", platforms: WEB_CLIENTS },
  { name: "hls.js", version: "1.6", license: "Apache-2.0", texts: ["Apache-2.0"], notice: "Copyright © Dailymotion and hls.js contributors.", source: "https://github.com/video-dev/hls.js", platforms: WEB_CLIENTS },
  { name: "libpgs", version: "0.8", license: "MIT", texts: ["MIT"], notice: "Copyright © Arcus92.", source: "https://github.com/Arcus92/libpgs-js", platforms: WEB_CLIENTS },
  { name: "uqr", version: "0.1", license: "MIT", texts: ["MIT"], notice: "Copyright © Anthony Fu.", source: "https://github.com/unjs/uqr", platforms: WEB_CLIENTS },
  { name: "Tailwind CSS", version: "3", license: "MIT", texts: ["MIT"], notice: "Copyright © Tailwind Labs, Inc.", source: "https://github.com/tailwindlabs/tailwindcss", platforms: WEB_CLIENTS },
  { name: "core-js, SystemJS, regenerator-runtime", version: null, license: "MIT", texts: ["MIT"], notice: "Copyright © Denis Pushkarev; Guy Bedford; Meta Platforms, Inc.", source: "https://github.com/zloirock/core-js", platforms: ["webos"] },
  { name: "tslib", version: "2", license: "0BSD", texts: ["0BSD"], notice: "Copyright © Microsoft Corporation.", source: "https://github.com/microsoft/tslib", platforms: WEB_CLIENTS },
  { name: "React Native", version: "0.81", license: "MIT", texts: ["MIT"], notice: "Copyright © Meta Platforms, Inc. and affiliates.", source: "https://github.com/facebook/react-native", platforms: MOBILE },
  { name: "React Native for TV (react-native-tvos)", version: "0.80", license: "MIT", texts: ["MIT"], notice: "Copyright © Meta Platforms, Inc. and affiliates.", source: "https://github.com/react-native-tvos/react-native-tvos", platforms: TV },
  { name: "Hermes", version: null, license: "MIT", texts: ["MIT"], notice: "Copyright © Meta Platforms, Inc. and affiliates.", source: "https://github.com/facebook/hermes", platforms: REACT_NATIVE },
  { name: "Expo", version: "54", license: "MIT", texts: ["MIT"], notice: "Copyright © 650 Industries, Inc.", source: "https://github.com/expo/expo", platforms: MOBILE },
  { name: "react-native-video", version: "6", license: "MIT", texts: ["MIT"], notice: "Copyright © TheWidlarzGroup and contributors.", source: "https://github.com/TheWidlarzGroup/react-native-video", platforms: REACT_NATIVE },
  { name: "react-native-svg, react-native-screens, Reanimated, safe-area-context, AsyncStorage, FlashList", version: null, license: "MIT", texts: ["MIT"], notice: "Copyright © their respective authors (Software Mansion, Shopify, Th3rdwave, React Native Community).", source: "https://github.com/react-native-community", platforms: REACT_NATIVE },
  { name: "folly", version: null, license: "Apache-2.0", texts: ["Apache-2.0"], notice: "Copyright © Meta Platforms, Inc. and affiliates.", source: "https://github.com/facebook/folly", platforms: REACT_NATIVE },
  { name: "Boost", version: null, license: "BSL-1.0", texts: ["BSL-1.0"], source: "https://www.boost.org", platforms: REACT_NATIVE },
  { name: "glog, double-conversion, SocketRocket", version: null, license: "BSD-3-Clause", texts: ["BSD-3-Clause"], notice: "Copyright © Google Inc.; Copyright © Meta Platforms, Inc.", source: "https://github.com/google/glog", platforms: REACT_NATIVE },
  { name: "{fmt}", version: null, license: "MIT", texts: ["MIT"], notice: "Copyright © Victor Zverovich and {fmt} contributors.", source: "https://github.com/fmtlib/fmt", platforms: REACT_NATIVE },
  { name: "Fresco", version: null, license: "MIT", texts: ["MIT"], notice: "Copyright © Meta Platforms, Inc. and affiliates.", source: "https://github.com/facebook/fresco", platforms: ["android"] },
  { name: "SDWebImage", version: "5", license: "MIT", texts: ["MIT"], notice: "Copyright © Olivier Poitrey and contributors.", source: "https://github.com/SDWebImage/SDWebImage", platforms: ["ios"] },
  { name: "libavif, dav1d (expo-image)", version: null, license: "BSD-2-Clause", texts: ["BSD-2-Clause"], notice: "Copyright © Joe Drago and the AOMedia contributors; Copyright © VideoLAN and dav1d authors.", source: "https://github.com/AOMediaCodec/libavif", platforms: ["ios"] },
  { name: "libwebp", version: "1.5", license: "BSD-3-Clause", texts: ["BSD-3-Clause"], notice: "Copyright © Google Inc.", source: "https://chromium.googlesource.com/webm/libwebp", platforms: ["ios"] },
  {
    name: "Streamyfin mpv-player module (derived files)", version: "4faddc5f", license: "MPL-2.0", texts: ["MPL-2.0"],
    notice: "Derived from Streamyfin (https://github.com/streamyfin/streamyfin); modifications by Tentacle TV remain under the MPL-2.0.",
    source: "https://github.com/streamyfin/streamyfin — apps/mobile/modules/mpv-player, apps/tv/android/…/mpv/MPVLib.kt", platforms: ["ios", "android", "androidtv"],
  },
  { name: "Mozilla CA certificate bundle (cacert.pem)", version: null, license: "MPL-2.0", texts: ["MPL-2.0"], source: "https://curl.se/docs/caextract.html", platforms: ["ios", "android", "androidtv"] },
];

export const FONTS_AND_ICONS: readonly ThirdPartyComponent[] = [
  { name: "Inter (font)", version: null, license: "OFL-1.1", texts: ["OFL-1.1"], notice: "Copyright © 2016 The Inter Project Authors (https://github.com/rsms/inter).", source: "https://github.com/rsms/inter", platforms: EVERY_CLIENT },
  { name: "Noto Sans (font)", version: "2.015", license: "OFL-1.1", texts: ["OFL-1.1"], notice: "Copyright © 2022 The Noto Project Authors.", source: "https://github.com/notofonts/latin-greek-cyrillic", platforms: ["ios"] },
  { name: "Lucide (icons)", version: "0.577", license: "ISC", texts: ["ISC", "MIT"], notice: "Copyright © Lucide Contributors; portions Copyright © 2013–2023 Cole Bemis (Feather, MIT).", source: "https://github.com/lucide-icons/lucide", platforms: EVERY_CLIENT },
  { name: "Feather (icons)", version: null, license: "MIT", texts: ["MIT"], notice: "Copyright © 2013–2017 Cole Bemis.", source: "https://github.com/feathericons/feather", platforms: MOBILE },
  { name: "Heroicons (icons)", version: "2", license: "MIT", texts: ["MIT"], notice: "Copyright © Tailwind Labs, Inc.", source: "https://github.com/tailwindlabs/heroicons", platforms: WEB_CLIENTS },
  { name: "country-flag-icons", version: "1.6", license: "MIT", texts: ["MIT"], notice: "Copyright © catamphetamine.", source: "https://gitlab.com/catamphetamine/country-flag-icons", platforms: WEB_CLIENTS },
];
