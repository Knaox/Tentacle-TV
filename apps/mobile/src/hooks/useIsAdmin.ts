import { useTentacleConfig } from "@tentacle-tv/api-client";

/**
 * L'utilisateur connecté est-il administrateur Jellyfin ? Lu dans le miroir
 * `tentacle_user` de la réponse d'authentification ; `false` s'il est absent
 * ou illisible. Une seule lecture pour tous les écrans (réglages, tickets…).
 */
export function useIsAdmin(): boolean {
  const { storage } = useTentacleConfig();
  try {
    const raw = storage.getItem("tentacle_user");
    return raw ? JSON.parse(raw)?.Policy?.IsAdministrator === true : false;
  } catch {
    return false;
  }
}
