// Provisoire — à retirer quand Android TV aura basculé sur la refonte (A5).
//
// L'app Android TV sur l'émulateur du lanceur : une build DEBUG (son
// JavaScript vient de Metro, à travers `adb reverse`), reconstruite seulement
// si elle n'y est pas ou si le NATIF a changé depuis son installation — la
// même empreinte que pour l'Apple TV (`nativeBuild.mjs`).
import fs from "node:fs";
import path from "node:path";
import {
  APP_DIR, LauncherError, REPO, STATE_DIR, loadState, minutes, note, runLogged, shortPath, step, updateState,
} from "./runtime.mjs";
import { dependencyVersions, fingerprintOf } from "./nativeBuild.mjs";
import { ADB, SDK, SERIAL, adb } from "./androidEmulator.mjs";
import { BACKEND_PORT } from "./services.mjs";

export const PACKAGE = "com.tentacletv.mobile";
const ACTIVITY = `${PACKAGE}/com.tentacletv.MainActivity`;
const ANDROID_DIR = path.join(APP_DIR, "android");
const APK = path.join(ANDROID_DIR, "app/build/outputs/apk/debug/app-debug.apk");
/** Le port où l'app debug cherche Metro (celui de l'appareil). */
const DEVICE_METRO_PORT = 8081;
const NATIVE_INPUTS = ["apps/tv/android", "apps/tv/package.json", "apps/tv/react-native.config.js", "apps/tv/app.json", "apps/tv/assets/fonts", "patches"];

const fingerprint = () => fingerprintOf(NATIVE_INPUTS, dependencyVersions());
const apkStamp = () => {
  try {
    return fs.statSync(APK).mtimeMs;
  } catch {
    return null;
  }
};
const installedPath = () => adb(["shell", "pm", "path", PACKAGE])?.trim() || null;

/** L'ABI de l'appareil : la build n'en compile qu'une (le natif de quatre ABI coûte quatre fois plus). */
const deviceAbi = () => adb(["shell", "getprop", "ro.product.cpu.abi"])?.trim() || "arm64-v8a";

async function gradleBuild() {
  const log = path.join(STATE_DIR, "gradle.log");
  const abi = deviceAbi();
  const start = Date.now();
  const heartbeat = setInterval(() => note(`build en cours… ${minutes(Date.now() - start)}`), 60_000);
  try {
    await runLogged("./gradlew", ["assembleDebug", "-x", "lint", `-PreactNativeArchitectures=${abi}`], { cwd: ANDROID_DIR, env: { ANDROID_HOME: SDK }, log });
  } catch {
    const lines = fs.readFileSync(log, "utf8").split("\n");
    const errors = lines.filter((line) => /error:|FAILURE|What went wrong/.test(line)).slice(-12);
    for (const line of errors.length ? errors : lines.slice(-12)) note(line.trim());
    throw new LauncherError(`build Gradle en échec — journal complet : ${shortPath(log)}`);
  } finally {
    clearInterval(heartbeat);
  }
  note(`build Gradle (${abi}) réussi en ${minutes(Date.now() - start)} — journal : ${shortPath(log)}`);
}

/** Installe l'APK ; une signature différente (build d'ailleurs) oblige à désinstaller d'abord. */
function install() {
  const out = adb(["install", "-r", "-d", APK], { timeout: 180_000 }) ?? "";
  if (/Success/.test(out)) return;
  note("installation refusée (signature d'une autre build ?) : désinstallation puis réinstallation");
  adb(["uninstall", PACKAGE]);
  if (!/Success/.test(adb(["install", APK], { timeout: 180_000 }) ?? "")) throw new LauncherError(`installation de ${shortPath(APK)} impossible sur ${SERIAL}`);
}

/** L'app debug à jour sur l'émulateur. */
export async function ensureAndroidApp({ force = false } = {}) {
  const current = fingerprint();
  const state = loadState();
  const installed = installedPath();
  if (!force && installed && state.androidApp?.fingerprint === current) {
    step("App Android", "à jour sur l'émulateur — pas de build");
    return;
  }
  const why = force ? "reconstruction demandée (--rebuild)"
    : !installed ? "pas encore installée sur l'émulateur"
      : "le natif a changé depuis son installation (ou elle a été installée hors du lanceur)";
  const built = state.androidBuilds?.[REPO];
  if (!force && built?.fingerprint === current && built.stamp === apkStamp()) {
    step("App Android", `${why} — le dernier build de ce dossier correspond : réinstallation seule`);
  } else {
    step("App Android", `${why} — build Gradle (debug ; plusieurs minutes la première fois)`);
    await gradleBuild();
    updateState((next) => {
      next.androidBuilds = { ...next.androidBuilds, [REPO]: { fingerprint: current, stamp: apkStamp() } };
    });
  }
  install();
  updateState((next) => { next.androidApp = { fingerprint: current }; });
  note("installée sur l'émulateur");
}

/** Metro et le backend de dev, vus de l'émulateur à leurs ports habituels. */
export function reversePorts(metroPort) {
  for (const [device, host] of [[DEVICE_METRO_PORT, metroPort], [BACKEND_PORT, BACKEND_PORT]]) {
    if (adb(["reverse", `tcp:${device}`, `tcp:${host}`]) === null) throw new LauncherError(`adb reverse tcp:${device} impossible (${ADB})`);
  }
  step("Ports", `émulateur → Mac : ${DEVICE_METRO_PORT} → Metro ${metroPort}, ${BACKEND_PORT} → backend`);
}

/** Relance l'app à froid : le bundle refondu est relu depuis Metro. */
export function launchApp() {
  adb(["shell", "am", "force-stop", PACKAGE]);
  if (adb(["shell", "am", "start", "-n", ACTIVITY]) === null) throw new LauncherError(`am start ${ACTIVITY} a échoué`);
}
