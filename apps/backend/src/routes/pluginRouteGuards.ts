import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { DATA_DIR, isValidPluginId } from "../services/pluginManager";

/**
 * Gardes communes aux routes d'administration des plugins (`plugins.ts` et
 * ses modules) : validation des identifiants de route, présence d'un module
 * serveur.
 */

/** Validate :id param — must be a UUID or a valid pluginId (blocks path traversal). */
export function isValidRouteId(id: string): boolean {
  // UUID format (internal DB IDs)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return true;
  // Valid plugin ID format
  return isValidPluginId(id);
}

/**
 * Check if a plugin has a server module. If so, the process needs to restart
 * because Fastify cannot register routes after the server is already listening.
 */
export function pluginHasServerModule(pluginId: string): boolean {
  if (!isValidPluginId(pluginId)) return false;
  const pluginDir = resolve(DATA_DIR, pluginId);
  const manifestPath = resolve(pluginDir, "plugin.json");
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      if (manifest.server) return true;
    } catch { /* ignore */ }
  }
  return existsSync(resolve(pluginDir, "server", "index.js"))
    || existsSync(resolve(pluginDir, "server", "index.mjs"));
}
