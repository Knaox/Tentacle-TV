// Les AVD du banc Lite : des Android TV CONTRAINTES (1 Go et 2 Go, peu de
// cœurs, `ro.config.low_ram`), à l'image d'une box faible (net+ UZX4020NPS :
// BCM7271, 4 × Cortex-A53, 2 Go). Seuls les AVD nommés `Lite_*` se créent,
// se modifient ou s'arrêtent ici : ceux des autres sessions (TentacleTV_*,
// téléphones) ne se touchent jamais.
//
// Images : sur un Mac Apple Silicon, seules les images ARM tournent
// (accélérées par l'hyperviseur). Android TV ARM n'existe qu'en API 31 et 34
// (28, 29 et 30 ne sont publiées qu'en x86) : l'API 31 (Android 12) est la
// plus proche des box Android TV 9 à 11.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SDK = process.env.ANDROID_HOME ?? path.join(os.homedir(), "Library/Android/sdk");
const AVD_HOME = process.env.ANDROID_AVD_HOME ?? path.join(os.homedir(), ".android/avd");
const AVDMANAGER = path.join(SDK, "cmdline-tools/latest/bin/avdmanager");
const EMULATOR = path.join(SDK, "emulator/emulator");
const ADB = path.join(SDK, "platform-tools/adb");
export const IMAGE = "system-images;android-31;android-tv;arm64-v8a";

/**
 * Les profils : `ramMb`, la RAM de l'appareil ; `cores`, ses vCPU ; `port`,
 * la console (serial `emulator-<port>`, hors des places des autres sessions).
 *
 * Ce que l'émulateur NE PEUT PAS imiter (mesuré le 07/10) : `ro.config.low_ram`.
 * `-prop` n'accepte que les propriétés `qemu.*`, et l'image Android TV de
 * Google est une build `user` (ni root, ni `debug.force_low_ram`) :
 * `ActivityManager.isLowRamDevice()` y reste FAUX, et le tas d'une app est
 * celui de la build (`heapgrowthlimit` 192m, `heapsize` 512m). La faible RAM
 * se voit par `/proc/meminfo` (`getTotalMem`) ; le drapeau lui-même se
 * simule dans l'app de mesure, ou se prouve sur un vrai appareil.
 */
export const LITE_AVDS = {
  Lite_API31_1G: { ramMb: 1024, cores: 2, port: 5640, label: "Android TV 1 Go (plancher Google), 2 cœurs" },
  Lite_API31_2G: { ramMb: 2048, cores: 4, port: 5642, label: "box net+ : 2 Go, 4 cœurs" },
  // L'AVD de la tâche L4 (lecture) : le même profil que la box, sa propre
  // console — deux tâches mesurent en même temps sans se partager un appareil.
  Lite_L4_2G: { ramMb: 2048, cores: 4, port: 5646, label: "box net+ : 2 Go, 4 cœurs (L4, lecture)" },
  // L'AVD de la tâche L5a (effets) : même profil, sa propre console.
  Lite_L5a_2G: { ramMb: 2048, cores: 4, port: 5682, label: "box net+ : 2 Go, 4 cœurs (L5a, effets)" },
};

export function liteProfile(name) {
  const profile = LITE_AVDS[name];
  if (!profile) throw new Error(`AVD inconnu du banc Lite : ${name} (connus : ${Object.keys(LITE_AVDS).join(", ")})`);
  return profile;
}

/** Le serial adb d'un AVD du banc (console fixe, par profil). */
export const serialOf = (name) => `emulator-${liteProfile(name).port}`;

/** Les clés de `config.ini` que le banc fixe ; le reste vient du profil `tv_1080p`. */
export function configOverrides(profile) {
  return {
    "hw.ramSize": String(profile.ramMb),
    "hw.cpu.ncore": String(profile.cores),
    "hw.gpu.enabled": "yes",
    "hw.gpu.mode": "host",
    "hw.keyboard": "no",
    "hw.lcd.density": "320",
    "hw.dPad": "yes",
    "disk.dataPartition.size": "6G",
    "PlayStore.enabled": "no",
    "showDeviceFrame": "no",
  };
}

