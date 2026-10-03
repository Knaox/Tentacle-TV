// Le simulateur de la session : le sien seulement (`nav-T<n>`, ou celui de
// `--sim`), démarré SANS rouvrir Simulator.app — la rouvrir renverrait les
// apps des autres sessions à l'accueil de tvOS. L'état de l'app y est remis à
// zéro avant chaque démarrage à froid : préférences, caches, session factice.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { BUNDLE_ID, BenchError, capture, note, sleep, step } from "./config.mjs";

// Le modèle des références : 1080p, l'écran de la refonte (1920 × 1080 points).
const DEVICE_TYPE = "com.apple.CoreSimulator.SimDeviceType.Apple-TV-4K-3rd-generation-1080p";

function simctl(...args) {
  try {
    return execFileSync("xcrun", ["simctl", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    const reason = String(error.stderr || error.message).trim().split("\n")[0];
    throw new BenchError(`xcrun simctl ${args[0]} a échoué : ${reason}`);
  }
}

export function findDevice(nameOrUdid) {
  const { devices } = JSON.parse(simctl("list", "devices", "-j"));
  for (const [runtime, list] of Object.entries(devices)) {
    const device = list.find((d) => d.udid === nameOrUdid || d.name === nameOrUdid);
    if (device) return { ...device, runtime };
  }
  return null;
}

function newestTvRuntime() {
  const { runtimes } = JSON.parse(simctl("list", "runtimes", "-j"));
  const tv = runtimes.filter((r) => r.isAvailable && r.identifier.includes("tvOS"));
  return tv.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))[0] ?? null;
}

/** Le simulateur de la session, créé neuf s'il n'existe pas, démarré. */
export function ensureSimulator(name) {
  let device = findDevice(name);
  if (!device) {
    const runtime = newestTvRuntime();
    if (!runtime) throw new BenchError("aucun runtime tvOS dans Xcode");
    simctl("create", name, DEVICE_TYPE, runtime.identifier);
    device = { ...findDevice(name), created: true };
    step("Simulateur", `« ${name} » créé neuf (Apple TV 4K 3e gén. 1080p, ${runtime.name})`);
  }
  if (device.state !== "Booted") {
    simctl("bootstatus", device.udid, "-b");
    device = { ...findDevice(device.udid), created: device.created };
    note(`« ${device.name} » démarré (sans Simulator.app)`);
  }
  return device;
}

/** Le modèle et le système du simulateur : écrits dans chaque référence. */
export function describeDevice(device) {
  return { kind: "simulateur", name: device.name, model: device.deviceTypeIdentifier?.split(".").pop() ?? "?", runtime: device.runtime.split(".").pop() };
}

const container = (udid, kind) => capture("xcrun", ["simctl", "get_app_container", udid, BUNDLE_ID, kind])?.trim() || null;

/** Installe l'app si celle du simulateur ne vient pas de ce binaire (`stamp` : son empreinte). */
export function ensureInstalled(device, app, stamp, state) {
  const installed = container(device.udid, "app");
  if (installed && state.installed?.[device.udid] === stamp) return false;
  simctl("install", device.udid, app);
  state.installed = { ...state.installed, [device.udid]: stamp };
  note(`app installée sur « ${device.name} » (${stamp})`);
  return true;
}

export function terminateApp(udid) {
  capture("xcrun", ["simctl", "terminate", udid, BUNDLE_ID]);
}

/**
 * L'app remise à zéro, arrêtée : ses préférences effacées (par le cfprefsd du
 * simulateur, jamais le fichier à la main), ses caches et fichiers vidés, puis
 * la session du banc posée — le faux backend, un jeton bidon, le compte de test
 * en NOM seulement. `storage` : des clés en plus, propres au scénario.
 */
export function resetAppState(device, { metroPort, backendPort, session, storage = {} }) {
  terminateApp(device.udid);
  const data = container(device.udid, "data");
  if (!data) throw new BenchError(`l'app n'a pas de conteneur sur « ${device.name} » : installation ratée ?`);
  const domain = path.join(data, "Library/Preferences", BUNDLE_ID);
  capture("xcrun", ["simctl", "spawn", device.udid, "defaults", "delete", domain]);
  for (const dir of ["Library/Application Support", "Library/Caches", "Documents", "tmp"]) {
    const full = path.join(data, dir);
    for (const entry of fs.existsSync(full) ? fs.readdirSync(full) : []) fs.rmSync(path.join(full, entry), { recursive: true, force: true });
  }
  // Le repli HORS conteneur, que l'app relit quand sa clé manque : jamais de reste d'ailleurs.
  const outside = path.join(path.dirname(path.dirname(path.dirname(path.dirname(data)))), "Library/Preferences", `${BUNDLE_ID}.plist`);
  if (fs.existsSync(outside)) capture("xcrun", ["simctl", "spawn", device.udid, "defaults", "delete", BUNDLE_ID]);
  const keys = { RCT_jsLocation: `localhost:${metroPort}`, ...sessionKeys(session, backendPort), ...storage };
  for (const [key, value] of Object.entries(keys)) {
    capture("xcrun", ["simctl", "spawn", device.udid, "defaults", "write", domain, key, "-string", String(value)]);
  }
  return keys;
}

/** La session factice : `paired` (jumelée au faux backend) ou `none` (écran de jumelage). */
function sessionKeys(session, backendPort) {
  if (session === "none") return { tentacle_language: "fr" };
  return {
    tentacle_server_url: `http://localhost:${backendPort}`,
    tentacle_token: "banc",
    tentacle_user: JSON.stringify({ Id: "banc-user", Name: "Knaoxtest" }),
    tentacle_language: "fr",
  };
}

/** Lance l'app (sur le Metro des préférences, et en argument pour ce lancement). */
export async function launchApp(device, metroPort) {
  simctl("launch", device.udid, BUNDLE_ID, "-RCT_jsLocation", `localhost:${metroPort}`);
  await sleep(300);
}
