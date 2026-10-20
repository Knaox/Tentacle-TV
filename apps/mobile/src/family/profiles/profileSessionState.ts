import { useCallback, useSyncExternalStore } from "react";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { accountTokenIn, accountUserIdIn, profileMarkerIn, type ActiveProfile, type KeyValueStore } from "@tentacle-tv/shared";
import { subscribeStoredUser } from "@/auth/storedUser";

/**
 * La SESSION DE PROFIL du mobile (serveur 1.32.0, `family.mobileProfiles`) —
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

const listeners = new Set<() => void>();

/** À appeler après toute bascule (`switchSession.ts`). */
export function notifyProfileSessionChange(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const unsubscribeUser = subscribeStoredUser(listener);
  return () => {
    listeners.delete(listener);
    unsubscribeUser();
  };
}

let lastKey: string | null = null;
let lastProfile: ActiveProfile | null = null;

/** Le profil actif d'après le stockage, ou null (session personnelle). Stable tant que rien ne change. */
export function readActiveProfile(storage: Pick<KeyValueStore, "getItem">): ActiveProfile | null {
  const key = `${storage.getItem("tentacle_profile_session") ?? ""}\u0000${storage.getItem("tentacle_user") ?? ""}`;
  if (key === lastKey) return lastProfile;
  lastKey = key;
  lastProfile = profileMarkerIn(storage).profile;
  return lastProfile;
}

/** Le profil actif, réactif ; null en session personnelle. */
export function useActiveProfile(): ActiveProfile | null {
  const { storage } = useTentacleConfig();
  const read = useCallback(() => readActiveProfile(storage), [storage]);
  return useSyncExternalStore(subscribe, read, read);
}

/** Le jeton de la session PERSONNELLE (même pendant un profil), ou null. */
export function personalToken(storage: Pick<KeyValueStore, "getItem">): string | null {
  return accountTokenIn(storage);
}

/** Le compte de l'application (même pendant un profil), ou null. */
export function accountUserId(storage: Pick<KeyValueStore, "getItem">): string | null {
  return accountUserIdIn(storage);
}

/** Le compte, réactif. */
export function useAccountUserId(): string | null {
  const { storage } = useTentacleConfig();
  const read = useCallback(() => accountUserIdIn(storage), [storage]);
  return useSyncExternalStore(subscribe, read, read);
}