/** Réécrit les clés données d'un `config.ini` (texte), en gardant les autres. */
export function patchConfig(text, overrides) {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  const seen = new Set();
  const out = lines.map((line) => {
    const key = line.split("=")[0].trim();
    if (!(key in overrides)) return line;
    seen.add(key);
    return `${key}=${overrides[key]}`;
  });
  for (const [key, value] of Object.entries(overrides)) if (!seen.has(key)) out.push(`${key}=${value}`);
  return `${out.join("\n")}\n`;
}

export function createAvd(name, { force = false } = {}) {
  const profile = liteProfile(name);
  const dir = path.join(AVD_HOME, `${name}.avd`);
  if (fs.existsSync(dir) && !force) {
    console.log(`${name} existe déjà — config réalignée`);
  } else {
    execFileSync(AVDMANAGER, ["create", "avd", "-n", name, "-k", IMAGE, "-d", "tv_1080p", ...(force ? ["--force"] : [])], { input: "no\n", stdio: ["pipe", "inherit", "inherit"] });
  }
  const config = path.join(dir, "config.ini");
  fs.writeFileSync(config, patchConfig(fs.readFileSync(config, "utf8"), configOverrides(profile)));
  console.log(`${name} : ${profile.label} — ${config}`);
}

/** L'émulateur d'un AVD Lite, en arrière-plan ; rend son PID quand Android a fini de démarrer. */
export async function startAvd(name, { window = false, log = path.join(os.tmpdir(), `${name}.log`) } = {}) {
  const profile = liteProfile(name);
  const serial = serialOf(name);
  const args = [
    "-avd", name, "-port", String(profile.port), "-no-snapshot", "-no-audio", "-no-boot-anim",
    "-gpu", "host", "-memory", String(profile.ramMb), "-cores", String(profile.cores),
    ...(window ? [] : ["-no-window"]),
  ];
  const out = fs.openSync(log, "w");
  const child = spawn(EMULATOR, args, { detached: true, stdio: ["ignore", out, out] });
  child.unref();
  // Sous une forte charge du Mac (> 80), un démarrage à froid prend 8 min.
  const deadline = Date.now() + 600_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    try {
      const booted = execFileSync(ADB, ["-s", serial, "shell", "getprop sys.boot_completed"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      if (booted === "1") return { pid: child.pid, serial, log };
    } catch {
      // pas encore en ligne
    }
    if (/hvf is not enabled|FATAL|Segmentation fault/.test(fs.readFileSync(log, "utf8"))) break;
  }
  throw new Error(`${name} n'a pas démarré en 10 min — journal : ${log}`);
}

/** Arrête l'émulateur d'un AVD Lite par SA console (jamais un pkill). */
export function stopAvd(name) {
  execFileSync(ADB, ["-s", serialOf(name), "emu", "kill"], { stdio: "ignore" });
}

/** Ce que l'appareil émulé dit de lui : RAM, cœurs, faible RAM, tas. */
export function checkAvd(name) {
  const serial = serialOf(name);
  const shell = (command) => execFileSync(ADB, ["-s", serial, "shell", command], { encoding: "utf8" }).trim();
  const memTotalKb = Number(shell("grep MemTotal /proc/meminfo").match(/(\d+)/)?.[1] ?? 0);
  return {
    serial,
    memTotalMb: Math.round(memTotalKb / 1024),
    cores: Number(shell("nproc")),
    heapsize: shell("getprop dalvik.vm.heapsize"),
    heapgrowthlimit: shell("getprop dalvik.vm.heapgrowthlimit"),
    buildType: shell("getprop ro.build.type"),
    // `isLowRamDevice()` ne lit que `ro.config.low_ram` (et, sur une build
    // debuggable, `debug.force_low_ram`).
    lowRamDevice: shell("getprop ro.config.low_ram") === "true",
  };
}
