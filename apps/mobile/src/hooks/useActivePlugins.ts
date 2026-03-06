import { useMemo, useEffect, useSyncExternalStore, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
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

export interface ActivePlugin {
  id: string;
  pluginId: string;
  name: string;
  version: string;
  hasBundle: boolean;
  navItems: PluginNavItem[];
  configEnabled?: boolean;
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
      return all.filter((p) => p.hasBundle && p.configEnabled !== false);
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

/** Returns all mobile navItems across all active plugins, localized.
 *  Exclut les plugins dont la WebView a crashé (markPluginFailed). */
export function useMobilePluginNavItems() {
  const { data: plugins } = useActivePlugins();
  const { i18n } = useTranslation();
  const lang = i18n.language?.slice(0, 2) ?? "en";
  const failed = useFailedPlugins();

  return useMemo(() => {
    if (!plugins) return [];
    return plugins
      .filter((plugin) => !failed.has(plugin.pluginId))
      .flatMap((plugin) =>
        (plugin.navItems ?? [])
          .filter((item) => item.platforms.includes("mobile"))
          .map((item) => ({
            pluginId: plugin.pluginId,
            pluginName: plugin.name,
            path: item.path,
            icon: item.icon,
            label: item.labels[lang] ?? item.labels["en"] ?? plugin.name,
          })),
      );
  }, [plugins, lang, failed]);
}
