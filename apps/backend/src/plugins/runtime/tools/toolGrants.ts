import { existsSync, readFileSync, renameSync, writeFileSync } from "fs";
import { resolve } from "path";
import { DATA_DIR, isValidPluginId } from "../../../services/pluginManager";
import type { ToolName } from "../pluginServerRuntime";
import { KNOWN_TOOLS } from "../runtimeManifest";

/**
 * La LISTE BLANCHE des outils, par extension et par outil, tenue par
 * l'ADMINISTRATEUR (réglage du cœur, jamais de l'extension) : un outil que le
 * manifeste demande reste FERMÉ tant que l'administrateur ne l'a pas permis.
 * Le fichier vit dans `data/plugins/`, hors du dossier de chaque extension :
 * un invité ne le lit ni ne l'écrit.
 */

type GrantFile = Record<string, { tools?: string[] }>;

const GRANTS_FILE = "runtime-grants.json";

function grantsPath(): string {
  return resolve(DATA_DIR, GRANTS_FILE);
}

function readGrants(): GrantFile {
  const path = grantsPath();
  if (!existsSync(path)) return {};
  try {
    const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
    return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as GrantFile) : {};
  } catch {
    return {};
  }
}

export function grantedTools(pluginId: string): ToolName[] {
  const tools = readGrants()[pluginId]?.tools;
  if (!Array.isArray(tools)) return [];
  return KNOWN_TOOLS.filter((tool) => tools.includes(tool));
}

export function isToolGranted(pluginId: string, tool: ToolName): boolean {
  return grantedTools(pluginId).includes(tool);
}

/** Écrit l'accord (atomique : fichier temporaire puis renommage). */
export function setToolGrant(pluginId: string, tool: ToolName, allowed: boolean): ToolName[] {
  if (!isValidPluginId(pluginId)) throw new Error("Invalid plugin ID");
  const grants = readGrants();
  const current = new Set(grantedTools(pluginId));
  if (allowed) current.add(tool);
  else current.delete(tool);
  const tools = KNOWN_TOOLS.filter((t) => current.has(t));
  grants[pluginId] = { tools };
  const tmp = `${grantsPath()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(grants, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, grantsPath());
  return tools;
}

/** Désinstallée, l'extension perd ses accords : réinstallée, elle les redemande. */
export function forgetToolGrants(pluginId: string): void {
  const grants = readGrants();
  if (!(pluginId in grants)) return;
  delete grants[pluginId];
  writeFileSync(grantsPath(), `${JSON.stringify(grants, null, 2)}\n`, { mode: 0o600 });
}
