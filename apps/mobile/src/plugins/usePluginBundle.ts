import { useQuery } from "@tanstack/react-query";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { useServerUrl } from "@/providers/ServerUrlContext";

/**
 * Fetche les shared-deps (React, ReactDOM, TanStack Query, i18next) depuis le backend.
 * Côté React Native (pas WebView) pour éviter le blocage WKWebView origin null.
 */
export function useSharedDeps() {
  const { storage } = useTentacleConfig();
  const { serverUrl } = useServerUrl();

  return useQuery({
    queryKey: ["shared-deps", serverUrl],
    queryFn: async () => {
      const token = storage.getItem("tentacle_token");
      const res = await fetch(`${serverUrl}/api/plugins/shared-deps.js`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Shared deps fetch failed: ${res.status}`);
      return res.text();
    },
    enabled: !!serverUrl,
    staleTime: 60 * 60_000,
    gcTime: Infinity,
  });
}

/**
 * Fetche le bundle IIFE d'un plugin depuis le backend (côté natif, avec auth).
 * Le résultat est le code JS brut en string, prêt à être inliné dans le HTML template.
 */
export function usePluginBundle(pluginId: string | undefined) {
  const { storage } = useTentacleConfig();
  const { serverUrl } = useServerUrl();

  return useQuery({
    queryKey: ["plugin-bundle", pluginId, serverUrl],
    queryFn: async () => {
      const token = storage.getItem("tentacle_token");
      if (!serverUrl || !token) throw new Error("Not authenticated");

      const res = await fetch(`${serverUrl}/api/plugins/${pluginId}/bundle`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Bundle fetch failed: ${res.status}`);
      return res.text();
    },
    enabled: !!pluginId && !!serverUrl,
    staleTime: 10 * 60_000,
  });
}
