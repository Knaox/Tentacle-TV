/**
 * Octave (mobile) — la tenue à jour des playlists gardées (et des titres likés
 * gardés) : l'exécutant COMMUN au bureau (`startKeptAutoSync`), branché sur le
 * moteur du mobile et les requêtes d'api-client. Ne tourne que si le réglage de
 * l'appareil est allumé (défaut), que le compte de l'appareil peut garder
 * (jamais une session de profil) et que le serveur répond ; la reconnexion la
 * relance (relevé complet). Jamais un relevé en boucle : les évènements
 * `music:*` la réveillent (`signalMusicEvent`).
 */

import { useEffect, useRef } from "react";
import { fetchExternalPlaylist, fetchPendingMusic, libraryMatchRequest, musicApi, musicRouteUrl, type MusicProvider } from "@tentacle-tv/api-client";
import { autoSyncActive, externalKeepPath, startKeptAutoSync, type MusicOfflineSurface, type SyncReadApi } from "@tentacle-tv/offline-core/music";
import { useConnectivity } from "../../offline/useConnectivity";
import { fetchMusicOfflinePlan, keepActions, keptMusicStore } from "./keptMusic";

/** Les requêtes de la tenue à jour : celles du bureau (api-client). */
export const mobileSyncReadApi: SyncReadApi<MusicProvider> = {
  playlist: (id) => musicApi.playlist(id),
  externalPlaylist: (provider, id) => fetchExternalPlaylist(provider, id),
  pending: (provider) => fetchPendingMusic(provider),
  matchRequest: (tracks) => libraryMatchRequest(tracks, []),
  match: (request) => musicApi.match(request),
  plan: fetchMusicOfflinePlan,
  liked: (cursor, limit) => musicApi.liked(cursor, limit),
};

export function useKeptAutoSync(surface: MusicOfflineSurface, provider: MusicProvider | null, on: boolean): void {
  const { state } = useConnectivity();
  const active = autoSyncActive(on, surface, state);
  const live = useRef({ surface, provider });
  live.current = { surface, provider };

  useEffect(() => {
    if (!active) return;
    return startKeptAutoSync({
      store: keptMusicStore,
      actions: keepActions,
      api: mobileSyncReadApi,
      current: () => ({ ...live.current, externalPath: externalKeepPath(live.current.provider, musicRouteUrl) }),
    });
  }, [active]);
}
