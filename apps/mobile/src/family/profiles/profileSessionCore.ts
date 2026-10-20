import { accountTokenIn, accountUserIdIn, profileMarkerIn, type ActiveProfile, type KeyValueStore } from "@tentacle-tv/shared";
import { subscribeStoredUser } from "../../auth/storedUser";

/**
 * Le cœur PUR de la session de profil du mobile (sans React ni React Native :
 * testé sous vitest) — voir `profileSessionState.ts`.
 */

const listeners = new Set<() => void>();

/** À appeler après toute bascule (`switchSession.ts`). */
export function notifyProfileSessionChange(): void {
  for (const listener of listeners) listener();
}

/** Abonnement aux bascules et aux réécritures de `tentacle_user`. */
export function subscribeProfileSession(listener: () => void): () => void {
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

/** Le jeton de la session PERSONNELLE (même pendant un profil), ou null. */
export function personalToken(storage: Pick<KeyValueStore, "getItem">): string | null {
  return accountTokenIn(storage);
}

/** Le compte de l'application (même pendant un profil), ou null. */
export function accountUserId(storage: Pick<KeyValueStore, "getItem">): string | null {
  return accountUserIdIn(storage);
}
