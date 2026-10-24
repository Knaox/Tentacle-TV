import { fork, type ChildProcess } from "child_process";
import { lstatSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { randomBytes } from "crypto";
import { GUEST_ENV, type PluginRuntimeManifest } from "./pluginServerRuntime";

/**
 * Le lancement d'un invité : un processus Node À PART, sous le modèle de
 * permissions (`--permission`) — mesuré sous Node 24.22 (l'image) et 26 :
 * lecture limitée au dossier de l'extension, écriture à SON dossier de données,
 * ni processus enfant, ni fil de travail, ni module natif. `tentacle.db`, le
 * `.env` et la clé Jellyfin ne lui sont ni lisibles ni transmis : son
 * environnement est RECONSTRUIT (jamais celui du serveur), avec les seules
 * variables de `GUEST_ENV` et celles que le manifeste déclare.
 *
 * Node 25 et plus ferment aussi le réseau sous `--permission` : `--allow-net`
 * lui rend sa socket d'écoute et ses requêtes (catalogue, Lidarr). Node 24 n'a
 * pas de permission réseau (option inconnue : on ne la passe pas).
 */

export interface GuestPaths {
  pluginDir: string;
  dataDir: string;
  entry: string;
  socket: string;
}

/** Variables de l'hôte qu'un invité reçoit toujours : heure et langue, rien d'autre. */
const PASSTHROUGH_ENV = ["TZ", "LANG", "LC_ALL"];

let socketRoot: string | null = null;

/**
 * Le dossier des sockets, privé à CE processus serveur (0700). Hors du dossier
 * de données : un chemin de socket Unix tient en 104 octets sous macOS, et le
 * dossier d'un serveur de développement le dépasse.
 */
function runtimeSocketRoot(): string {
  if (socketRoot) return socketRoot;
  const base = process.env.TENTACLE_PLUGIN_RUNTIME_DIR?.trim() || tmpdir();
  mkdirSync(base, { recursive: true });
  socketRoot = mkdtempSync(join(base, "tentacle-rt-"));
  return socketRoot;
}

/** Une socket neuve pour `name` : nommée au hasard, jamais devinée par un autre invité. */
export function freshSocketPath(name: string): string {
  const tag = `${name}-${randomBytes(6).toString("hex")}`;
  if (process.platform === "win32") return `\\\\.\\pipe\\tentacle-${process.pid}-${tag}`;
  return join(runtimeSocketRoot(), `${tag}.sock`);
}

export function removeSocket(path: string): void {
  if (process.platform !== "win32") rmSync(path, { force: true });
}

/** Au départ du serveur : le dossier des sockets disparaît avec lui. */
export function cleanupSocketRoot(): void {
  if (socketRoot) rmSync(socketRoot, { recursive: true, force: true });
  socketRoot = null;
}

export function guestDataDir(pluginDir: string): string {
  return resolve(pluginDir, "data");
}

function nodeMajor(): number {
  return Number(process.versions.node.split(".")[0]);
}

/** Les options de Node de l'invité — jamais celles du serveur (tsx, inspecteur, chargeurs). */
export function guestExecArgv(paths: Pick<GuestPaths, "pluginDir" | "dataDir">, major = nodeMajor()): string[] {
  const args = [
    "--permission",
    `--allow-fs-read=${paths.pluginDir}`,
    `--allow-fs-write=${paths.dataDir}`,
    "--max-old-space-size=512",
    "--disable-warning=ExperimentalWarning",
  ];
  if (major >= 25) args.push("--allow-net");
  return args;
}

/** L'environnement de l'invité, reconstruit : `GUEST_ENV` + les variables déclarées que l'hôte connaît. */
export function guestEnv(
  pluginId: string,
  manifest: PluginRuntimeManifest,
  paths: Pick<GuestPaths, "dataDir" | "socket">,
  locale: string,
  hostEnv: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const name of [...PASSTHROUGH_ENV, ...(manifest.env ?? [])]) {
    const value = hostEnv[name];
    if (typeof value === "string" && value !== "") env[name] = value;
  }
  env[GUEST_ENV.pluginId] = pluginId;
  env[GUEST_ENV.dataDir] = paths.dataDir;
  env[GUEST_ENV.socket] = paths.socket;
  env[GUEST_ENV.locale] = locale;
  return env;
}

/**
 * Un lien dans le dossier de l'extension la ferait sortir de ses permissions :
 * Node les vérifie sur le CHEMIN, pas sur sa cible (un `data` lien vers le
 * dossier du serveur, un lien dur vers `tentacle.db`). La garde d'archive ne
 * voit pas les liens (pluginArchiveGuard.ts) : on les cherche ici, avant
 * chaque lancement. `data/` est sauté : aucune archive n'y pose rien
 * (pluginInstall.ts), et l'invité n'y crée pas de lien (refusé par Node et par
 * l'amorçage des ouvriers). Rend le premier trouvé, ou `null`.
 */
export function findLink(dir: string, skip: string | null = null, budget = { left: 20_000 }): string | null {
  for (const name of readdirSync(dir)) {
    if (--budget.left < 0) return `${dir} (trop de fichiers)`;
    const full = join(dir, name);
    const stat = lstatSync(full);
    if (stat.isSymbolicLink() || (stat.isFile() && stat.nlink > 1)) return full;
    if (stat.isDirectory() && full !== skip) {
      const inner = findLink(full, skip, budget);
      if (inner) return inner;
    }
  }
  return null;
}

export function launchGuest(pluginId: string, manifest: PluginRuntimeManifest, paths: GuestPaths, locale: string): ChildProcess {
  mkdirSync(paths.dataDir, { recursive: true });
  // Les chemins RÉELS : Node charge le module par son chemin réel (`/var` → `/private/var` sous macOS),
  // et ses permissions comparent des chemins, sans résoudre les liens.
  const real = { ...paths, pluginDir: realpathSync(paths.pluginDir), dataDir: realpathSync(paths.dataDir), entry: realpathSync(paths.entry) };
  const link = findLink(real.pluginDir, real.dataDir);
  if (link) throw new Error(`lien refusé dans le dossier de l'extension : ${link}`);
  removeSocket(paths.socket);
  return fork(real.entry, [], {
    cwd: real.dataDir,
    execArgv: guestExecArgv(real),
    env: guestEnv(pluginId, manifest, real, locale),
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    serialization: "json",
    windowsHide: true,
  });
}
