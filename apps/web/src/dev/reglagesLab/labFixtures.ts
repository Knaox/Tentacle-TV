/** Le faux serveur d'une vue : le socle, puis ce que ses écrans demandent. La première route qui convient répond. */

import { DEFAULT_PLAYBACK_SETTINGS } from "@tentacle-tv/shared";
import type { LabRoute } from "./labFetch";
import type { LabView } from "./labViews";
import { accountRoutes } from "./fixtures/account";
import { adminRoutes } from "./fixtures/admin";
import { baseRoutes } from "./fixtures/base";
import { settingsRoutes } from "./fixtures/settings";
import { setupRoutes } from "./fixtures/setup";

/**
 * Les réglages de lecture LIVRÉS, pour toutes les vues sauf « réglages personnalisés » : la page
 * s'ouvre alors sur le mode « Par défaut », ses « Avancé » repliés — l'état d'un compte neuf.
 */
const deliveredPlayback: LabRoute = { path: "/api/preferences/playback", reply: { stored: true, settings: DEFAULT_PLAYBACK_SETTINGS } };

export function routesFor(view: LabView): readonly LabRoute[] {
  return [
    ...(view.id === "lecture-personnalisee" ? [] : [deliveredPlayback]),...adminRoutes(view), ...settingsRoutes(view), ...accountRoutes(view), ...setupRoutes(view), ...baseRoutes];
}
