import { useMemo } from "react";
import { availableUpdate, catalogIndex } from "./pluginCatalog";
import { useInstalledPlugins, useMarketplacePlugins, usePluginSources } from "./queries";

/**
 * Les trois listes de la page et ce qu'on en déduit : les mises à jour à
 * faire (par identifiant de plugin) et les sources dont le registre ne répond
 * pas. Les requêtes sont partagées par le cache : l'appeler depuis l'en-tête
 * et depuis un onglet ne les double pas.
 */
export function usePluginOverview() {
  const installed = useInstalledPlugins();
  const marketplace = useMarketplacePlugins();
  const sources = usePluginSources();

  const catalog = useMemo(() => catalogIndex(marketplace.data), [marketplace.data]);

  const updates = useMemo(() => {
    const found = new Map<string, string>();
    for (const plugin of installed.data ?? []) {
      const version = availableUpdate(plugin, catalog.get(plugin.pluginId));
      if (version) found.set(plugin.pluginId, version);
    }
    return found;
  }, [installed.data, catalog]);

  const unreachable = useMemo(
    () => (sources.data ?? []).filter((source) => source.enabled && source.registry?.error),
    [sources.data],
  );

  return { installed, marketplace, sources, catalog, updates, unreachable };
}
