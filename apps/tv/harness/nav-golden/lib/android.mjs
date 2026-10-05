// Le banc sur Android TV (`--android`) : l'émulateur (ou un boîtier) que
// l'on tient déjà, piloté par adb. Les MÊMES scénarios et les MÊMES
// références que l'Apple TV — la référence absolue — : on rejoue la refonte
// Android contre le relevé tvOS, écart par écart.
//
// Ce qui change par rapport au simulateur tvOS :
//  - pas d'agent XCUITest : les touches partent par la console de l'émulateur
//    (`adb emu event send`), qui sait APPUYER puis RELÂCHER — un appui
//    maintenu y est un vrai appui maintenu, avec les répétitions qu'Android
//    synthétise ; sur un boîtier réel, `input keyevent` (sans maintien précis) ;
//  - la session du banc s'écrit dans la base d'AsyncStorage de l'app
//    (`RKStorage`), app effacée (`pm clear`) avant chaque scénario ;
//  - le Metro de la place et le faux backend passent par `adb reverse`.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BenchError, CACHE_DIR, capture, sleep } from "./config.mjs";

export const ANDROID_PACKAGE = process.env.NAV_GOLDEN_ANDROID_PACKAGE ?? "com.tentacletv.mobile";
const ACTIVITY = `${ANDROID_PACKAGE}/com.tentacletv.MainActivity`;
const SDK = process.env.ANDROID_HOME ?? path.join(os.homedir(), "Library/Android/sdk");
const ADB = path.join(SDK, "platform-tools/adb");

/** L'appareil visé : `ANDROID_SERIAL`, sinon le seul appareil branché. */
export function androidSerial() {
  if (process.env.ANDROID_SERIAL) return process.env.ANDROID_SERIAL;
  const lines = (capture(ADB, ["devices"]) ?? "").split("\n").slice(1).filter((l) => /\tdevice$/.test(l));
  if (lines.length === 1) return lines[0].split("\t")[0];
  throw new BenchError(lines.length ? `plusieurs appareils Android (${lines.map((l) => l.split("\t")[0]).join(", ")}) : préciser ANDROID_SERIAL` : "aucun appareil Android : lancer l'émulateur (verrou android-emulator pris) avant le banc");
}

export function adb(ctx, args, options = {}) {
  return capture(ADB, ["-s", ctx.serial, ...args], options);
}

const shell = (ctx, command, options) => adb(ctx, ["shell", command], options);
export const isEmulator = (ctx) => ctx.serial.startsWith("emulator-");

/** Le modèle, la version d'Android et la taille d'écran — ce que dit la référence d'un passage. */
export function describeAndroid(ctx) {
  const prop = (name) => (shell(ctx, `getprop ${name}`) ?? "").trim();
  const size = (shell(ctx, "wm size") ?? "").match(/(\d+x\d+)\s*$/m)?.[1] ?? "?";
  const density = (shell(ctx, "wm density") ?? "").match(/(\d+)\s*$/m)?.[1] ?? "?";
  return { name: ctx.serial, model: `${prop("ro.product.model")} (Android TV)`, runtime: `Android ${prop("ro.build.version.release")} / API ${prop("ro.build.version.sdk")} · ${size} @ ${density}` };
}

/**
 * L'APK de la place : `--apk <chemin>` (ou NAV_GOLDEN_APK), sinon celle du
 * build debug du dossier servi. Debug obligatoire : elle charge son JS depuis
 * Metro (celui de la place, par `adb reverse tcp:8081`). Réinstallée quand son
 * empreinte change.
 */
export function ensureAndroidApp(ctx, checkout, state, apkOption) {
  const apk = apkOption ?? process.env.NAV_GOLDEN_APK ?? path.join(checkout.dir, "apps/tv/android/app/build/outputs/apk/debug/app-debug.apk");
  if (!fs.existsSync(apk)) throw new BenchError(`pas d'APK debug : ${apk} — « ./gradlew assembleDebug » dans apps/tv/android, ou --apk <chemin>`);
  const stat = fs.statSync(apk);
  const stamp = `${apk}:${stat.size}:${stat.mtimeMs}`;
  const installed = (shell(ctx, `pm path ${ANDROID_PACKAGE}`) ?? "").includes("package:");
  if (installed && state.androidApk === stamp) return { apk, stamp, changed: false };
  const out = adb(ctx, ["install", "-r", "-d", apk], { timeout: 300_000 });
  if (!out?.includes("Success")) throw new BenchError(`installation de l'APK refusée : ${out ?? "adb muet"}`);
  return { apk, stamp, changed: true };
}

/** Les ports de la place vus de l'appareil : Metro sur 8081 (celui que l'APK debug appelle), le faux backend sur le sien. */
export function reversePorts(ctx) {
  adb(ctx, ["reverse", "tcp:8081", `tcp:${ctx.ports.metro}`]);
  adb(ctx, ["reverse", `tcp:${ctx.ports.backend}`, `tcp:${ctx.ports.backend}`]);
}

