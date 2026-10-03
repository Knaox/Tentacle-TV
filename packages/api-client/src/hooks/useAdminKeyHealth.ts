import { useQuery } from "@tanstack/react-query";
import { ADMIN_KEY_HEALTH_KEY, readAdminKeyHealth, type AdminKeyHealth } from "@tentacle-tv/shared";
import { tentacleApiFetch } from "./usePreferences";

/**
 * La santé de la clé d'administration Jellyfin (`GET /api/admin/jellyfin-key`,
 * administrateurs seulement) — l'avertissement des clients la lit. Le serveur
 * garde déjà son verdict cinq minutes : inutile de le redemander à chaque
 * écran. Un serveur d'avant la route (404) ou un refus ne déclenchent rien.
 */
export function useAdminKeyHealth(options: { enabled: boolean }) {
  return useQuery<AdminKeyHealth>({
    queryKey: ADMIN_KEY_HEALTH_KEY,
    queryFn: async () => readAdminKeyHealth(await tentacleApiFetch<unknown>("/api/admin/jellyfin-key")),
    enabled: options.enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
