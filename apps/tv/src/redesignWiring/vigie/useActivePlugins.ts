import { useQuery } from "@tanstack/react-query";
import { tentacleApiFetch } from "@tentacle-tv/api-client";
import type { TitlesPlugin } from "@tentacle-tv/shared";
import { MY_TITLES_REFRESH } from "@tentacle-tv/tv-core";

/**
 * Les extensions actives du serveur (`/api/plugins/active`), réduites à ce que
 * la TV en lit : le contrat `titles` de chacune. Le serveur n'y met que les
 * extensions installées et activées, et ne relaie `titles` que si
 * l'intégration est configurée (`configEnabled`).
 *
 * Une seule lecture pour tout l'appareil, rafraîchie de loin en loin : le
 * cache des requêtes est purgé au déjumelage, la liste d'un autre compte ou
 * d'un autre serveur ne survit donc pas.
 */

export const ACTIVE_PLUGINS_KEY = ["plugins", "active"] as const;

function pick(raw: unknown): TitlesPlugin[] {
  if (!Array.isArray(raw)) return [];
  const out: TitlesPlugin[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object" || typeof (p as TitlesPlugin).pluginId !== "string") continue;
    const { pluginId, configEnabled, titles } = p as TitlesPlugin;
    out.push({ pluginId, configEnabled, titles });
  }
  return out;
}

/** `null` tant que la liste n'est pas lue. */
export function useActivePlugins(): TitlesPlugin[] | null {
  const { data } = useQuery({
    queryKey: ACTIVE_PLUGINS_KEY,
    queryFn: async () => pick(await tentacleApiFetch<unknown>("/api/plugins/active")),
    staleTime: MY_TITLES_REFRESH.accessMs,
    retry: 1,
  });
  return data ?? null;
}
