import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { parseStoredUser, STORED_USER_KEY, subscribeStoredUser, type StoredUser } from "./storedUser";

/**
 * Le profil stocké, réactif : une relecture (`adoptFreshUser`) re-rend ceux
 * qui l'affichent. Les onglets restant montés, une lecture au rendu ne
 * suffisait pas — le profil gardait la photo de son premier affichage.
 */
export function useStoredUser(): StoredUser | null {
  const { storage } = useTentacleConfig();
  const read = useCallback(() => storage.getItem(STORED_USER_KEY), [storage]);
  const raw = useSyncExternalStore(subscribeStoredUser, read, read);
  return useMemo(() => parseStoredUser(raw), [raw]);
}
