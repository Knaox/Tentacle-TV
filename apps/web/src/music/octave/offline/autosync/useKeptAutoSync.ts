/**
 * Octave — l'exécutant de la tenue à jour, monté dans la portée du mode
 * (`MusicOfflineScope`, une ligne) : l'exécutant commun
 * (`@tentacle-tv/offline-core/music`, `startKeptAutoSync`) branché sur la
 * coquille et les requêtes du bureau. Ne tourne que si le réglage de l'appareil
 * est allumé, que le compte de l'appareil peut garder (jamais une session de
 * profil : `keepRules.ts`) et que le serveur répond.
 */

import { useEffect, useRef } from "react";
import { autoSyncActive, externalKeepPath, startKeptAutoSync, type MusicOfflineSurface } from "@tentacle-tv/offline-core/music";
import { musicRouteUrl } from "@tentacle-tv/api-client";
import { useConnectivity } from "../../../../offline/useConnectivity";
import { useOctaveProvider } from "../../mode/useOctaveProvider";
import { keptMusicStore } from "../keptMusicStore";
import { keepActions } from "../keepMusic";
import { useAutoSync } from "./autoSyncStore";
import { syncReadApi } from "./syncInputs";

export { autoSyncActive };

export function useKeptAutoSync(surface: MusicOfflineSurface): void {
  const on = useAutoSync();
  const provider = useOctaveProvider();
  const { state } = useConnectivity();
  const active = autoSyncActive(on, surface, state);
  const live = useRef({ surface, provider });
  live.current = { surface, provider };

  useEffect(() => {
    if (!active) return;
    return startKeptAutoSync({
      store: keptMusicStore,
      actions: keepActions,
      api: syncReadApi,
      current: () => ({ ...live.current, externalPath: externalKeepPath(live.current.provider, musicRouteUrl) }),
    });
  }, [active]);
}
