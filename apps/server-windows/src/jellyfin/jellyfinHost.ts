/**
 * Le Jellyfin de cette machine vu de l'hôte, assemblé une fois : détection,
 * installation guidée, « Démarrer Jellyfin » — et la boîte « Choisir un
 * dossier » des bibliothèques. Ce qui touche Windows (registre, élévation,
 * Explorateur) se branche ici ; les règles vivent dans leurs modules, testés.
 */
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { FolderPicker } from "../dialog/pickFolderProcess";
import { createHostServices, type HostServices } from "../host/hostServices";
import { HOST_METHOD_TIMEOUTS_MS } from "../protocol";
import { launchElevatedAndWait } from "../win32/elevatedLaunch";
import { detectJellyfin, probeJellyfin } from "./detect";
import { downloadVerified, fetchBody } from "./installer/download";
import { JellyfinInstaller } from "./installer/installer";
import { newestManifest } from "./installer/versionPick";
import { fetchOriginText, JELLYFIN_REPO_BASE, resolveInstaller } from "./installer/repo";
import { explorerOpener, startJellyfin } from "./start";
import { systemToolRunner } from "./systemTools";

export interface JellyfinHostOptions {
  systemRoot: string;
  env: NodeJS.ProcessEnv;
  /** Le manifeste de l'app, puis celui que le serveur a gardé plus récent dans ses données. */
  manifests: readonly string[];
  installerEnabled: boolean;
  arm64: boolean;
  /** Où poser l'installateur le temps de l'installation (dans le dossier de données). */
  downloadFolder: string;
  /** Le même exécutable et le même script que l'hôte, pour la boîte de dialogue. */
  execPath: string;
  hostScript: string;
  log: (line: string) => void;
}

function readText(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

export function createJellyfinHost(options: JellyfinHostOptions): HostServices {
  const run = systemToolRunner(options.systemRoot);
  const installer = new JellyfinInstaller({
    arm64: options.arm64,
    enabled: options.installerEnabled,
    readManifest: () => newestManifest(options.manifests.map(readText)),
    resolve: (names) => resolveInstaller(fetchOriginText, JELLYFIN_REPO_BASE, names),
    download: (url, file, expected, onProgress) => downloadVerified(fetchBody, url, file, expected, onProgress, AbortSignal.timeout(60 * 60_000)),
    launch: launchElevatedAndWait,
    folder: options.downloadFolder,
    ensureFolder: (path) => mkdirSync(path, { recursive: true }),
    remove: (path) => rmSync(path, { force: true }),
    log: options.log,
  });
  const picker = new FolderPicker(options.execPath, options.hostScript, options.log);
  const env = { ...(options.env.ProgramData ? { ProgramData: options.env.ProgramData } : {}), ...(options.env.LOCALAPPDATA ? { LOCALAPPDATA: options.env.LOCALAPPDATA } : {}) };
  return createHostServices({
    detect: () =>
      detectJellyfin({
        run,
        env,
        readText,
        exists: existsSync,
        probe: probeJellyfin,
        installer: () => ({ offer: installer.offer, installing: installer.busy }),
      }),
    install: () => installer.install(),
    installStatus: () => installer.status(),
    start: () => startJellyfin({ run, exists: existsSync, openWithExplorer: explorerOpener(options.systemRoot) }),
    pickFolder: (params) => picker.pick(params, HOST_METHOD_TIMEOUTS_MS["dialog.pickFolder"]),
    log: options.log,
  });
}

/** Le dossier de l'installateur téléchargé, sous le cache des données. */
export function installerFolder(cacheDir: string): string {
  return join(cacheDir, "jellyfin-installer");
}
