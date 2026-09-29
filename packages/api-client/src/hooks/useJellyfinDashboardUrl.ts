import { useQuery } from "@tanstack/react-query";
import { tentacleApiFetch } from "./usePreferences";

/**
 * Sa propre clé : le web lit le rapport ENTIER des réglages recommandés sous
 * `["admin", "jellyfin", "setup"]` — y poser une simple adresse le casserait.
 */
export const JELLYFIN_DASHBOARD_URL_KEY = ["help", "jellyfin-dashboard"] as const;

/**
 * La racine du tableau de bord de Jellyfin pour le navigateur d'un
 * administrateur — l'adresse publique si elle est posée, sinon l'interne —,
 * lue dans les réglages recommandés (`GET /api/admin/jellyfin/setup`, route
 * d'administration). `null` si le serveur ne la donne pas (trop ancien,
 * compte non administrateur, Jellyfin pas configuré) : les liens du guide
 * vers le tableau de bord restent alors masqués.
 */
export async function fetchJellyfinDashboardUrl(): Promise<string | null> {
  try {
    const raw = await tentacleApiFetch<{ dashboardUrl?: unknown } | null>("/api/admin/jellyfin/setup");
    const url = raw?.dashboardUrl;
    return typeof url === "string" && url.trim() ? url.trim().replace(/\/+$/, "") : null;
  } catch {
    return null;
  }
}

/** Pour le guide « Bandes-annonces » du mobile : ses liens vers le tableau de bord de Jellyfin. */
export function useJellyfinDashboardUrl(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: JELLYFIN_DASHBOARD_URL_KEY,
    queryFn: fetchJellyfinDashboardUrl,
    enabled: options.enabled ?? true,
    // Une adresse de serveur ne bouge pas d'une minute à l'autre.
    staleTime: 10 * 60_000,
    retry: false,
  });
}
