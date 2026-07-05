import { useState, useEffect, useCallback, useSyncExternalStore, useMemo } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { TentaclePlugin } from "./types";
import { PluginContext } from "./context";
import type { ActivePluginMeta } from "./context";
import { subscribeRegistry, getRegistrySnapshot } from "./registry";

interface PluginProviderProps {
  children: ReactNode;
  backendUrl?: string;
}

const PLUGINS_ACTIVE_KEY = ["plugins-api", "active-meta"];

export function PluginProvider({ children, backendUrl = "" }: PluginProviderProps) {
  const plugins = useSyncExternalStore(subscribeRegistry, getRegistrySnapshot);
  const [enabledPlugins, setEnabledPlugins] = useState<TentaclePlugin[]>([]);
  const queryClient = useQueryClient();

  const base = backendUrl || "";

  // Fetch active plugin metadata from backend via React Query.
  // Automatically refetched when queryClient.invalidateQueries() is called (e.g. on login).
  const { data: activePluginsMeta = [], isLoading: loading } = useQuery({
    queryKey: PLUGINS_ACTIVE_KEY,
    queryFn: async (): Promise<ActivePluginMeta[]> => {
      const hasAuth = typeof localStorage !== "undefined"
        && !!(localStorage.getItem("tentacle_token") || localStorage.getItem("tentacle_user"));
      if (!hasAuth) return [];

      const token = typeof localStorage !== "undefined" ? localStorage.getItem("tentacle_token") : null;
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${base}/api/plugins/active`, {
        headers,
        credentials: token ? undefined : "include",
      });
      // Session absente/expirée : liste vide légitime (re-remplie après login).
      if (res.status === 401 || res.status === 403) return [];
      // Backend indisponible (redémarrage, 5xx) ou erreur réseau : on laisse
      // l'erreur remonter au lieu de cacher une liste vide « fraîche » pendant
      // staleTime — sinon les routes/menus des plugins disparaissent (404)
      // jusqu'au prochain rechargement complet. React Query retente, puis le
      // refetch au focus répare tout seul.
      if (!res.ok) throw new Error(`plugins/active HTTP ${res.status}`);
      return await res.json();
    },
    staleTime: 5 * 60_000,
    retry: 3,
    refetchOnWindowFocus: true,
  });

  // Manual refresh trigger (e.g. after plugin config change)
  const refreshPlugins = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: PLUGINS_ACTIVE_KEY });
  }, [queryClient]);

  // Check which registered plugins are configured (for mobile/desktop inline mode)
  useEffect(() => {
    let cancelled = false;

    async function checkPlugins() {
      const enabled: TentaclePlugin[] = [];

      for (const plugin of plugins) {
        try {
          if (plugin.initialize) {
            await plugin.initialize();
          }
          const configured = await plugin.isConfigured();
          if (configured) {
            enabled.push(plugin);
          }
        } catch (err) {
          console.warn(`[PluginProvider] ${plugin.id}: init/config check failed:`, err);
        }
      }

      if (!cancelled) {
        setEnabledPlugins(enabled);
      }
    }

    checkPlugins();
    return () => { cancelled = true; };
  }, [plugins]);

  const value = useMemo(() => ({
    plugins,
    enabledPlugins,
    isPluginEnabled: (id: string) => enabledPlugins.some((p) => p.id === id),
    loading,
    activePluginsMeta,
    refreshPlugins,
  }), [plugins, enabledPlugins, loading, activePluginsMeta, refreshPlugins]);

  return (
    <PluginContext.Provider value={value}>
      {children}
    </PluginContext.Provider>
  );
}
