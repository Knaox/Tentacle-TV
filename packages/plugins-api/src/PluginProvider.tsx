import { useState, useEffect, useSyncExternalStore, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import type { TentaclePlugin } from "./types";
import { PluginContext } from "./context";
import { subscribeRegistry, getRegistrySnapshot } from "./registry";

interface ActivePlugin {
  pluginId: string;
  hasBundle: boolean;
  version: string;
}

interface PluginProviderProps {
  children: ReactNode;
  backendUrl?: string;
}

export function PluginProvider({ children, backendUrl = "" }: PluginProviderProps) {
  const plugins = useSyncExternalStore(subscribeRegistry, getRegistrySnapshot);
  const [enabledPlugins, setEnabledPlugins] = useState<TentaclePlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedBundles = useRef(new Set<string>());

  // Load dynamic plugin bundles from backend
  useEffect(() => {
    const token = localStorage.getItem("tentacle_token");
    if (!token) { setLoading(false); return; }

    const base = backendUrl || "";
    fetch(`${base}/api/plugins/active`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((active: ActivePlugin[]) => {
        for (const p of active) {
          if (p.hasBundle && !loadedBundles.current.has(p.pluginId)) {
            loadedBundles.current.add(p.pluginId);
            // Fetch bundle with auth header, then inject as inline script
            fetch(`${base}/api/plugins/${p.pluginId}/bundle?v=${p.version}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
              .then((r) => (r.ok ? r.text() : ""))
              .then((code) => {
                if (code) {
                  const script = document.createElement("script");
                  script.textContent = code;
                  document.head.appendChild(script);
                }
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, [backendUrl]);

  // Check which registered plugins are configured
  useEffect(() => {
    let cancelled = false;

    async function checkPlugins() {
      setLoading(true);
      const enabled: TentaclePlugin[] = [];

      for (const plugin of plugins) {
        try {
          // Initialize plugin (registers i18n, sets backend URL, etc.)
          if (plugin.initialize) {
            await plugin.initialize();
          }
          const configured = await plugin.isConfigured();
          if (configured) {
            enabled.push(plugin);
          }
        } catch {
          // Plugin init/config check failed — treat as not configured
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
