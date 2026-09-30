// Provisoire — à retirer quand la refonte remplace l'UI TV (fusion dans main).
//
// L'app native sur un simulateur dédié : reconstruite seulement si elle n'y
// est pas, ou si le NATIF a changé depuis son installation — une empreinte de
// tout ce qui entre dans le binaire. Le JavaScript, lui, vient de Metro : le
// modifier ne demande jamais de build.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  APP_DIR, LauncherError, REPO, STATE_DIR, capture, loadState, minutes, note, runLogged, shortPath, step, updateState,
} from "./runtime.mjs";
import { podInstall } from "./pods.mjs";
import { install, installedApp } from "./simulator.mjs";

const IOS_DIR = path.join(APP_DIR, "ios");
// Le dossier de `react-native run-ios` (pnpm --filter @tentacle-tv/tv ios) :
// les deux chemins profitent des builds incrémentaux l'un de l'autre.
const DERIVED_DATA = path.join(IOS_DIR, "build");
const PRODUCT = path.join(DERIVED_DATA, "Build/Products/Debug-appletvsimulator/TentacleTV.app");
// Ce qui entre dans le binaire : le projet natif, les dépendances et leurs
// correctifs, les polices embarquées.
const NATIVE_INPUTS = ["apps/tv/ios", "apps/tv/package.json", "apps/tv/react-native.config.js", "apps/tv/app.json", "apps/tv/assets/fonts", "patches"];
// Ce dont dépend le projet Pods. `pod install` le régénère en entier, et Xcode
// recompile alors tout (7 min au lieu d'une) : on ne le relance que s'il a changé.
const POD_INPUTS = ["apps/tv/ios/Podfile", "apps/tv/ios/Podfile.lock", "apps/tv/package.json", "apps/tv/react-native.config.js", "patches"];

function installedVersion(name) {
  for (const dir of [APP_DIR, REPO]) {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, "node_modules", name, "package.json"), "utf8")).version;
    } catch {
      // pas dans ce node_modules
    }
  }
  return "absent";
}

/** Les versions INSTALLÉES des dépendances de l'app (hors paquets du dépôt). */
function dependencyVersions() {
  const { dependencies = {} } = JSON.parse(fs.readFileSync(path.join(APP_DIR, "package.json"), "utf8"));
  return Object.keys(dependencies).sort()
    .filter((name) => !String(dependencies[name]).startsWith("workspace:"))
    .map((name) => `${name}@${installedVersion(name)}`);
}

/** Empreinte des fichiers suivis (ou nouveaux) sous `inputs`, plus `extras`. */
function fingerprintOf(inputs, extras) {
  const hash = crypto.createHash("sha256");
  const listed = capture("git", ["-C", REPO, "ls-files", "-z", "-co", "--exclude-standard", "--", ...inputs]) ?? "";
  for (const file of listed.split("\0").filter(Boolean).sort()) {
    const full = path.join(REPO, file);
    if (fs.existsSync(full)) hash.update(`${file}\0`).update(fs.readFileSync(full)).update("\0");
  }
  for (const extra of extras) hash.update(`${extra}\0`);
  return hash.digest("hex").slice(0, 16);
}

/** L'empreinte du natif : ses fichiers, les dépendances installées, Xcode. */
export const nativeFingerprint = () => fingerprintOf(NATIVE_INPUTS, [...dependencyVersions(), capture("xcodebuild", ["-version"]) ?? ""]);
const podsFingerprint = () => fingerprintOf(POD_INPUTS, dependencyVersions());

/** Les Pods de ce dossier correspondent-ils à leurs entrées actuelles ? */
function podsUpToDate() {
  try {
    const manifest = fs.readFileSync(path.join(IOS_DIR, "Pods/Manifest.lock"), "utf8");
    if (manifest !== fs.readFileSync(path.join(IOS_DIR, "Podfile.lock"), "utf8")) return false;
  } catch {
    return false;
  }
  return loadState().pods?.[REPO] === podsFingerprint();
}

const productStamp = () => {
  try {
    return fs.statSync(path.join(PRODUCT, "Info.plist")).mtimeMs;
  } catch {
    return null;
  }
};

async function xcodebuild(udid) {
  const log = path.join(STATE_DIR, "build.log");
  const args = [
    "-workspace", "TentacleTV.xcworkspace", "-scheme", "TentacleTV", "-configuration", "Debug",
    "-sdk", "appletvsimulator", "-destination", `platform=tvOS Simulator,id=${udid}`,
    "-derivedDataPath", DERIVED_DATA, "COMPILER_INDEX_STORE_ENABLE=NO", "build",
  ];
  const start = Date.now();
  const heartbeat = setInterval(() => note(`build en cours… ${minutes(Date.now() - start)}`), 60_000);
  try {
    await runLogged("xcodebuild", args, { cwd: IOS_DIR, env: { LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8" }, log });
  } catch {
    const lines = fs.readFileSync(log, "utf8").split("\n");
    const errors = lines.filter((line) => /error:|\*\* BUILD FAILED/.test(line)).slice(-12);
    for (const line of errors.length ? errors : lines.slice(-12)) note(line.trim());
    throw new LauncherError(`build Xcode en échec — journal complet : ${shortPath(log)}`);
  } finally {
    clearInterval(heartbeat);
  }
  note(`build Xcode réussi en ${minutes(Date.now() - start)} — journal : ${shortPath(log)}`);
}

/**
 * L'app à jour sur l'appareil `udid` (démarré). Rien à faire si l'app
 * installée vient d'un build de ce natif ; sinon réinstaller le dernier build
 * de ce dossier s'il correspond, sinon build Xcode — précédé de `pod install`
 * si les Pods ne correspondent plus (ou sur `--rebuild`).
 */
export async function ensureApp(udid, { force = false } = {}) {
  const fingerprint = nativeFingerprint();
  const state = loadState();
  const installed = installedApp(udid);
  const record = state.apps?.[udid];
  if (!force && installed && record?.fingerprint === fingerprint && record.appPath === installed) {
    step("App native", "à jour sur ce simulateur — pas de build");
    return;
  }
  const why = force ? "reconstruction demandée (--rebuild)"
    : !installed ? "pas encore installée sur ce simulateur"
      : "le natif a changé depuis son installation (ou elle a été installée hors du lanceur)";
  const built = state.builds?.[REPO];
  if (!force && built?.fingerprint === fingerprint && built.stamp === productStamp()) {
    step("App native", `${why} — le dernier build de ce dossier correspond : réinstallation seule`);
  } else {
    step("App native", `${why} — build Xcode (Debug, simulateur ; environ 8 min la première fois, moins d'une ensuite)`);
    if (force || !podsUpToDate()) {
      await podInstall(IOS_DIR);
      updateState((next) => {
        next.pods = { ...next.pods, [REPO]: podsFingerprint() };
      });
    } else {
      note("Pods à jour — pas de pod install");
    }
    // `pod install` a pu retoucher des fichiers d'entrée : l'empreinte du build est celle d'après.
    const builtFingerprint = nativeFingerprint();
    await xcodebuild(udid);
    updateState((next) => {
      next.builds = { ...next.builds, [REPO]: { fingerprint: builtFingerprint, stamp: productStamp() } };
    });
  }
  const appPath = install(udid, PRODUCT);
  updateState((next) => {
    next.apps = { ...next.apps, [udid]: { fingerprint: nativeFingerprint(), appPath } };
  });
  note("installée sur le simulateur");
}
