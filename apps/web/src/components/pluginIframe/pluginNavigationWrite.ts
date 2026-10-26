import { useCallback, useEffect, useRef } from "react";
import { useActivePluginsMeta, useRefreshPlugins } from "@tentacle-tv/plugins-api";

/**
 * Une extension qui ÉCRIT sa navigation (capacité `plugins.navigation`) depuis
 * sa page — son administration, par le pont `API_REQUEST` — change le nom ou
 * la place de ses pages : la barre se relit aussitôt (`/api/plugins/active`,
 * que le serveur a déjà invalidé), sans rechargement. Aucun nouveau message de
 * pont : l'hôte reconnaît l'écriture à sa route, déclarée par l'extension.
 */

interface BridgeRequest {
  method?: unknown;
  path?: unknown;
}

/** Une écriture réussie de l'extension `pluginId` vers SA route `navigation`. */
export function isNavigationWrite(request: BridgeRequest, status: unknown, pluginId: string, route: string | undefined): boolean {
  if (!route || typeof request.path !== "string" || typeof status !== "number") return false;
  const method = typeof request.method === "string" && request.method ? request.method.toUpperCase() : "GET";
  if (method === "GET" || status < 200 || status >= 300) return false;
  let pathname: string;
  try {
    pathname = new URL(request.path, "http://tentacle.invalid").pathname;
  } catch {
    return false;
  }
  return pathname === `/api/plugins/${pluginId}${route}`;
}

/**
 * Une écriture réussie de l'extension vers SA configuration (`PUT /api/plugins/<id>/config`, route
 * d'administration du cœur) : l'intégration a pu être activée ou coupée (`enabled`), ses pages et ses
 * contrats (`/api/plugins/active`) changent — la barre et Octave se relisent aussitôt.
 */
export function isConfigWrite(request: BridgeRequest, status: unknown, pluginId: string): boolean {
  return isNavigationWrite(request, status, pluginId, "/config");
}

/** Ce que l'hôte appelle à chaque réponse `API_RESPONSE` rendue à l'iframe de `pluginId`. */
export function useNavigationWriteWatcher(pluginId: string): (request: BridgeRequest, reply: Record<string, unknown>) => void {
  const plugins = useActivePluginsMeta();
  const refreshPlugins = useRefreshPlugins();
  const route = useRef<string | undefined>(undefined);
  useEffect(() => {
    route.current = plugins.find((plugin) => plugin.pluginId === pluginId)?.navigation;
  }, [plugins, pluginId]);
  return useCallback(
    (request, reply) => {
      if (isNavigationWrite(request, reply.status, pluginId, route.current) || isConfigWrite(request, reply.status, pluginId)) refreshPlugins();
    },
    [pluginId, refreshPlugins],
  );
}
