import { getInstalled, isValidPluginId, type InstalledPlugin } from "../pluginManager";
import { pluginHasServerModule, readPluginManifest } from "../pluginServerModule";

/**
 * Le serveur ne sert que depuis SQLite : une extension dont le module serveur
 * ne DÉCLARE pas savoir y tourner n'est PAS chargée — ni ses routes, ni ses
 * pages, ni ce qu'elle annonce aux clients : jamais à moitié. L'administration
 * le dit (carte de l'extension, « À régler »), jamais en silence.
 *
 * La déclaration, dans `plugin.json` : `"storage": { "sqlite": true }`. Une
 * extension sans module serveur ne touche pas la base : rien à déclarer.
 *
 * Règle FERMÉE : aucune détection de moteur, rien qui puisse la rouvrir par
 * défaut. Un ancien Vigie (sonde « SELECT puis DROP » au démarrage) ne déclare
 * rien : il ne tourne jamais ici. Un identifiant invalide vaut refus.
 */

export type StorageRefusalReason = "sqliteUnsupported";

export function declaresSqliteSupport(manifest: unknown): boolean {
  if (!manifest || typeof manifest !== "object") return false;
  const storage = (manifest as { storage?: unknown }).storage;
  return !!storage && typeof storage === "object" && (storage as { sqlite?: unknown }).sqlite === true;
}

/** Pourquoi l'extension ne se charge pas sur ce serveur, `null` si elle se charge. */
export function storageRefusal(pluginId: string): StorageRefusalReason | null {
  if (!isValidPluginId(pluginId)) return "sqliteUnsupported";
  if (!pluginHasServerModule(pluginId)) return null;
  return declaresSqliteSupport(readPluginManifest(pluginId)) ? null : "sqliteUnsupported";
}

export interface RefusedPlugin {
  pluginId: string;
  name: string;
  version: string;
  reason: StorageRefusalReason;
}

/** Les extensions ACTIVÉES que ce serveur refuse de charger. */
export function refusedPlugins(): RefusedPlugin[] {
  return getInstalled().flatMap((plugin) => {
    if (!plugin.enabled) return [];
    const reason = storageRefusal(plugin.pluginId);
    return reason ? [{ pluginId: plugin.pluginId, name: plugin.name, version: plugin.version, reason }] : [];
  });
}

/**
 * LA règle d'une extension qui sert : installée, activée, d'identifiant
 * valide, et pas refusée par ce serveur. Tout ce qui, dans le cœur, décide
 * qu'une extension « est là » (liste servie aux clients, demandes de titres,
 * rangées et recommandations de Vigie, bundle) passe par elle — jamais par une
 * lecture directe de installed.json.
 */
export function isPluginUsable(plugin: Pick<InstalledPlugin, "pluginId" | "enabled">): boolean {
  return plugin.enabled === true && isValidPluginId(plugin.pluginId) && storageRefusal(plugin.pluginId) === null;
}

/** Les extensions qui servent, dans l'ordre de installed.json. */
export function usablePlugins(): InstalledPlugin[] {
  return getInstalled().filter(isPluginUsable);
}
