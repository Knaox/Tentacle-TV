import { useCallback, useSyncExternalStore } from "react";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { accountUserIdIn, type ActiveProfile } from "@tentacle-tv/shared";
import { readActiveProfile, subscribeProfileSession } from "./profileSessionCore";

export { accountUserId, notifyProfileSessionChange, personalToken, readActiveProfile } from "./profileSessionCore";

/**
 * La SESSION DE PROFIL du mobile (serveur 1.31.1, `family.mobileProfiles`) —
 * l'app ouverte au nom d'un autre profil de la famille que le compte qui s'y
 * est connecté, exactement comme le bureau : mêmes clés, même module pur
 * (`@tentacle-tv/shared` › `family/profileSessionStore.ts`), lus sur le
 * stockage du mobile. La réserve du compte (`tentacle_account_session`) est
 * un secret : `RNStorageAdapter` la range au trousseau.
 *
 * Une session de profil REGARDE : le serveur lui refuse le push, « garder hors
 * ligne », le jumelage d'une TV, la gestion du compte et les gestes personnels
 * de la Famille ; l'interface les tait (`useActiveProfile`).
 */

/** Le profil actif, réactif ; null en session personnelle. */
export function useActiveProfile(): ActiveProfile | null {
  const { storage } = useTentacleConfig();
  const read = useCallback(() => readActiveProfile(storage), [storage]);
  return useSyncExternalStore(subscribeProfileSession, read, read);
}

/** Le compte, réactif. */
export function useAccountUserId(): string | null {
  const { storage } = useTentacleConfig();
  const read = useCallback(() => accountUserIdIn(storage), [storage]);
  return useSyncExternalStore(subscribeProfileSession, read, read);
}
