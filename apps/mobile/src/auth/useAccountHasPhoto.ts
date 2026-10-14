import { useCallback, useSyncExternalStore } from "react";
import { isStoredUserConfirmed, subscribeUserConfirmation } from "./storedUser";
import { useStoredUser } from "./useStoredUser";

/**
 * Le compte a-t-il une photo, D'APRÈS JELLYFIN ? `undefined` tant que son
 * profil n'a pas été relu depuis le lancement (`isStoredUserConfirmed`) : le
 * profil stocké peut dater d'une autre session, et l'invitation aux avatars ne
 * se décide pas sur une supposition. Une relecture part à chaque passage en
 * ligne, connexion comprise (`OfflineRuntimeSync`).
 */
export function useAccountHasPhoto(): boolean | undefined {
  const user = useStoredUser();
  const userId = user?.Id ?? null;
  const read = useCallback(() => isStoredUserConfirmed(userId), [userId]);
  const confirmed = useSyncExternalStore(subscribeUserConfirmation, read, read);
  if (user === null || !confirmed) return undefined;
  return !!user.PrimaryImageTag;
}
