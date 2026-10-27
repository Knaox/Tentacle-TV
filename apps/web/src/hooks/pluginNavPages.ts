/**
 * Les pages d'une extension sur le web — deux listes, à ne pas confondre.
 * Module pur (aucun stockage, aucun React).
 *
 * - Ses ROUTES (`webPluginRoutes`) : toute page non admin déclarée pour le web,
 *   extension configurée. `App.tsx` les enregistre TOUTES, masquées comprises —
 *   Octave et l'administration y mènent par un lien direct.
 * - Ses entrées de NAVIGATION (`webPluginNavPages`) : ces routes, moins les
 *   pages que l'extension MASQUE (`hidden: true`, capacité `plugins.navigation`,
 *   `isPluginNavHidden`). Seule liste que lisent la barre, « Plus », la barre
 *   d'onglets étroite, le miroir et « Personnaliser la barre » : une page
 *   masquée n'y paraît nulle part, et aucune épingle d'appareil (`usePinnedNav`)
 *   ne l'y ramène — elle n'y est jamais proposée. Ses épingles sont gardées
 *   telles quelles, pour le jour où l'administration la réaffiche.
 *
 * Face à un serveur d'avant, qui ne dit jamais `hidden` : les deux listes sont
 * les mêmes, comme avant.
 */

import { isPluginNavHidden } from "@tentacle-tv/shared";

interface WebPluginNav {
  path: string;
  admin?: unknown;
  platforms?: readonly string[];
  hidden?: unknown;
}

interface WebPlugin<N extends WebPluginNav> {
  configEnabled?: boolean;
  navItems?: readonly N[];
}

/** Les pages de l'extension qui ont une route sur le web — masquées COMPRISES. */
export function webPluginRoutes<N extends WebPluginNav>(plugin: WebPlugin<N>): N[] {
  if (plugin.configEnabled !== true) return [];
  return (plugin.navItems ?? []).filter((nav) => !nav.admin && nav.platforms?.includes("web") === true);
}

/** Celles que la navigation montre : les routes, moins les pages que l'extension masque. */
export function webPluginNavPages<N extends WebPluginNav>(plugin: WebPlugin<N>): N[] {
  return webPluginRoutes(plugin).filter((nav) => !isPluginNavHidden(nav));
}
