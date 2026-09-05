import { useEffect } from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTentacleConfig, type NotifPluginMeta } from "@tentacle-tv/api-client";
import { useServerUrl } from "@/providers/ServerUrlContext";

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

/**
 * La requête des plugins actifs, partagée par le hook et par l'impératif
 * (tap sur une notification poussée : `queryClient.ensureQueryData`). La clé
 * ne change pas : le cache persisté et les préchargements la connaissent.
 */
export function activePluginsQueryOptions(serverUrl: string | null, token: string | null) {
  return queryOptions({
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

export function useActivePlugins() {
  const { storage } = useTentacleConfig();
  const { serverUrl } = useServerUrl();
  return useQuery(activePluginsQueryOptions(serverUrl, storage.getItem("tentacle_token")));
}

/** Ce que la résolution d'une route de notification a besoin de savoir des plugins. */
export function toNotifPluginMeta(plugins: readonly ActivePlugin[]): NotifPluginMeta[] {
  return plugins.map((p) => ({ pluginId: p.pluginId, navItems: p.navItems ?? [] }));
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
