import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { DATA_DIR, isValidPluginId } from "./pluginManager";

/**
 * Où vit le module serveur d'une extension, et son manifeste lu sans erreur.
 * Une seule source pour le chargeur (`pluginBackendLoader.ts`), les gardes des
 * routes d'administration et la garde de stockage (`pluginStorage/gate.ts`).
 */

/** Le manifeste `plugin.json` d'une extension installée, `null` s'il manque ou ne se lit pas. */
export function readPluginManifest(pluginId: string): Record<string, unknown> | null {
  if (!isValidPluginId(pluginId)) return null;
  const manifestPath = resolve(DATA_DIR, pluginId, "plugin.json");
  if (!existsSync(manifestPath)) return null;
  try {
    const manifest: unknown = JSON.parse(readFileSync(manifestPath, "utf-8"));
    return manifest && typeof manifest === "object" ? (manifest as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Les emplacements qu'essaie le chargeur, dans l'ordre : le déclaré d'abord. */
export function serverModuleCandidates(pluginId: string, declared?: unknown): string[] {
  const pluginDir = resolve(DATA_DIR, pluginId);
  return [
    ...(typeof declared === "string" && declared ? [resolve(pluginDir, declared)] : []),
    resolve(pluginDir, "server", "index.js"),
    resolve(pluginDir, "server", "index.mjs"),
    resolve(pluginDir, "server.js"),
  ];
}

/**
 * L'extension a-t-elle un module serveur ? S'il y en a un, l'activer redémarre
 * le serveur (Fastify n'ajoute pas de routes une fois à l'écoute), et il
 * touche la base : la garde de stockage le concerne.
 */
export function pluginHasServerModule(pluginId: string): boolean {
  if (!isValidPluginId(pluginId)) return false;
  const manifest = readPluginManifest(pluginId);
  if (manifest?.server) return true;
  return serverModuleCandidates(pluginId).some((path) => existsSync(path));
}
