import { useState, useEffect, useSyncExternalStore, useMemo } from "react";
import type { ReactNode } from "react";
import type { TentaclePlugin } from "./types";
import { PluginContext } from "./context";
import { subscribeRegistry, getRegistrySnapshot } from "./registry";

interface PluginProviderProps {
  children: ReactNode;
}

export function PluginProvider({ children }: PluginProviderProps) {
  const plugins = useSyncExternalStore(subscribeRegistry, getRegistrySnapshot);
  const [enabledPlugins, setEnabledPlugins] = useState<TentaclePlugin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkPlugins() {
      setLoading(true);
      const enabled: TentaclePlugin[] = [];

      for (const plugin of plugins) {
        try {
          const configured = await plugin.isConfigured();
          if (configured) {
            enabled.push(plugin);
          }
        } catch {
          // Plugin config check failed — treat as not configured
        }
      }

      if (!cancelled) {
        setEnabledPlugins(enabled);
        setLoading(false);
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
  }), [plugins, enabledPlugins, loading]);

  return (
    <PluginContext.Provider value={value}>
      {children}
    </PluginContext.Provider>
  );
}
