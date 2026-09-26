import { useQuery } from "@tanstack/react-query";
import { pluginApi } from "./pluginApi";
import type { InstalledPlugin, MarketplacePlugin, PluginSource } from "./types";

/** Les clés du cache de la page : invalider la racine rafraîchit les trois onglets. */
export const PLUGIN_QUERY_ROOT = ["admin-plugins"] as const;

export const pluginKeys = {
  installed: [...PLUGIN_QUERY_ROOT, "installed"] as const,
  marketplace: [...PLUGIN_QUERY_ROOT, "marketplace"] as const,
  sources: [...PLUGIN_QUERY_ROOT, "sources"] as const,
};

export function useInstalledPlugins() {
  return useQuery({
    queryKey: pluginKeys.installed,
    queryFn: () => pluginApi<InstalledPlugin[]>(""),
    staleTime: 30_000,
  });
}

/**
 * Le catalogue — lu aussi par l'onglet des plugins installés, pour y annoncer
 * les mises à jour. Il peut tarder (un registre lent se lit dix secondes avant
 * abandon) : la liste des installés s'affiche sans l'attendre.
 */
export function useMarketplacePlugins() {
  return useQuery({
    queryKey: pluginKeys.marketplace,
    queryFn: () => pluginApi<MarketplacePlugin[]>("/marketplace"),
    staleTime: 60_000,
  });
}

export function usePluginSources() {
  return useQuery({
    queryKey: pluginKeys.sources,
    queryFn: () => pluginApi<PluginSource[]>("/sources"),
    staleTime: 30_000,
  });
}
