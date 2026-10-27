/**
 * Les pages mobiles d'une extension — ses ROUTES et ses SECTIONS, à ne pas
 * confondre. Module pur (ni React Native, ni Expo).
 *
 * - Ses routes (`mobilePluginRoutes`) : toute page déclarée pour le mobile,
 *   MASQUÉES COMPRISES. `PluginWebViewScreen` y trouve la page qu'un lien
 *   demande (notification, recommandation) : elle s'ouvre toujours.
 * - Ses sections (`mobilePluginNavPages`) : ces routes, moins les pages que
 *   l'extension masque de la navigation (`hidden: true`, capacité
 *   `plugins.navigation`, `isPluginNavHidden`). Seule liste de l'onglet des
 *   extensions, de son bandeau et de son sous-menu : une page masquée n'y est
 *   jamais ; sans autre page, l'onglet se masque.
 *
 * Face à un serveur d'avant, qui ne dit jamais `hidden` : les deux listes sont
 * les mêmes, comme avant.
 */

import { isPluginNavHidden } from "@tentacle-tv/shared";

interface MobilePluginNav {
  platforms: readonly string[];
  hidden?: unknown;
}

/** Les pages mobiles de l'extension — masquées COMPRISES. */
export function mobilePluginRoutes<N extends MobilePluginNav>(navItems: readonly N[] | undefined): N[] {
  return (navItems ?? []).filter((item) => item.platforms.includes("mobile"));
}

/** Celles que l'onglet des extensions montre : les routes, moins les pages que l'extension masque. */
export function mobilePluginNavPages<N extends MobilePluginNav>(navItems: readonly N[] | undefined): N[] {
  return mobilePluginRoutes(navItems).filter((item) => !isPluginNavHidden(item));
}
