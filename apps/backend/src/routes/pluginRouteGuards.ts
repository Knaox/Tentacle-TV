import { isValidPluginId, type InstalledPlugin } from "../services/pluginManager";
import { pluginHasServerModule } from "../services/pluginServerModule";
import { pluginBackendDiag } from "../services/pluginBackendLoader";
import { storageRefusal, type StorageRefusalReason } from "../services/pluginStorage/gate";

/**
 * Gardes communes aux routes d'administration des plugins (`plugins.ts` et
 * ses modules) : validation des identifiants de route, module serveur d'un
 * plugin et règle de redémarrage qui en découle.
 */

/** Validate :id param — must be a UUID or a valid pluginId (blocks path traversal). */
export function isValidRouteId(id: string): boolean {
  // UUID format (internal DB IDs)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return true;
  // Valid plugin ID format
  return isValidPluginId(id);
}

// Déplacé dans les services (le chargeur et la garde de stockage le lisent aussi).
export { pluginHasServerModule } from "../services/pluginServerModule";

/**
 * Ce que fait le module serveur d'un plugin DANS CE PROCESSUS :
 * - `running` : chargé au démarrage, ses routes répondent ;
 * - `failed` : le chargement a échoué (`detail` dit pourquoi), ou ce serveur
 *   le refuse (`refusal` : extension pas déclarée compatible SQLite) ;
 * - `idle` : des fichiers serveur, mais rien de chargé — plugin désactivé au
 *   démarrage, ou activé depuis ;
 * - `none` : pas de module serveur.
 */
export type ServerModuleState = "none" | "running" | "failed" | "idle";

export function serverModuleState(
  pluginId: string,
): { state: ServerModuleState; detail?: string; refusal?: StorageRefusalReason } {
  const boot = pluginBackendDiag.loadResults.find((r) => r.pluginId === pluginId);
  if (boot?.status === "loaded") return { state: "running" };
  // Refusée par ce serveur : « en échec » pour les interfaces d'avant, `refusal` dit pourquoi aux nouvelles.
  const refusal = storageRefusal(pluginId);
  if (refusal) return { state: "failed", detail: boot?.detail, refusal };
  if (boot?.status === "error" || boot?.status === "bad_export") return { state: "failed", detail: boot.detail };
  return { state: pluginHasServerModule(pluginId) ? "idle" : "none" };
}

/**
 * Quand un changement de plugin redémarre le serveur — la règle que les routes
 * appliquent, rendue à l'interface pour qu'elle prévienne AVANT le geste :
 * - `restartRequired` : l'activation n'est pas appliquée — module à démarrer
 *   (activé depuis le démarrage) ou à arrêter (désactivé, mais il tourne) ;
 * - `restartsOn.update` : une mise à jour recharge un module actif ;
 * - `restartsOn.uninstall` : une désinstallation décharge un module chargé.
 */
export function restartPolicy(plugin: InstalledPlugin) {
  const serverModule = serverModuleState(plugin.pluginId);
  const { state } = serverModule;
  return {
    serverModule,
    restartRequired: (plugin.enabled && state === "idle") || (!plugin.enabled && state === "running"),
    restartsOn: {
      update: plugin.enabled && pluginHasServerModule(plugin.pluginId),
      uninstall: state === "running" || state === "failed",
    },
  };
}
