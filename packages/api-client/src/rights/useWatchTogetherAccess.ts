import { useQuery } from "@tanstack/react-query";
import { wtMayCreate, wtMayJoin, type WtAccess, type WtAccessDto } from "@tentacle-tv/shared";
import { tentacleApiFetch } from "../hooks/usePreferences";
import { useServerCapabilities } from "../hooks/useServerCapabilities";
import { useUserId } from "../hooks/useUserId";

/**
 * L'accès du compte à Watch Together (`SyncPlayAccess` de sa politique Jellyfin,
 * docs/DROITS-UTILISATEURS.md § 9.2) : `GET /api/watch-together/access`,
 * derrière la capacité `watchTogether.access`.
 *
 * - `none` : plus AUCUNE trace de Watch Together ;
 * - `joinOnly` : rien qui CRÉE un salon — les invitations et l'entrée restent ;
 * - sans la capacité : `full`, comme avant.
 *
 * Tant que l'accès n'est pas connu, rien ne s'ouvre : `access` vaut `null`, et
 * `mayCreate` / `mayJoin` restent faux (jamais montré puis retiré).
 */
export const WT_ACCESS_KEY = "wt-access";

export interface WatchTogetherAccessState {
  access: WtAccess | null;
  mayCreate: boolean;
  mayJoin: boolean;
}

function stateOf(access: WtAccess | null): WatchTogetherAccessState {
  return { access, mayCreate: access !== null && wtMayCreate(access), mayJoin: access !== null && wtMayJoin(access) };
}

export function useWatchTogetherAccess(): WatchTogetherAccessState {
  const { capabilities, settled } = useServerCapabilities();
  const capable = capabilities.has("watchTogether.access");
  const userId = useUserId();
  const query = useQuery({
    queryKey: [WT_ACCESS_KEY, userId],
    queryFn: async () => (await tentacleApiFetch<WtAccessDto>("/api/watch-together/access")).access,
    enabled: capable && !!userId,
    staleTime: 30_000,
  });
  if (!capable) return stateOf(settled ? "full" : null);
  return stateOf(query.data ?? null);
}
