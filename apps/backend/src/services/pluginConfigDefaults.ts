/**
 * La configuration D'OFFICE d'une extension : ce que son manifeste déclare (`configDefaults`, champ
 * ADDITIF de `plugin.json`), posé pour qu'elle marche sans un geste de l'administrateur.
 *
 * Une extension installée depuis une source naît avec `config: {}` ; or `/api/plugins/active` ne
 * publie ses pages et ses contrats qu'avec `config.enabled === true`. Une extension sans formulaire
 * qui pose cette clé (aucun réglage à demander) restait donc muette pour toujours. Ici :
 *
 *   - à l'installation et à la mise à jour, chaque clé déclarée ABSENTE de la configuration est posée ;
 *   - au démarrage du serveur, la même chose pour les extensions déjà installées (réparation) ;
 *   - une clé DÉJÀ présente n'est jamais touchée — un `enabled: false` posé exprès reste coupé.
 *
 * Générique : n'importe quelle extension peut le déclarer ; une extension qui ne déclare rien garde
 * exactement sa configuration d'avant (Vigie et son formulaire). Seules des valeurs simples
 * (booléen, nombre, texte court, `null`) sont acceptées, en petit nombre.
 */

import { getInstalled, saveInstalled, type InstalledPlugin } from "./pluginManager";
import { readPluginManifest } from "./pluginServerModule";

const MAX_KEYS = 16;
const MAX_TEXT = 256;
const KEY = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

type ConfigValue = boolean | number | string | null;

const simple = (value: unknown): value is ConfigValue =>
  value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))
  || (typeof value === "string" && value.length <= MAX_TEXT);

/** Les valeurs d'office qu'un manifeste déclare ; `null` s'il n'en déclare pas (ou rien d'acceptable). */
export function readConfigDefaults(manifest: unknown): Record<string, ConfigValue> | null {
  if (!manifest || typeof manifest !== "object") return null;
  const raw = (manifest as { configDefaults?: unknown }).configDefaults;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const kept = Object.entries(raw).filter(([key, value]) => KEY.test(key) && simple(value)).slice(0, MAX_KEYS);
  return kept.length > 0 ? Object.fromEntries(kept) : null;
}

/** La configuration complétée des clés d'office qui lui MANQUENT ; `null` si rien ne manque. */
export function withConfigDefaults(config: Record<string, unknown> | undefined, defaults: Record<string, ConfigValue> | null): Record<string, unknown> | null {
  if (!defaults) return null;
  const current = config ?? {};
  const missing = Object.entries(defaults).filter(([key]) => !Object.prototype.hasOwnProperty.call(current, key));
  return missing.length > 0 ? { ...current, ...Object.fromEntries(missing) } : null;
}

/** Complète la configuration d'une extension d'après SON manifeste sur le disque ; vrai si elle a changé. */
export function applyConfigDefaults(plugin: InstalledPlugin): boolean {
  const next = withConfigDefaults(plugin.config, readConfigDefaults(readPluginManifest(plugin.pluginId)));
  if (!next) return false;
  plugin.config = next;
  return true;
}

/**
 * Au démarrage : les extensions déjà installées reçoivent les clés d'office qui leur manquent (une
 * installation d'avant ce champ, une version qui en déclare une nouvelle). Rend les identifiants
 * réparés ; n'écrit `installed.json` que si quelque chose a changé.
 */
export function repairInstalledConfigDefaults(): string[] {
  const installed = getInstalled();
  const repaired = installed.filter(applyConfigDefaults).map((plugin) => plugin.pluginId);
  if (repaired.length > 0) {
    saveInstalled(installed);
    console.log(`[plugins] configuration d'office posée : ${repaired.join(", ")}`);
  }
  return repaired;
}
