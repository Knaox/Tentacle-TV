// Provisoire — à retirer quand Android TV aura basculé sur la refonte (A5).
//
// L'émulateur Android TV du lanceur : l'AVD « TentacleTV_Shield_API31 » (au
// plus près de la NVIDIA Shield : 1080p, densité 320, 3 Go — l'image arm64 la
// plus proche d'Android 11 est Android TV 12, API 31 ; l'API 30 n'existe
// qu'en x86), créé au besoin, démarré sous VERROU : un seul émulateur à la fois
// sur la machine, que les sessions de travail se partagent
// (`<Projet - local>/.claude/locks/android-emulator`, un fichier `owner`
// dedans). Arrêt par PID seulement — jamais de motif large.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  LauncherError, REPO, STATE_DIR, capture, isAlive, loadState, note, runLogged, shortPath, sleep, spawnDetached, step,
  stopProcess, updateState, waitFor, warn,
} from "./runtime.mjs";

export const SDK = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? path.join(os.homedir(), "Library/Android/sdk");
export const ADB = path.join(SDK, "platform-tools/adb");
const EMULATOR = path.join(SDK, "emulator/emulator");
const CMDLINE = path.join(SDK, "cmdline-tools/latest/bin");
export const AVD_NAME = "TentacleTV_Shield_API31";
const IMAGE = "system-images;android-31;android-tv;arm64-v8a";
const IMAGE_DIR = path.join(SDK, "system-images/android-31/android-tv/arm64-v8a");
/** Port de console fixe : l'appareil s'appelle toujours ainsi pour adb. */
const CONSOLE_PORT = 5584;
export const SERIAL = `emulator-${CONSOLE_PORT}`;
/** Le nom inscrit au verrou ; une session de travail y met le sien
 *  (`TENTACLE_EMULATOR_OWNER`), et le lanceur reconnaît alors son verrou. */
const OWNER = process.env.TENTACLE_EMULATOR_OWNER ?? "pnpm tv:refonte:android (lanceur)";

export const adb = (args, options) => capture(ADB, ["-s", SERIAL, ...args], options);

export function requireAndroidSdk() {
  for (const [tool, label] of [[ADB, "platform-tools (adb)"], [EMULATOR, "emulator"], [path.join(CMDLINE, "sdkmanager"), "cmdline-tools"]]) {
    if (!fs.existsSync(tool)) throw new LauncherError(`SDK Android incomplet : ${label} absent de ${SDK} (ANDROID_HOME)`);
  }
}

// ─── Verrou ──────────────────────────────────────────────────────────────────

