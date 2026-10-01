// Le simulateur de la vitrine : une Apple TV 4K À SOI (captures natives en
// 3840×2160), créée neuve, jamais celle d'une autre session ni celles de
// l'utilisateur. Démarrée par `simctl boot` sans rouvrir Simulator.app : les
// captures `simctl io` marchent sans fenêtre, et réactiver Simulator.app
// renverrait les apps des autres sessions à l'accueil de tvOS.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BENCH, HOME } from "./paths.mjs";

const BUNDLE = "com.tentacle.mobile";
const DEVICE_TYPE = "com.apple.CoreSimulator.SimDeviceType.Apple-TV-4K-3rd-generation-4K";
const DEVICES = path.join(os.homedir(), "Library/Developer/CoreSimulator/Devices");
const BUDDY = "/usr/libexec/PlistBuddy";
// La build Debug installée : copiée d'un simulateur qui a une app récente
// (Inter, verre natif), ou désignée par VITRINE_APP.
const APP_COPY = path.join(HOME, "app/TentacleTV.app");

const simctl = (...args) => execFileSync("xcrun", ["simctl", ...args], { encoding: "utf8" });
const devices = () => Object.values(JSON.parse(simctl("list", "devices", "-j")).devices).flat();
export const findDevice = () => devices().find((device) => device.name === BENCH.simName);

function buddy(plist, command) {
  try {
    return execFileSync(BUDDY, ["-c", command, plist], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function newestRuntime() {
  const runtimes = JSON.parse(simctl("list", "runtimes", "-j")).runtimes.filter((rt) => rt.platform === "tvOS" && rt.isAvailable);
  if (!runtimes.length) throw new Error("aucun runtime tvOS installé dans Xcode");
  return runtimes.sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true })).at(-1).identifier;
}

function dataContainer(udid) {
  const root = path.join(DEVICES, udid, "data/Containers/Data/Application");
  if (!fs.existsSync(root)) return null;
  for (const dir of fs.readdirSync(root)) {
    const meta = path.join(root, dir, ".com.apple.mobile_container_manager.metadata.plist");
    if (fs.existsSync(meta) && buddy(meta, "Print :MCMMetadataIdentifier") === BUNDLE) return path.join(root, dir);
  }
  return null;
}

function appSource() {
  if (process.env.VITRINE_APP) return process.env.VITRINE_APP;
  if (fs.existsSync(APP_COPY)) return APP_COPY;
  throw new Error(`aucune app TV à installer : copier une build Debug récente dans ${APP_COPY} (ou VITRINE_APP=…)`);
}

const stateOf = (udid) => devices().find((device) => device.udid === udid)?.state;

function boot(udid) {
  if (stateOf(udid) !== "Booted") simctl("boot", udid);
  simctl("bootstatus", udid, "-b");
}

/** Le simulateur de la vitrine, créé s'il le faut, l'app installée, branché
 *  sur le relais de la vitrine, démarré. Rend son identifiant. */
export function ensureSimulator() {
  let device = findDevice();
  if (!device) {
    console.log(`création du simulateur « ${BENCH.simName} » (Apple TV 4K)`);
    simctl("create", BENCH.simName, DEVICE_TYPE, newestRuntime());
    device = findDevice();
  }
  const udid = device.udid;
  if (!dataContainer(udid)) {
    boot(udid);
    simctl("install", udid, appSource());
    console.log("app installée");
  }
  const container = dataContainer(udid);
  const plist = path.join(container, "Library/Preferences", `${BUNDLE}.plist`);
  const wanted = `localhost:${BENCH.relayPort}`;
  if (buddy(plist, "Print :RCT_jsLocation") !== wanted) {
    // Démarré, le cfprefsd du simulateur réécrirait le plist : on l'écrit éteint.
    if (stateOf(udid) !== "Shutdown") simctl("shutdown", udid);
    fs.mkdirSync(path.dirname(plist), { recursive: true });
    buddy(plist, "Delete :RCT_jsLocation");
    buddy(plist, `Add :RCT_jsLocation string ${wanted}`);
  }
  boot(udid);
  return udid;
}

export function launchApp(udid) {
  simctl("launch", "--terminate-running-process", udid, BUNDLE);
}

/** Ramène l'app au premier plan sans la relancer. */
export function foreground(udid) {
  simctl("launch", udid, BUNDLE);
}

export function screenshot(udid, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  execFileSync("xcrun", ["simctl", "io", udid, "screenshot", "--type=png", file], { stdio: "ignore" });
}

export function shutdown() {
  const device = findDevice();
  if (device && device.state !== "Shutdown") simctl("shutdown", device.udid);
}
