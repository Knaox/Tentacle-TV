import type { LicenseTextId } from "./licenseTexts.generated";

export type { LicenseTextId };

/**
 * Là où un composant est EMBARQUÉ — une plateforme par canal de livraison :
 * le client web servi par le serveur (`web`), le bureau par système, les
 * applications mobiles et TV, le client LG (`webos`) et l'image Docker
 * (`server`). Une seule liste : l'écran « Licences » de chaque application
 * n'affiche que les composants de SA plateforme.
 */
export type LicensePlatform =
  | "web"
  | "macos"
  | "windows"
  | "linux"
  | "ios"
  | "android"
  | "tvos"
  | "androidtv"
  | "webos"
  | "server";

export const LICENSE_PLATFORMS: readonly LicensePlatform[] = [
  "web", "macos", "windows", "linux", "ios", "android", "tvos", "androidtv", "webos", "server",
];

/** Un composant tiers embarqué, tel que l'écran « Licences » le montre. */
export interface ThirdPartyComponent {
  /** Nom du composant, tel que l'amont le nomme. */
  name: string;
  /** Version embarquée ; `null` quand elle suit un paquet englobant. */
  version: string | null;
  /** Expression SPDX de la licence SOUS LAQUELLE on l'utilise. */
  license: string;
  /** Les textes complets qui s'y appliquent (module de textes). */
  texts: readonly LicenseTextId[];
  /** Mentions de copyright ou de crédit exigées par la licence. */
  notice?: string;
  /** Où obtenir la source correspondante. */
  source: string;
  platforms: readonly LicensePlatform[];
  /** Précision courte, en anglais comme les textes de licence. */
  note?: string;
}
