import { PROFILE_SESSION_STORAGE_KEYS } from "../auth/profileSession";

/**
 * « Vider le cache » (page Profil d'une fenêtre étroite, miroir) : tout le
 * stockage local de l'appareil part, sauf la session ACTIVE, le serveur et la
 * langue. Pendant le profil d'un autre (bureau), la session active, c'est
 * aussi la marque du profil et la réserve du compte : sans elles,
 * l'application se croirait dans la session personnelle avec le jeton du
 * profil, et la session du compte serait perdue (`auth/profileSession.ts`).
 *
 * ⚠️ Clés traversées par une chaîne : jamais renommées.
 */
export const KEPT_ON_CACHE_CLEAR: ReadonlySet<string> = new Set([
  "tentacle_server_url",
  "tentacle_token",
  "tentacle_user",
  "i18nextLng",
  ...PROFILE_SESSION_STORAGE_KEYS,
]);

export function clearLocalCache(store: Pick<Storage, "length" | "key" | "removeItem">): void {
  for (let i = store.length - 1; i >= 0; i--) {
    const key = store.key(i);
    if (key && !KEPT_ON_CACHE_CLEAR.has(key)) store.removeItem(key);
  }
}
