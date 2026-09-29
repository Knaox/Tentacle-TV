import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TrailerGuideLinkContext } from "@tentacle-tv/shared";
import { getUserInfo } from "../userMenu/menuItems";
import { JELLYFIN_ADMIN_KEYS, fetchJellyfinSetup } from "../admin/jellyfin/jellyfinAdminApi";

/** L'adresse du tableau de bord bouge rarement : pas besoin du suivi serré de la vue d'ensemble. */
const DASHBOARD_STALE_TIME = 5 * 60_000;

/**
 * Ce que le guide sait ouvrir sur le web, le bureau et le miroir :
 * l'administration de Tentacle est DANS l'application (routes internes), et
 * seulement pour un administrateur ; le tableau de bord de Jellyfin, à
 * l'adresse que donnent les réglages recommandés (publique, sinon interne) —
 * lue sous la même clé que la vue d'ensemble, et jamais pour un compte qui
 * n'administre rien (la route lui est fermée).
 */
export function useGuideLinkContext(): TrailerGuideLinkContext {
  const { isAdmin } = getUserInfo();
  const { data } = useQuery({
    queryKey: JELLYFIN_ADMIN_KEYS.setup,
    queryFn: fetchJellyfinSetup,
    enabled: isAdmin,
    staleTime: DASHBOARD_STALE_TIME,
    retry: false,
  });
  const jellyfinUrl = isAdmin ? (data?.dashboardUrl ?? null) : null;
  return useMemo(
    () => ({ isAdmin, jellyfinUrl, adminOrigin: isAdmin ? "app" : null }),
    [isAdmin, jellyfinUrl],
  );
}
