import { useEffect, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { useServerUrl } from "@/providers/ServerUrlContext";

// --- Mini store réactif pour les plugins en erreur (WebView crash) ---
const failedPluginIds = new Set<string>();
let listeners: Array<() => void> = [];

function emitChange() {
  for (const l of listeners) l();
}

export function markPluginFailed(pluginId: string) {
  if (!failedPluginIds.has(pluginId)) {
    failedPluginIds.add(pluginId);
    emitChange();
  }
}

export function clearPluginFailed(pluginId: string) {
  if (failedPluginIds.delete(pluginId)) {
    emitChange();
  }
}

function subscribeFailedPlugins(callback: () => void) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}

function getFailedSnapshot(): ReadonlySet<string> {
  return failedPluginIds;
}

export function useFailedPlugins(): ReadonlySet<string> {
  return useSyncExternalStore(subscribeFailedPlugins, getFailedSnapshot, getFailedSnapshot);
}

export interface PluginNavItem {
  path: string;
  icon: string;
  platforms: string[];
  labels: Record<string, string>;
}

/**
 * Champ `tab` du manifeste, relayé tel quel par le serveur : comment le plugin
 * veut nommer et illustrer l'onglet mobile qui regroupe ses pages. `icon` est
 * un nom Feather, `labels` est indexé par code de langue (l'anglais sert de
 * repli). Optionnel : sans lui, l'app retombe sur sa table des plugins connus,
 * puis sur le nom du plugin.
 */
export interface PluginTabMeta {
  icon?: string;
  labels?: Record<string, string>;
}

export interface ActivePlugin {
  id: string;
  pluginId: string;
  name: string;
  version: string;
  hasBundle: boolean;
  navItems: PluginNavItem[];
  configEnabled?: boolean;
  tab?: PluginTabMeta;
}

export function useActivePlugins() {
  const { storage } = useTentacleConfig();
  const { serverUrl } = useServerUrl();
  const token = storage.getItem("tentacle_token");

  return useQuery({
    queryKey: ["plugins", "active", serverUrl],
    queryFn: async (): Promise<ActivePlugin[]> => {
      const res = await fetch(`${serverUrl}/api/plugins/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const all: ActivePlugin[] = await res.json();
      return all.filter((p) => p.hasBundle && p.configEnabled === true);
    },
    enabled: !!serverUrl && !!token,
    staleTime: 5 * 60_000,
  });
}

/**
 * Pré-fetch les bundles IIFE de tous les plugins actifs dès le login,
 * pour que la WebView soit instantanée quand l'utilisateur ouvre un onglet plugin.
 */
export function usePrefetchPluginBundles() {
  const { data: plugins } = useActivePlugins();
  const { storage } = useTentacleConfig();
  const { serverUrl } = useServerUrl();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!plugins || !serverUrl) return;
    const token = storage.getItem("tentacle_token");
    if (!token) return;

    // Prefetch shared-deps (utilisé par tous les plugins)
    queryClient.prefetchQuery({
      queryKey: ["shared-deps", serverUrl],
      queryFn: async () => {
        const res = await fetch(`${serverUrl}/api/plugins/shared-deps.js`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Shared deps fetch failed: ${res.status}`);
        return res.text();
      },
      staleTime: 60 * 60_000,
      gcTime: Infinity,
    });

    // Prefetch chaque bundle plugin
    for (const plugin of plugins) {
      queryClient.prefetchQuery({
        queryKey: ["plugin-bundle", plugin.pluginId, serverUrl],
        queryFn: async () => {
          const res = await fetch(`${serverUrl}/api/plugins/${plugin.pluginId}/bundle`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) throw new Error(`Bundle fetch failed: ${res.status}`);
          return res.text();
        },
        staleTime: 10 * 60_000,
      });
    }
  }, [plugins, serverUrl, storage, queryClient]);
}
