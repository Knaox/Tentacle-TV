import { useEffect } from "react";
import { parseReloadReturn, serializeReloadReturn, type RenderTierMode } from "@tentacle-tv/tv-core";
import { navigationRef } from "../../../navigation/navigationRef";
import { deviceNative, RETURN_STATE } from "./tierNative";

/**
 * Le changement de mode : un RECHARGEMENT PROPRE de l'interface (décision de
 * Damien, 07/10 — jamais à chaud). La pile d'écrans en cours (noms et
 * paramètres, tv-core `reloadReturn`) part avec le réglage ; le natif recrée
 * le contexte React ; la session, dans le stockage de l'app, reste.
 * `RenderTierReturn` rouvre ensuite la pile quittée, si l'app redémarre au
 * même endroit (même première route : la même session).
 */
export function changeRenderTierMode(mode: RenderTierMode, screenParams?: Record<string, unknown>): void {
  if (!deviceNative) return;
  const state = navigationRef.isReady() ? navigationRef.getRootState() : undefined;
  deviceNative.setModeAndReload(mode, serializeReloadReturn(state, screenParams));
}

/** Combien de fois attendre la navigation prête, et à quel pas. */
const NAV_RETRY_MS = 200;
const NAV_RETRIES = 25;

export function RenderTierReturn(): null {
  useEffect(() => {
    const saved = parseReloadReturn(RETURN_STATE);
    if (!saved) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (navigationRef.isReady()) {
        clearInterval(timer);
        const current = navigationRef.getRootState();
        // Une autre première route (session perdue, jumelage) : on n'impose rien.
        if (current?.routes[0]?.name === saved.routes[0]?.name) navigationRef.resetRoot(saved as Parameters<typeof navigationRef.resetRoot>[0]);
      } else if (tries >= NAV_RETRIES) {
        clearInterval(timer);
      }
    }, NAV_RETRY_MS);
    return () => clearInterval(timer);
  }, []);
  return null;
}
