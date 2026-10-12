/**
 * Ce que l'installateur officiel de Jellyfin laisse sur la machine, relu comme
 * le fait son propre lanceur (`Jellyfin.Windows.Tray`) :
 *
 *  - la clé `HKLM\SOFTWARE\WOW6432Node\Jellyfin\Server` (l'installateur NSIS
 *    est 32 bits), puis la vue 64 bits par prudence : `InstallFolder`,
 *    `DataFolder`, `ServiceAccountType` (`None` = installation simple) ;
 *  - la clé de désinstallation `…\Uninstall\JellyfinServer` (`DisplayVersion`) ;
 *  - `<DataFolder>\config\network.xml` : `InternalHttpPort`, `BaseUrl`.
 *
 * Une installation par ZIP n'écrit rien au registre : le processus et la
 * sonde HTTP la rattrapent (`detect.ts`).
 */
import { win32 } from "node:path";

// Des chemins de Windows, quel que soit le système qui exécute (les tests
// tournent aussi sous Linux, dans quality.yml) : toujours le séparateur « \ ».
const { join } = win32;
import type { JellyfinLocalMode } from "../protocol";
import { parseRegKey, type ToolRunner } from "./systemTools";

const SERVER_KEYS = ["HKLM\\SOFTWARE\\WOW6432Node\\Jellyfin\\Server", "HKLM\\SOFTWARE\\Jellyfin\\Server"] as const;
const UNINSTALL_KEYS = [
  "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\JellyfinServer",
  "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\JellyfinServer",
] as const;

export const DEFAULT_JELLYFIN_PORT = 8096;
/** Le service que pose l'installateur (NSSM). */
export const JELLYFIN_SERVICE = "JellyfinServer";
export const JELLYFIN_PROCESS = "jellyfin.exe";

export interface JellyfinRegistry {
  installFolder: string | null;
  dataFolder: string | null;
  mode: JellyfinLocalMode | null;
  version: string | null;
}

async function firstKey(run: ToolRunner, keys: readonly string[]): Promise<Record<string, string> | null> {
  for (const key of keys) {
    const result = await run("reg", ["query", key]);
    if (result.code === 0) return parseRegKey(result.stdout);
  }
  return null;
}

/** `None` : installation simple ; un compte (`NetworkService`, `LocalSystem`…) : le service. */
export function modeOf(serviceAccountType: string | undefined): JellyfinLocalMode | null {
  if (serviceAccountType === undefined || serviceAccountType === "") return null;
  return serviceAccountType.toLowerCase() === "none" ? "tray" : "service";
}

/** `null` : l'installateur officiel n'est jamais passé (ou a été désinstallé). */
export async function readJellyfinRegistry(run: ToolRunner): Promise<JellyfinRegistry | null> {
  const server = await firstKey(run, SERVER_KEYS);
  const uninstall = await firstKey(run, UNINSTALL_KEYS);
  if (!server && !uninstall) return null;
  return {
    installFolder: server?.InstallFolder || null,
    dataFolder: server?.DataFolder || null,
    mode: modeOf(server?.ServiceAccountType),
    version: uninstall?.DisplayVersion || null,
  };
}

export interface NetworkSettings {
  port: number | null;
  /** `""` ou `/chemin`, sans barre finale. */
  baseUrl: string;
}

function element(xml: string, name: string): string | null {
  const match = new RegExp(`<${name}>\\s*([^<]*?)\\s*</${name}>`).exec(xml);
  return match?.[1] ?? null;
}

export function parseNetworkXml(xml: string): NetworkSettings {
  const port = Number(element(xml, "InternalHttpPort"));
  const rawBase = (element(xml, "BaseUrl") ?? "").trim().replace(/^\/+|\/+$/g, "");
  return {
    port: Number.isInteger(port) && port > 0 && port <= 65535 ? port : null,
    baseUrl: rawBase === "" ? "" : `/${rawBase}`,
  };
}

/**
 * Où chercher `network.xml` : le dossier du registre, puis les défauts de
 * l'installateur (`%ProgramData%\Jellyfin\Server`) et d'un ZIP lancé à la
 * main (`%LOCALAPPDATA%\jellyfin`).
 */
export function networkXmlCandidates(dataFolder: string | null, env: { ProgramData?: string; LOCALAPPDATA?: string }): string[] {
  const folders = [
    dataFolder,
    env.ProgramData ? join(env.ProgramData, "Jellyfin", "Server") : null,
    env.LOCALAPPDATA ? join(env.LOCALAPPDATA, "jellyfin") : null,
  ];
  return [...new Set(folders.filter((folder): folder is string => folder !== null))].map((folder) => join(folder, "config", "network.xml"));
}

/** Le lanceur de la zone de notification, posé par l'installation simple. */
export function trayLauncher(installFolder: string): string {
  return join(installFolder, "jellyfin-windows-tray", "Jellyfin.Windows.Tray.exe");
}
