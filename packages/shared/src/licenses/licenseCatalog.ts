import { ANDROID_MEDIA } from "./components/android";
import { APPLE_MEDIA } from "./components/appleMedia";
import { DESKTOP_MEDIA } from "./components/desktop";
import { FONTS_AND_ICONS, INTERFACE_LIBRARIES } from "./components/javascript";
import { SERVER_COMPONENTS } from "./components/server";
import type { LicensePlatform, LicenseTextId, ThirdPartyComponent } from "./licenseTypes";

/**
 * Le catalogue des licences : ce que chaque application embarque, et les
 * textes complets à lui joindre. Léger à dessein — les textes eux-mêmes
 * (≈ 200 Ko) vivent dans `@tentacle-tv/shared/licenses/texts`, que l'écran
 * « Licences » charge seul, à la demande.
 */

/** Le dépôt public de Tentacle TV — la source correspondante (AGPL §6, §13). */
export const TENTACLE_SOURCE_URL = "https://github.com/Knaox/Tentacle-TV";

/** Licence de Tentacle TV (code propre), en SPDX. */
export const TENTACLE_LICENSE = "AGPL-3.0-or-later";

/** Le préfixe de tag de chaque livraison (`<préfixe>-vX.Y.Z`). */
const TAG_PREFIX: Record<LicensePlatform, string> = {
  web: "server", server: "server", macos: "desktop", windows: "desktop", linux: "desktop",
  ios: "mobile", android: "mobile", tvos: "tv", androidtv: "tv", webos: "webos",
};

/** L'adresse de la source À LA VERSION livrée : le tag de la plateforme. */
export function tentacleSourceUrl(platform: LicensePlatform, version?: string | null): string {
  return version ? `${TENTACLE_SOURCE_URL}/tree/${TAG_PREFIX[platform]}-v${version}` : TENTACLE_SOURCE_URL;
}

export const THIRD_PARTY_COMPONENTS: readonly ThirdPartyComponent[] = [
  ...APPLE_MEDIA,
  ...ANDROID_MEDIA,
  ...DESKTOP_MEDIA,
  ...INTERFACE_LIBRARIES,
  ...FONTS_AND_ICONS,
  ...SERVER_COMPONENTS,
];

/** Les composants embarqués par une plateforme, dans l'ordre du catalogue. */
export function componentsFor(platform: LicensePlatform): ThirdPartyComponent[] {
  return THIRD_PARTY_COMPONENTS.filter((c) => c.platforms.includes(platform));
}

/** Le nom lisible de chaque texte, pour la liste des licences. */
export const LICENSE_TEXT_TITLES: Record<LicenseTextId, string> = {
  "AGPL-3.0": "GNU Affero General Public License v3.0",
  "Tentacle-TV-Exceptions": "Tentacle TV — Additional permissions (AGPL section 7)",
  "GPL-3.0": "GNU General Public License v3.0",
  "GPL-2.0": "GNU General Public License v2.0",
  "LGPL-3.0": "GNU Lesser General Public License v3.0",
  "LGPL-2.1": "GNU Lesser General Public License v2.1",
  PrismCore: "PrismCore — LGPL v2.1 with Application Store Exception",
  "MPL-2.0": "Mozilla Public License 2.0",
  "Apache-2.0": "Apache License 2.0",
  "LLVM-exception": "LLVM Exception to the Apache License 2.0",
  "OFL-1.1": "SIL Open Font License 1.1",
  MIT: "MIT License",
  ISC: "ISC License",
  "0BSD": "BSD Zero Clause License",
  "BSD-2-Clause": "BSD 2-Clause License",
  "BSD-3-Clause": "BSD 3-Clause License",
  "BSD-3-Clause-Clear": "BSD 3-Clause Clear License",
  "BlueOak-1.0.0": "Blue Oak Model License 1.0.0",
  "BSL-1.0": "Boost Software License 1.0",
  Zlib: "zlib License",
  FTL: "The FreeType Project License",
  IJG: "Independent JPEG Group License",
  "libpng-2.0": "PNG Reference Library License v2",
  "bzip2-1.0.6": "bzip2 License",
  WTFPL: "WTFPL",
  Unlicense: "The Unlicense",
  "PSF-2.0": "Python Software Foundation License 2.0",
};

/** L'ordre d'affichage : Tentacle d'abord, les copyleft, puis le reste. */
const TEXT_ORDER = Object.keys(LICENSE_TEXT_TITLES) as LicenseTextId[];

/**
 * Les textes complets qu'une plateforme doit embarquer : l'AGPL et les
 * permissions de Tentacle TV toujours, puis ceux de ses composants.
 */
export function licenseTextsFor(platform: LicensePlatform): LicenseTextId[] {
  const wanted = new Set<LicenseTextId>(["AGPL-3.0", "Tentacle-TV-Exceptions"]);
  for (const component of componentsFor(platform)) for (const id of component.texts) wanted.add(id);
  return TEXT_ORDER.filter((id) => wanted.has(id));
}

/** Les composants d'une plateforme qui relèvent d'un texte donné. */
export function componentsUnder(platform: LicensePlatform, text: LicenseTextId): ThirdPartyComponent[] {
  return componentsFor(platform).filter((c) => c.texts.includes(text));
}
