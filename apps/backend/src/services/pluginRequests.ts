import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { readTitlesMeta } from "../routes/pluginTitlesMeta";
import { DATA_DIR, getInstalled, isValidPluginId } from "./pluginManager";

/**
 * Une extension sait-elle DEMANDER un titre ? Générique — aucune extension
 * n'est nommée : une extension activée ET configurée dont le manifeste
 * déclare la demande du contrat `titles` (`titles.request`), comme
 * `/api/plugins/active` le dit aux clients. C'est ce qui donne un sens au
 * droit d'invité « peut demander » (`features.family.guestRequests`). Lu au
 * plus toutes les 30 s : `/api/config` le demande souvent.
 */

const TTL_MS = 30_000;
let cache: { value: boolean; at: number } | null = null;

function declaresRequest(pluginId: string): boolean {
  const manifestPath = resolve(DATA_DIR, pluginId, "plugin.json");
  if (!existsSync(manifestPath)) return false;
  try {
    return readTitlesMeta(JSON.parse(readFileSync(manifestPath, "utf-8")))?.request !== undefined;
  } catch {
    return false;
  }
}

export function hasRequestExtension(now: number = Date.now()): boolean {
  if (cache && now - cache.at < TTL_MS) return cache.value;
  const value = getInstalled().some(
    (plugin) =>
      plugin.enabled &&
      isValidPluginId(plugin.pluginId) &&
      (plugin.config as Record<string, unknown> | undefined)?.enabled === true &&
      declaresRequest(plugin.pluginId),
  );
  cache = { value, at: now };
  return value;
}

/** Les bancs (et un changement d'extension qu'on veut voir tout de suite). */
export function forgetRequestExtension(): void {
  cache = null;
}
