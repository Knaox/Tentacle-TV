import { getInstalled, isValidPluginId, type InstalledPlugin } from "../pluginManager";
import { pluginHasServerModule, readPluginManifest } from "../pluginServerModule";
import { isCompatibleWith } from "../pluginVersionPick";
import { BACKEND_VERSION } from "../version";
import { readRuntimeManifest } from "../../plugins/runtime/runtimeManifest";
import { SERVER_CAPABILITIES } from "../../serverCapabilities/serverCapabilities";
import { isNewerVersion } from "../semver";

/**
 * Ce que CE serveur refuse de charger — jamais à moitié : ni ses routes, ni ses
 * pages, ni ce qu'elle annonce aux clients. L'administration le dit (carte de
 * l'extension), jamais en silence. Deux raisons, dans cet ordre :
 *
 * - `requiresNewerServer` : l'extension exige un Tentacle plus récent — son
 *   `minTentacleVersion` (`plugin.json`), ou le runtime ISOLÉ qu'elle demande
 *   (`runtime.kind = "isolated"`, capacité `plugins.isolatedRuntime`) — que la
 *   version de ce serveur n'atteint pas (`services/version.ts`, version fixée au
 *   build comprise). Une extension installée à la main ou par une source passe
 *   par la même règle.
 * - `sqliteUnsupported` : le serveur ne sert que depuis SQLite ; un module
 *   serveur qui ne DÉCLARE pas savoir y tourner (`"storage": { "sqlite": true }`)
 *   ne se charge pas. Règle FERMÉE : aucune détection de moteur. Un ancien Vigie
 *   (sonde « SELECT puis DROP » au démarrage) ne déclare rien : il ne tourne
 *   jamais ici. Une extension sans module serveur ne touche pas la base.
 *
 * Un identifiant invalide vaut refus.
 */

export type StorageRefusalReason = "sqliteUnsupported" | "requiresNewerServer";

export function declaresSqliteSupport(manifest: unknown): boolean {
  if (!manifest || typeof manifest !== "object") return false;
  const storage = (manifest as { storage?: unknown }).storage;
  return !!storage && typeof storage === "object" && (storage as { sqlite?: unknown }).sqlite === true;
}

const VERSION_RE = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;

/** La version de Tentacle qu'exige un manifeste (règle pure) ; `null` : aucune exigence. */
export function requiredServerVersionOf(manifest: Record<string, unknown> | null): string | null {
  if (!manifest) return null;
  const wanted: string[] = [];
  const min = manifest.minTentacleVersion;
  if (typeof min === "string" && VERSION_RE.test(min.trim())) wanted.push(min.trim());
  if (readRuntimeManifest(manifest)) wanted.push(SERVER_CAPABILITIES["plugins.isolatedRuntime"]);
  return wanted.reduce<string | null>((best, v) => (!best || isNewerVersion(v, best) ? v : best), null);
}

/** La version de Tentacle qu'exige l'extension installée, si ce serveur ne l'atteint pas ; `null` sinon. */
export function missingServerVersion(pluginId: string, serverVersion: string = BACKEND_VERSION): string | null {
  const required = requiredServerVersionOf(readPluginManifest(pluginId));
  return required && !isCompatibleWith(serverVersion, required) ? required : null;
}

/** Pourquoi l'extension ne se charge pas sur ce serveur, `null` si elle se charge. */
export function storageRefusal(pluginId: string): StorageRefusalReason | null {
  if (!isValidPluginId(pluginId)) return "sqliteUnsupported";
  if (missingServerVersion(pluginId)) return "requiresNewerServer";
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
 * rangées et recommandations de Vigie, bundle, invités isolés) passe par elle —
 * jamais par une lecture directe de installed.json.
 */
export function isPluginUsable(plugin: Pick<InstalledPlugin, "pluginId" | "enabled">): boolean {
  return plugin.enabled === true && isValidPluginId(plugin.pluginId) && storageRefusal(plugin.pluginId) === null;
}

/** Les extensions qui servent, dans l'ordre de installed.json. */
export function usablePlugins(): InstalledPlugin[] {
  return getInstalled().filter(isPluginUsable);
}