/** La base d'AsyncStorage (`RKStorage`, table `catalystLocalStorage`), construite sur le Mac. */
async function storageDatabase(entries) {
  const { DatabaseSync } = await import("node:sqlite");
  const file = path.join(os.tmpdir(), `nav-golden-rkstorage-${process.pid}.db`);
  fs.rmSync(file, { force: true });
  const db = new DatabaseSync(file);
  db.exec("CREATE TABLE catalystLocalStorage (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  // La version d'AsyncStorage (ReactDatabaseSupplier, DATABASE_VERSION = 1) : à 0,
  // SQLiteOpenHelper rejoue onCreate, échoue (table déjà là) et EFFACE la base.
  db.exec("PRAGMA user_version = 1");
  const insert = db.prepare("INSERT INTO catalystLocalStorage (key, value) VALUES (?, ?)");
  for (const [key, value] of Object.entries(entries)) insert.run(key, String(value));
  db.close();
  return file;
}

/** La session factice : `paired` (jumelée au faux backend) ou `none` (écran de jumelage). */
function sessionEntries(session, backendPort) {
  if (session === "none") return { tentacle_language: "fr" };
  return {
    tentacle_server_url: `http://localhost:${backendPort}`,
    tentacle_token: "banc",
    tentacle_user: JSON.stringify({ Id: "banc-user", Name: "Knaoxtest" }),
    tentacle_language: "fr",
  };
}

/**
 * Démarrage à froid : app arrêtée et EFFACÉE (`pm clear` : stockage, caches,
 * cache de requêtes persistant), puis la session du banc écrite dans sa base
 * avant qu'elle ne la lise. `run-as` exige l'APK debug.
 */
export async function resetAndroidApp(ctx, { session = "paired", storage = {} }) {
  shell(ctx, `am force-stop ${ANDROID_PACKAGE}`);
  shell(ctx, `pm clear ${ANDROID_PACKAGE}`);
  const entries = { ...sessionEntries(session, ctx.ports.backend), ...storage };
  const file = await storageDatabase(entries);
  const remote = `/data/local/tmp/nav-golden-${ctx.ports.slot}.db`;
  adb(ctx, ["push", file, remote]);
  fs.rmSync(file, { force: true });
  shell(ctx, `run-as ${ANDROID_PACKAGE} mkdir -p databases`);
  // Par un tube : le domaine SELinux de run-as ne lit pas /data/local/tmp directement.
  shell(ctx, `cat ${remote} | run-as ${ANDROID_PACKAGE} sh -c 'cat > databases/RKStorage'`);
  shell(ctx, `rm -f ${remote}`);
  const check = shell(ctx, `run-as ${ANDROID_PACKAGE} ls -l databases/RKStorage`) ?? "";
  if (!check.includes("RKStorage")) throw new BenchError("la session du banc n'a pas pu être écrite dans l'app (APK debug ? run-as refusé ?)");
  return entries;
}

export async function launchAndroidApp(ctx) {
  shell(ctx, `am start -n ${ACTIVITY}`);
  await sleep(300);
}

/** L'app au premier plan ? (activité reprise = la nôtre) */
export function androidForeground(ctx) {
  const out = shell(ctx, "dumpsys activity activities") ?? "";
  const line = out.split("\n").find((l) => /mResumedActivity|topResumedActivity/.test(l)) ?? "";
  return line.includes(ANDROID_PACKAGE);
}

// ─── La télécommande ─────────────────────────────────────────────────────────

/**
 * Les touches de la télécommande Android, en codes Linux pour la console de
 * l'émulateur (Generic.kl : 232 → DPAD_CENTER, 158 → BACK, 164 →
 * MEDIA_PLAY_PAUSE) et en codes Android pour `input keyevent`. « menu » de
 * l'Apple TV est le Retour d'Android ; « play », la touche Lecture/Pause.
 */
const KEYS = {
  up: ["KEY_UP", 19], down: ["KEY_DOWN", 20], left: ["KEY_LEFT", 21], right: ["KEY_RIGHT", 22],
  select: ["KEY_CENTER", 23], menu: ["KEY_BACK", 4], play: ["KEY_PLAYPAUSE", 85], home: ["KEY_HOME", 3],
};
const HOLD_KEY = { hold: "select", holdup: "up", holddown: "down", holdleft: "left", holdright: "right" };

const emu = (ctx, ...events) => adb(ctx, ["emu", "event", "send", ...events]);

/**
 * Appui bref : `input keyevent` (enfoncement puis relâchement). La console de
 * l'émulateur n'injecte rien sur l'AVD Android TV (aucun périphérique n'y
 * déclare les flèches — mesuré le 2026-10-05).
 */
async function tap(ctx, name) {
  shell(ctx, `input keyevent ${KEYS[name][1]}`);
}

const HOLD_SOURCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../android-burst/hold/Hold.java");
const HOLD_DEX = "/data/local/tmp/hold.dex";

/**
 * L'injecteur de touche TENUE (`android-burst/hold/Hold.java`) sur l'appareil :
 * compilé une fois dans le cache du banc, poussé s'il manque. `null` sans
 * javac ni build-tools (le maintien retombe alors sur la console).
 */
function holdInjector(ctx) {
  if (ctx.holdDex !== undefined) return ctx.holdDex;
  ctx.holdDex = null;
  if (!(shell(ctx, `ls ${HOLD_DEX} 2>/dev/null || true`) ?? "").includes("hold.dex")) {
    const out = path.join(CACHE_DIR, "hold-dex");
    const dex = path.join(out, "classes.dex");
    if (!fs.existsSync(dex)) {
      const jar = fs.readdirSync(path.join(SDK, "platforms")).filter((d) => /^android-\d+$/.test(d)).sort((a, b) => Number(a.split("-")[1]) - Number(b.split("-")[1])).pop();
      const tools = fs.readdirSync(path.join(SDK, "build-tools")).sort().pop();
      if (!jar || !tools) return null;
      const androidJar = path.join(SDK, "platforms", jar, "android.jar");
      fs.mkdirSync(out, { recursive: true });
      capture("javac", ["-source", "1.8", "-target", "1.8", "-cp", androidJar, "-d", out, HOLD_SOURCE]);
      capture(path.join(SDK, "build-tools", tools, "d8"), ["--output", out, "--lib", androidJar, path.join(out, "Hold.class")]);
      if (!fs.existsSync(dex)) return null;
    }
    adb(ctx, ["push", dex, HOLD_DEX]);
  }
  ctx.holdDex = HOLD_DEX;
  return HOLD_DEX;
}

/**
 * Appui MAINTENU `seconds` secondes, répétitions comprises (enfoncement, la
 * 1re répétition à 500 ms puis toutes les 50 ms, relâchement) : l'injecteur,
 * comme `input` (l'AVD Android TV n'a aucun périphérique qui déclare les
 * flèches : ni la console ni `sendevent` ne les tiennent). Sans lui, la
 * console de l'émulateur, puis l'appui long d'Android.
 */
async function hold(ctx, name, seconds) {
  const [linux, code] = KEYS[name];
  const dex = holdInjector(ctx);
  if (dex) {
    shell(ctx, `CLASSPATH=${dex} app_process /system/bin Hold ${code} ${Math.round(seconds * 1000)}`);
    return;
  }
  if (!isEmulator(ctx)) {
    shell(ctx, `input keyevent --longpress ${code}`);
    return;
  }
  emu(ctx, `EV_KEY:${linux}:1`);
  await sleep(seconds * 1000);
  emu(ctx, `EV_KEY:${linux}:0`);
}

/** Le texte tapé au clavier de l'appareil (`\n` : Entrée). */
function typeText(ctx, text) {
  for (const [i, part] of text.split("\n").entries()) {
    if (i > 0) shell(ctx, "input keyevent 66");
    if (!part) continue;
    // `input text` : %s pour l'espace, le reste échappé pour le shell de l'appareil.
    const escaped = part.replace(/ /g, "%s").replace(/(["'`\\$&|;<>()*?!#~^[\]{}])/g, "\\$1");
    shell(ctx, `input text ${escaped}`);
  }
}

/** Un geste du vocabulaire des scénarios, sur Android. Rend `true` s'il a été joué ici. */
export async function androidPerform(ctx, gesture) {
  if (KEYS[gesture]) {
    await tap(ctx, gesture);
    return true;
  }
  if (gesture === "activate") {
    await launchAndroidApp(ctx);
    return true;
  }
  const held = gesture.match(/^(hold|holdup|holddown|holdleft|holdright):(\d+(?:\.\d+)?)$/);
  if (held) {
    await hold(ctx, HOLD_KEY[held[1]], Number(held[2]));
    return true;
  }
  if (gesture.startsWith("type:")) {
    typeText(ctx, gesture.slice("type:".length));
    return true;
  }
  return false;
}

/** Un geste sans équivalent sur la télécommande Android (pavé tactile de la Siri Remote). */
export const touchpadOnly = (gesture) => /^(swipe|pan):/.test(gesture);

/** Les gestes d'un scénario qui n'ont pas de sens sur Android TV : la raison de l'ignorer, ou `null`. */
export function androidSkipReason(scenario) {
  const gestures = [...(scenario.start?.keys ?? []), ...scenario.steps.flatMap((s) => [].concat(s.do))];
  const touch = gestures.filter(touchpadOnly);
  return touch.length ? `pavé tactile de la Siri Remote (${[...new Set(touch.map((g) => g.split(":")[0]))].join(", ")}) : sans objet sur Android TV` : null;
}
