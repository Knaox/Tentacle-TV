// La PRESSION MÉMOIRE du banc Lite, sur un appareil adb (émulateur Lite, ou
// l'app de mesure d'une vraie box) :
//
// - `trim` : `am send-trim-memory` — le signal qu'Android envoie à une app
//   quand la mémoire baisse (`onTrimMemory`), sans rien tuer ;
// - `hog` : de la mémoire native prise par un processus du shell (`Hog.java`),
//   qui pousse le lowmemorykiller sur les apps ;
// - `apps` : les applications Leanback de l'image lancées l'une après l'autre
//   (elles restent en cache), puis l'app mesurée ramenée au premier plan.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SDK = process.env.ANDROID_HOME ?? path.join(os.homedir(), "Library/Android/sdk");
const ADB = path.join(SDK, "platform-tools/adb");
export const HOG_DEX = "/data/local/tmp/perf-hog.dex";

/** Les niveaux d'`am send-trim-memory`, du plus doux au plus dur. */
export const TRIM_LEVELS = ["RUNNING_MODERATE", "RUNNING_LOW", "RUNNING_CRITICAL", "UI_HIDDEN", "BACKGROUND", "MODERATE", "COMPLETE"];

export function trimMemory(serial, pkg, level) {
  if (!TRIM_LEVELS.includes(level)) throw new Error(`niveau inconnu : ${level} (${TRIM_LEVELS.join(", ")})`);
  const out = execFileSync(ADB, ["-s", serial, "shell", `am send-trim-memory ${pkg} ${level}`], { encoding: "utf8" });
  // `am` ne sort pas en erreur : il l'ÉCRIT (processus absent, app non débogable…).
  if (/error|exception|unknown|not/i.test(out)) throw new Error(`send-trim-memory ${level} : ${out.trim()}`);
  return out.trim();
}

/** `Hog.java` compilé (javac + d8 du SDK) et poussé sur l'appareil. */
export function pushHog(serial, cacheDir, source) {
  const out = path.join(cacheDir, "hog");
  const dex = path.join(out, "classes.dex");
  if (!fs.existsSync(dex) || fs.statSync(dex).mtimeMs < fs.statSync(source).mtimeMs) {
    fs.mkdirSync(out, { recursive: true });
    const platforms = fs.readdirSync(path.join(SDK, "platforms")).sort();
    const jar = path.join(SDK, "platforms", platforms[platforms.length - 1], "android.jar");
    const tools = fs.readdirSync(path.join(SDK, "build-tools")).sort();
    execFileSync("javac", ["-source", "1.8", "-target", "1.8", "-cp", jar, "-d", out, source], { stdio: "ignore" });
    execFileSync(path.join(SDK, "build-tools", tools[tools.length - 1], "d8"), ["--output", out, "--lib", jar, path.join(out, "Hog.class")]);
  }
  execFileSync(ADB, ["-s", serial, "push", dex, HOG_DEX], { stdio: "ignore" });
}

/** Un mangeur de `megabytes` Mo pendant `seconds` s, en arrière-plan ; rend `stop()`. */
export function startHog(serial, megabytes, seconds, stepMs = 0) {
  const child = spawn(ADB, ["-s", serial, "shell", `CLASSPATH=${HOG_DEX} exec app_process /system/bin Hog ${megabytes} ${seconds} ${stepMs}`], { stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));
  const done = new Promise((resolve) => child.on("exit", () => resolve(output.trim())));
  return {
    done,
    stop() {
      // Le processus de l'appareil, par son nom de classe : seul Hog la porte.
      execFileSync(ADB, ["-s", serial, "shell", "pkill -f 'app_process /system/bin Hog' || true"], { stdio: "ignore" });
      child.kill();
      return done;
    },
  };
}

/** Les applications Leanback de l'image, sauf l'app mesurée. */
export function leanbackApps(serial, except) {
  const out = execFileSync(ADB, ["-s", serial, "shell", "cmd package query-activities --brief -a android.intent.action.MAIN -c android.intent.category.LEANBACK_LAUNCHER"], { encoding: "utf8" });
  return [...new Set(out.split("\n").map((line) => line.trim()).filter((line) => /^[\w.]+\/[\w.$]+$/.test(line)))]
    .filter((component) => !component.startsWith(`${except}/`));
}

/** Lance chaque app Leanback (`dwellMs` chacune), puis ramène `activity` au premier plan. */
export async function launchHeavyApps(serial, activity, { dwellMs = 4000, limit = 8 } = {}) {
  const pkg = activity.split("/")[0];
  const apps = leanbackApps(serial, pkg).slice(0, limit);
  for (const component of apps) {
    execFileSync(ADB, ["-s", serial, "shell", `am start -n ${component}`], { stdio: "ignore" });
    await new Promise((resolve) => setTimeout(resolve, dwellMs));
  }
  execFileSync(ADB, ["-s", serial, "shell", `am start -n ${activity}`], { stdio: "ignore" });
  return apps;
}
