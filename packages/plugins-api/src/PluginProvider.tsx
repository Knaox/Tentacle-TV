import { useState, useEffect, useSyncExternalStore, useMemo } from "react";
import type { ReactNode } from "react";
import type { TentaclePlugin } from "./types";
import { PluginContext } from "./context";
import type { ActivePluginMeta } from "./context";
import { subscribeRegistry, getRegistrySnapshot } from "./registry";

interface PluginProviderProps {
  children: ReactNode;
  backendUrl?: string;
}

export function PluginProvider({ children, backendUrl = "" }: PluginProviderProps) {
  const plugins = useSyncExternalStore(subscribeRegistry, getRegistrySnapshot);
  const [enabledPlugins, setEnabledPlugins] = useState<TentaclePlugin[]>([]);
  const [activePluginsMeta, setActivePluginsMeta] = useState<ActivePluginMeta[]>([]);
  const [loading, setLoading] = useState(true);

  // Load active plugin metadata from backend (bundles loaded by PluginIframe)
  useEffect(() => {
    const hasAuth = typeof localStorage !== "undefined"
      && !!(localStorage.getItem("tentacle_token") || localStorage.getItem("tentacle_user"));
    if (!hasAuth) { setLoading(false); return; }

    const base = backendUrl || "";
    fetch(`${base}/api/plugins/active`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((active: ActivePluginMeta[]) => {
        setActivePluginsMeta(active);
        setLoading(false);
      })
      .catch(() => { setLoading(false); });
  }, [backendUrl]);

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
  }), [plugins, enabledPlugins, loading, activePluginsMeta]);

  return (
    <PluginContext.Provider value={value}>
      {children}
    </PluginContext.Provider>
  );
}