/** `<…>/.claude/locks` le plus proche au-dessus du dépôt (worktree compris), sinon l'état du lanceur. */
function locksDir() {
  for (let dir = path.dirname(REPO); dir !== path.dirname(dir); dir = path.dirname(dir)) {
    const candidate = path.join(dir, ".claude/locks");
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join(STATE_DIR, "locks");
}

export const LOCK_DIR = path.join(locksDir(), "android-emulator");
const lockOwner = () => {
  try {
    return fs.readFileSync(path.join(LOCK_DIR, "owner"), "utf8").trim();
  } catch {
    return null;
  }
};
const lockIsOurs = () => lockOwner()?.startsWith(OWNER) ?? false;

function acquireLock() {
  if (lockIsOurs()) return;
  try {
    fs.mkdirSync(path.dirname(LOCK_DIR), { recursive: true });
    fs.mkdirSync(LOCK_DIR);
  } catch {
    throw new LauncherError(`l'émulateur Android est pris (${lockOwner() ?? "verrou sans propriétaire"}) — ${shortPath(LOCK_DIR)} ; réessayez plus tard`);
  }
  fs.writeFileSync(path.join(LOCK_DIR, "owner"), `${OWNER} — ${REPO} — ${new Date().toISOString()}\n`);
}

export function releaseLock() {
  if (lockIsOurs()) fs.rmSync(LOCK_DIR, { recursive: true, force: true });
}

// ─── AVD ─────────────────────────────────────────────────────────────────────

const avds = () => (capture(EMULATOR, ["-list-avds"]) ?? "").split("\n").map((line) => line.trim()).filter(Boolean);

/** Une commande du SDK qui pose des questions : « y » aux licences, « no » au profil matériel. */
function answered(tool, args, answer, log) {
  return runLogged("/bin/sh", ["-c", `yes ${answer} | "${path.join(CMDLINE, tool)}" ${args.map((a) => `"${a}"`).join(" ")}`], { log });
}

async function ensureAvd() {
  if (avds().includes(AVD_NAME)) return false;
  if (!fs.existsSync(IMAGE_DIR)) {
    note(`image système absente : téléchargement de ${IMAGE} (≈ 1 Go)…`);
    await answered("sdkmanager", [IMAGE], "y", path.join(STATE_DIR, "sdkmanager.log"));
  }
  await answered("avdmanager", ["create", "avd", "-n", AVD_NAME, "-k", IMAGE, "-d", "tv_1080p"], "no", path.join(STATE_DIR, "avdmanager.log"));
  const config = path.join(os.homedir(), ".android/avd", `${AVD_NAME}.avd`, "config.ini");
  const lines = fs.readFileSync(config, "utf8").split("\n").filter((line) => !/^(hw\.ramSize|hw\.lcd\.density|disk\.dataPartition\.size)\s*=/.test(line));
  fs.writeFileSync(config, [...lines.filter(Boolean), "hw.ramSize=3072", "hw.lcd.density=320", "disk.dataPartition.size=6G", ""].join("\n"));
  return true;
}

// ─── Émulateur ───────────────────────────────────────────────────────────────

const booted = () => adb(["shell", "getprop", "sys.boot_completed"])?.trim() === "1";

/** Un rapport de plantage en attente bloque le démarrage sur un dialogue invisible : on le met de côté. */
function setAsideCrashReports() {
  const tmp = path.join("/tmp", `android-${os.userInfo().username}`);
  const reports = fs.existsSync(tmp) ? fs.readdirSync(tmp).filter((name) => /^emu-crash-.*\.db$/.test(name)) : [];
  if (!reports.length) return;
  const aside = path.join(STATE_DIR, "emu-crash");
  fs.mkdirSync(aside, { recursive: true });
  for (const name of reports) fs.renameSync(path.join(tmp, name), path.join(aside, name));
  note(`${reports.length} rapport(s) de plantage d'un émulateur précédent mis de côté (${shortPath(aside)})`);
}

/** L'émulateur du lanceur, démarré et prêt ; rend son enregistrement. */
export async function ensureEmulator() {
  const mine = loadState().emulator;
  if (isAlive(mine) && booted()) {
    step("Émulateur", `« ${AVD_NAME} » déjà démarré (${SERIAL}, lancé par le lanceur) — réutilisé`);
    return mine;
  }
  if (booted()) throw new LauncherError(`${SERIAL} tourne déjà, lancé hors du lanceur : il ne nous appartient pas`);
  acquireLock();
  try {
    if (await ensureAvd()) note(`AVD « ${AVD_NAME} » créé (Android TV 12 arm64, 1080p, densité 320, 3 Go)`);
    setAsideCrashReports();
    const args = ["-avd", AVD_NAME, "-port", String(CONSOLE_PORT), "-memory", "3072", "-gpu", "host", "-no-snapshot", "-no-audio", "-no-boot-anim"];
    const record = spawnDetached("emulator", EMULATOR, args, { cwd: REPO });
    updateState((state) => { state.emulator = record; });
    step("Émulateur", `« ${AVD_NAME} » en démarrage (${SERIAL}) — journal : ${shortPath(record.log)}`);
    const up = await waitFor(() => {
      const log = fs.readFileSync(record.log, "utf8");
      if (/hvf is not enabled/i.test(log)) throw new LauncherError(`l'émulateur refuse l'hyperviseur (« hvf is not enabled ») — journal : ${shortPath(record.log)}`);
      if (!isAlive(record)) throw new LauncherError(`l'émulateur s'est arrêté — journal : ${shortPath(record.log)}`);
      return booted();
    }, { timeoutMs: 240_000, everyMs: 2000 });
    if (!up) throw new LauncherError(`l'émulateur n'a pas fini de démarrer en 4 min — journal : ${shortPath(record.log)}`);
    note("démarré (Android TV prêt)");
    return record;
  } catch (error) {
    await stopEmulator();
    throw error;
  }
}

/** Éteint l'émulateur du lanceur (par son PID) et rend le verrou. Rend vrai s'il tournait. */
export async function stopEmulator() {
  const record = loadState().emulator;
  let stopped = false;
  if (isAlive(record)) {
    adb(["emu", "kill"]);
    await sleep(3000);
    await stopProcess(record);
    stopped = true;
  }
  updateState((state) => { delete state.emulator; });
  releaseLock();
  if (!stopped && fs.existsSync(LOCK_DIR) && !lockIsOurs()) warn(`verrou de l'émulateur tenu par : ${lockOwner()}`);
  return stopped;
}
