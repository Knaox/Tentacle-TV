import type { QueryClient } from "@tanstack/react-query";
import { rehydratePlaybackSettings, setPreferencesToken } from "@tentacle-tv/api-client";
import type { JellyfinClient, StorageAdapter } from "@tentacle-tv/api-client";
import { ACCOUNT_STORAGE_KEYS, beginUnpair, endWipe, wipeAccount } from "@tentacle-tv/tv-core";
import { navigationRef } from "../navigation/navigationRef";
import { scheduleRevocationDrain } from "./revocationQueue";
import { notifySessionChanged } from "./sessionEvents";

/**
 * Le déjumelage du téléviseur natif (Apple TV, Android TV) — la seule porte,
 * quel que soit le geste qui y mène.
 *
 * Synchrone et local : rien n'attend le réseau, et il passe pendant une
 * lecture (c'est un geste explicite, ou un verdict du serveur). Dans l'ordre :
 * 1. le marqueur (`beginUnpair`) : la purge est déclarée en cours, l'ancien
 *    jeton mis de côté pour sa révocation — un plantage à partir d'ici est
 *    rejoué au démarrage (`resumeUnpair`, `App.tsx`) ;
 * 2. la mémoire : plus aucune requête ne part avec l'ancien jeton (client
 *    Jellyfin, lecture directe, préférences, cache des requêtes) ;
 * 3. le stockage : tout ce qui appartient au compte (`ACCOUNT_STORAGE_KEYS`),
 *    cache persisté compris — sans attendre le tic du persisteur ;
 * 4. le retour au jumelage ;
 * 5. la révocation, en tâche de fond, rejouée jusqu'à confirmation
 *    (`revocationQueue.ts`).
 */

/** D'où vient le déjumelage :
 *  - `settings`, `offline`, `home` : un geste sur la TV — le serveur est à prévenir ;
 *  - `revoked` : un verdict du serveur — il n'y a plus rien à lui demander ;
 *  - `incomplete` : une session à moitié écrite, soldée. */
export type UnpairOrigin = "settings" | "offline" | "home" | "revoked" | "incomplete";

export interface UnpairContext {
  jfClient: JellyfinClient;
  storage: StorageAdapter;
  queryClient: QueryClient;
}

export function unpairDevice({ jfClient, storage, queryClient }: UnpairContext, origin: UnpairOrigin): void {
  const leaving = origin === "revoked"
    ? null
    : { serverUrl: storage.getItem("tentacle_server_url"), token: storage.getItem("tentacle_token") };
  beginUnpair(storage, leaving, Date.now());

  jfClient.setAccessToken(null);
  jfClient.setDirectStreaming(null);
  // Retire aussi `tentacle_device_id_jf` : l'identité dérivée pour CE jumelage.
  jfClient.adoptJellyfinDeviceId(null);
  jfClient.resetAuthState();
  setPreferencesToken(null);
  queryClient.clear();

  wipeAccount(storage, ACCOUNT_STORAGE_KEYS);
  // Le magasin des réglages de lecture relit son cache, désormais vide.
  rehydratePlaybackSettings();
  endWipe(storage);

  notifySessionChanged();
  if (navigationRef.isReady()) {
    navigationRef.reset({ index: 0, routes: [{ name: "PairCode" }] });
  }
  if (leaving?.token && leaving.serverUrl) scheduleRevocationDrain(0);
}
