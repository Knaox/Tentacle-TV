import { parseReloadReturn, serializeReloadReturn, type ReloadReturn, type RenderTierMode } from "@tentacle-tv/tv-core";
import { navigationRef } from "../../../navigation/navigationRef";
import { deviceNative, RETURN_STATE } from "./tierNative";

/**
 * Le changement de mode : un REDÉMARRAGE PROPRE de l'interface (décision de
 * Damien, 07/10 — jamais à chaud). La pile d'écrans en cours (noms et
 * paramètres, tv-core `reloadReturn`) part avec le réglage ; le natif relance
 * l'app (`DeviceModule.setModeAndReload`) ; la session, dans le stockage de
 * l'app, reste.
 */
export function changeRenderTierMode(mode: RenderTierMode, screenParams?: Record<string, unknown>): void {
  if (!deviceNative) return;
  const state = navigationRef.isReady() ? navigationRef.getRootState() : undefined;
  deviceNative.setModeAndReload(mode, serializeReloadReturn(state, screenParams));
}

/**
 * La pile à rouvrir, en ÉTAT INITIAL de la navigation (`App.tsx`) : tous ses
 * écrans montés d'emblée, seul celui du dessus actif — l'accueil dessous ne
 * réclame pas le focus. Rejouer la pile par des `push` après le montage
 * laissait le focus au héros de l'accueil recouvert, qui le réclamait à
 * l'arrivée de ses données (relevé à l'émulateur). Seulement si l'app repart
 * au même endroit (`firstRoute` : la même session) ; lue une fois.
 */
export function reloadNavigationState(firstRoute: string): ReloadReturn | undefined {
  const saved = parseReloadReturn(RETURN_STATE);
  return saved && saved.routes[0]?.name === firstRoute ? saved : undefined;
}
