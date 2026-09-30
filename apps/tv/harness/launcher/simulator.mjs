// Provisoire — à retirer quand la refonte remplace l'UI TV (fusion dans main).
//
// Les simulateurs DÉDIÉS du lanceur : créés neufs (jamais clonés — un clone
// hérite de l'app, du compte et de l'identifiant d'appareil de son modèle), et
// jamais ceux des autres sessions.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { LauncherError, capture, sleep } from "./runtime.mjs";

export const REFONTE_SIM = "Tentacle TV — refonte";
export const BANC_SIM = "Tentacle TV — banc UI";
const BUNDLE = "com.tentacle.mobile";
// Du plus proche de l'écran de la refonte (1920×1080) au plus ancien.
const PREFERRED_TYPES = [
  "Apple-TV-4K-3rd-generation-1080p",
  "Apple-TV-4K-2nd-generation-1080p",
  "Apple-TV-4K-1080p",
  "Apple-TV-1080p",
];

function simctl(...args) {
  try {
    return execFileSync("xcrun", ["simctl", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    const reason = String(error.stderr || error.message).trim().split("\n")[0];
    throw new LauncherError(`xcrun simctl ${args[0]} a échoué : ${reason}`);
  }
}

export function findDevice(name) {
  const { devices } = JSON.parse(simctl("list", "devices", "-j"));
  return Object.values(devices).flat().find((device) => device.name === name) ?? null;
}

const version = (text) => text.split(".").map(Number);
function newer(a, b) {
  const [x, y] = [version(a.version), version(b.version)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
}

function newestTvRuntime() {
  const { runtimes } = JSON.parse(simctl("list", "runtimes", "-j"));
  const tv = runtimes.filter((runtime) => runtime.isAvailable && (runtime.platform === "tvOS" || runtime.identifier.includes("tvOS")));
  return tv.reduce((best, runtime) => (!best || newer(runtime, best) ? runtime : best), null);
}

/** Le simulateur dédié `name` : trouvé, sinon créé. */
export function ensureDevice(name) {
  const existing = findDevice(name);
  if (existing) return { device: existing, created: null };
  const runtime = newestTvRuntime();
  if (!runtime) throw new LauncherError("aucun runtime tvOS dans Xcode (Xcode › Settings › Components › tvOS)");
  const types = runtime.supportedDeviceTypes ?? [];
  const type = PREFERRED_TYPES.map((suffix) => types.find((t) => t.identifier.endsWith(suffix))).find(Boolean)
    ?? types.find((t) => t.productFamily === "Apple TV");
  if (!type) throw new LauncherError(`le runtime ${runtime.name} ne propose aucun modèle d'Apple TV`);
  simctl("create", name, type.identifier, runtime.identifier);
  return { device: findDevice(name), created: `${type.name}, ${runtime.name}` };
}

/** Démarre l'appareil s'il le faut et attend qu'il soit prêt. (Sa langue ne
 *  changerait rien : l'app ne déclare que l'anglais, tvOS lui donne donc une
 *  locale anglaise — elle se choisit sur l'accueil du jumelage.) */
export function boot(device) {
  if (device.state !== "Booted") simctl("bootstatus", device.udid, "-b");
}

/** Le paquet de l'app installé sur l'appareil (`null` s'il n'y est pas). */
export function installedApp(udid) {
  try {
    return simctl("get_app_container", udid, BUNDLE, "app").trim();
  } catch {
    return null;
  }
}

export function install(udid, appPath) {
  simctl("install", udid, appPath);
  return installedApp(udid);
}

/**
 * Simulator.app au premier plan, sur cet appareil. Réactiver Simulator.app
 * renvoie l'app affichée à l'accueil de tvOS (constaté par le banc le
 * 2026-09-30) : on le fait AVANT de lancer l'app, et on laisse passer ce retour.
 */
export async function bringToFront(udid) {
  execFileSync("open", ["-a", "Simulator", "--args", "-CurrentDeviceUDID", udid]);
  await sleep(2500);
}

/**
 * Retient dans les préférences du conteneur de l'app le Metro (ou le relais)
 * où prendre son code : l'app rouverte depuis l'accueil de tvOS y retourne.
 * Écrit par le `cfprefsd` du simulateur, démarré — jamais le fichier à la
 * main, qu'il réécrirait depuis son cache. Rien d'autre n'y est écrit : ni
 * session, ni jeton — le jumelage reste à l'utilisateur. Rend `false` si l'app
 * n'a pas encore de conteneur de données.
 */
export function pointAppAt(udid, port) {
  try {
    const data = simctl("get_app_container", udid, BUNDLE, "data").trim();
    simctl("spawn", udid, "defaults", "write", path.join(data, "Library/Preferences", BUNDLE), "RCT_jsLocation", "-string", `localhost:${port}`);
    return true;
  } catch {
    return false;
  }
}

/** Relance l'app sur le Metro voulu (retenu, et passé en argument pour ce lancement-ci). */
export function launchOnMetro(udid, metroPort) {
  try {
    simctl("terminate", udid, BUNDLE);
  } catch {
    // ne tournait pas
  }
  pointAppAt(udid, metroPort);
  simctl("launch", udid, BUNDLE, "-RCT_jsLocation", `localhost:${metroPort}`);
}

/** Éteint les simulateurs dédiés démarrés ; rend leurs noms. */
export function shutdownDedicated() {
  const stopped = [];
  for (const name of [REFONTE_SIM, BANC_SIM]) {
    const device = findDevice(name);
    if (device?.state !== "Booted") continue;
    simctl("shutdown", device.udid);
    stopped.push(name);
  }
  return stopped;
}

/** Plus aucun appareil démarré (d'aucune session) : Simulator.app se referme.
 *  Par un signal, pas par AppleScript — qui demanderait au terminal
 *  l'autorisation de « contrôler Simulator ». */
export function quitSimulatorIfIdle() {
  const { devices } = JSON.parse(simctl("list", "devices", "-j"));
  if (Object.values(devices).flat().some((device) => device.state === "Booted")) return false;
  const pid = Number(capture("pgrep", ["-x", "Simulator"])?.trim().split("\n")[0]);
  if (!pid) return false;
  try {
    process.kill(pid, "SIGTERM");
    return true;
  } catch {
    return false;
  }
}
