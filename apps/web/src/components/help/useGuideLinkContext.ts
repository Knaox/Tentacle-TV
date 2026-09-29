import { useMemo } from "react";
import type { TrailerGuideLinkContext } from "@tentacle-tv/shared";
import { getUserInfo } from "../userMenu/menuItems";

/**
 * Ce que le guide sait ouvrir sur le web, le bureau et le miroir :
 * l'administration de Tentacle est DANS l'application (routes internes), et
 * seulement pour un administrateur. L'adresse du tableau de bord de Jellyfin
 * n'est pas encore connue ici : ses liens restent masqués.
 */
export function useGuideLinkContext(): TrailerGuideLinkContext {
  const { isAdmin } = getUserInfo();
  return useMemo(
    () => ({ isAdmin, jellyfinUrl: null, adminOrigin: isAdmin ? "app" : null }),
    [isAdmin],
  );
}
