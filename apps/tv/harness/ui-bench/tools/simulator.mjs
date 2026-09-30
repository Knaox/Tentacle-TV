// Le simulateur du banc : un CLONE à soi du simulateur « Apple TV 4K (at
// 1080p) », pour ne jamais toucher ceux des autres sessions. L'app installée y
// est une build Debug : elle charge son code du relais, que désigne
// `RCT_jsLocation` dans les préférences de son conteneur.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const NAME = process.env.BENCH_SIM_NAME ?? "Banc UI TV (Claude)";
// « Apple TV 4K (3rd generation) (at 1080p) » : capture native en 1920×1080.
const TEMPLATE = process.env.BENCH_SIM_TEMPLATE ?? "C654C962-46A6-4A48-A28D-8C49A0E872DB";
const BUNDLE = "com.tentacle.mobile";
const DEVICES = path.join(os.homedir(), "Library/Developer/CoreSimulator/Devices");
const BUDDY = "/usr/libexec/PlistBuddy";

const simctl = (...args) => execFileSync("xcrun", ["simctl", ...args], { encoding: "utf8" });
const devices = () => Object.values(JSON.parse(simctl("list", "devices", "-j")).devices).flat();
const findBench = () => devices().find((device) => device.name === NAME);
const stateOf = (udid) => devices().find((device) => device.udid === udid)?.state;

function buddy(plist, command) {
  try {
    return execFileSync(BUDDY, ["-c", command, plist], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

/** Le conteneur de données de l'app, trouvé sur disque — sans démarrer le simulateur. */
function dataContainer(udid) {
  const root = path.join(DEVICES, udid, "data/Containers/Data/Application");
  if (!fs.existsSync(root)) return null;
  for (const dir of fs.readdirSync(root)) {
    const meta = path.join(root, dir, ".com.apple.mobile_container_manager.metadata.plist");
    if (fs.existsSync(meta) && buddy(meta, "Print :MCMMetadataIdentifier") === BUNDLE) return path.join(root, dir);
  }
  return null;
}

export function ensureSimulator(port, { quiet = false } = {}) {
  let device = findBench();
  if (!device) {
    const template = devices().find((d) => d.udid === TEMPLATE);
    if (!template) throw new Error(`simulateur modèle ${TEMPLATE} introuvable (BENCH_SIM_TEMPLATE)`);
    if (template.state !== "Shutdown") throw new Error(`« ${template.name} » doit être éteint pour être cloné — une autre session s'en sert ?`);
    console.log(`clonage de « ${template.name} » → « ${NAME} »`);
    simctl("clone", TEMPLATE, NAME);
    device = findBench();
  }
  const udid = device.udid;
  const container = dataContainer(udid);
  if (!container) throw new Error("l'app n'est pas installée sur le simulateur du banc");
  const plist = path.join(container, "Library/Preferences", `${BUNDLE}.plist`);
  const wanted = `localhost:${port}`;
  if (buddy(plist, "Print :RCT_jsLocation") !== wanted) {
    // Démarré, le cfprefsd du simulateur réécrit le plist depuis son cache au
    // lancement suivant : la clé disparaîtrait. On écrit simulateur éteint.
    if (stateOf(udid) !== "Shutdown") simctl("shutdown", udid);
    buddy(plist, "Delete :RCT_jsLocation");
    buddy(plist, `Add :RCT_jsLocation string ${wanted}`);
    // Hygiène : aucune session n'a rien à faire sur le simulateur du banc.
    for (const key of ["tentacle_token", "tentacle_user", "tentacle_server_url"]) buddy(plist, `Delete :${key}`);
  }
  if (stateOf(udid) !== "Booted") {
    simctl("boot", udid);
    // Seulement au démarrage : réactiver Simulator.app renvoie l'app de
    // l'appareil DÉJÀ affiché à l'accueil de tvOS (constaté le 2026-09-30).
    execFileSync("open", ["-a", "Simulator", "--args", "-CurrentDeviceUDID", udid]);
  }
  if (!quiet) console.log(`simulateur « ${NAME} » (${udid}) → relais ${wanted}`);
  return udid;
}

export function launchApp(udid) {
  simctl("launch", "--terminate-running-process", udid, BUNDLE);
  console.log("app du banc lancée");
}

/** Ramène l'app du banc au premier plan (sans la relancer si elle tourne). */
export function foreground() {
  const device = findBench();
  if (device?.state === "Booted") simctl("launch", device.udid, BUNDLE);
}

/** L'identifiant du simulateur du banc, démarré — sinon une erreur. */
export function bootedBench() {
  const device = findBench();
  if (!device || device.state !== "Booted") throw new Error("simulateur du banc éteint — « bench.mjs sim »");
  return device.udid;
}

export function screenshot(file) {
  execFileSync("xcrun", ["simctl", "io", bootedBench(), "screenshot", "--type=png", file], { stdio: "ignore" });
}
