import { useQuery } from "@tanstack/react-query";
import { tentacleApiFetch } from "@tentacle-tv/api-client";
import type { SearchablePlugin, TitlesPlugin } from "@tentacle-tv/shared";
import { MY_TITLES_REFRESH } from "@tentacle-tv/tv-core";

/**
 * Les extensions actives du serveur (`/api/plugins/active`), réduites à ce que
 * la TV en lit : le contrat `titles` de chacune, et sa recherche hors
 * bibliothèque (`search`, la rangée « À demander »). Le serveur n'y met que les
 * extensions installées et activées, et ne relaie `titles` que si
 * l'intégration est configurée (`configEnabled`).
 *
 * Une seule lecture pour tout l'appareil, rafraîchie de loin en loin : le
 * cache des requêtes est purgé au déjumelage, la liste d'un autre compte ou
 * d'un autre serveur ne survit donc pas.
 */

export const ACTIVE_PLUGINS_KEY = ["plugins", "active"] as const;

/** Une extension active, telle que la TV la lit. */
export type ActivePlugin = TitlesPlugin & SearchablePlugin;

function pick(raw: unknown): ActivePlugin[] {
  if (!Array.isArray(raw)) return [];
  const out: ActivePlugin[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object" || typeof (p as TitlesPlugin).pluginId !== "string") continue;
    const { pluginId, configEnabled, titles, name, search } = p as ActivePlugin;
    // Chemins et types se valident à la lecture (`titleProvider`, `searchProviders`).
    out.push({ pluginId, configEnabled, titles, name: typeof name === "string" ? name : pluginId, search });
  }
  return out;
}

/** `null` tant que la liste n'est pas lue. */
export function useActivePlugins(): ActivePlugin[] | null {
  const { data } = useQuery({
    queryKey: ACTIVE_PLUGINS_KEY,
    queryFn: async () => pick(await tentacleApiFetch<unknown>("/api/plugins/active")),
    staleTime: MY_TITLES_REFRESH.accessMs,
    retry: 1,
  });
  return data ?? null;
}
