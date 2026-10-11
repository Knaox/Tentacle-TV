/**
 * `jellyfin.start` : « Démarrer Jellyfin », pour l'INSTALLATION SIMPLE
 * seulement — son lanceur de la zone de notification
 * (`Jellyfin.Windows.Tray.exe`) démarre `jellyfin.exe` sans droits
 * d'administrateur, et s'inscrit de lui-même au démarrage de session.
 *
 * Lancé PAR L'EXPLORATEUR (`explorer.exe <lanceur>`), pas comme notre enfant :
 * un enfant d'une app MSIX hérite de sa virtualisation, et l'inscription au
 * démarrage du lanceur (`HKCU\…\Run`) partirait avec Tentacle. À éprouver sur
 * un Windows installé (diagnostic § 6.4).
 *
 * Un SERVICE n'est jamais démarré par nous : il exige une élévation, que
 * Tentacle ne demande jamais de lui-même. L'assistant renvoie vers Services.
 */
import { execFile } from "node:child_process";
import { join } from "node:path";
import type { JellyfinStartResult } from "../protocol";
import { JELLYFIN_SERVICE, readJellyfinRegistry, trayLauncher } from "./jellyfinFiles";
import { parseServiceState, type ToolRunner } from "./systemTools";

export interface StartDeps {
  run: ToolRunner;
  exists: (path: string) => boolean;
  /** Ouvre le lanceur par l'Explorateur ; `false` s'il n'a pas pu être lancé. */
  openWithExplorer: (path: string) => Promise<boolean>;
}

export async function startJellyfin(deps: StartDeps): Promise<JellyfinStartResult> {
  const service = parseServiceState(await deps.run("sc", ["query", JELLYFIN_SERVICE]));
  if (service !== "absent") return { started: false, reason: "service" };
  const registry = await readJellyfinRegistry(deps.run);
  if (!registry?.installFolder) return { started: false, reason: "not_installed" };
  if (registry.mode === "service") return { started: false, reason: "service" };
  const launcher = trayLauncher(registry.installFolder);
  if (!deps.exists(launcher)) return { started: false, reason: "launcher_missing" };
  return (await deps.openWithExplorer(launcher)) ? { started: true } : { started: false, reason: "failed" };
}

/** `explorer.exe` rend 1 même quand il a lancé le fichier : seul l'échec du lancement compte. */
export function explorerOpener(systemRoot: string): (path: string) => Promise<boolean> {
  return (path) =>
    new Promise((resolve) => {
      const child = execFile(join(systemRoot, "explorer.exe"), [path], { windowsHide: true }, () => undefined);
      child.once("error", () => resolve(false));
      child.once("spawn", () => resolve(true));
    });
}
