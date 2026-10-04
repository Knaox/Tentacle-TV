// Android TV : la place du banc sur un ÉMULATEUR (ou un boîtier par adb) — la
// télécommande, le lancement et la session, à la place de l'agent XCUITest
// et du simulateur. Le reste du banc (faux backend, Metro et sa sonde, démon
// CDP, scénarios, relevés) ne change pas : un scénario de référence enregistré
// sur l'Apple TV se rejoue tel quel, et chaque écart est une différence
// d'Android TV avec l'Apple TV.
//
// - un appui : `adb shell input keyevent` (la touche du D-pad, enfoncée puis
//   relâchée) ;
// - un MAINTIEN (`hold:1.2`, `holddown:2`…) : la console de l'émulateur
//   (`adb emu event send EV_KEY:<code>:1`, puis `:0`) — une touche réellement
//   tenue, dont Android synthétise les répétitions comme sur un boîtier (une
//   rafale de `input keyevent` n'a pas de `repeatCount`) ;
// - la session : la sonde vide le stockage de l'app (AsyncStorage), pose
//   celle du banc et recharge le JS (`__navGolden.androidReset`) ;
// - Metro et le faux backend : `adb reverse` (l'app debug lit Metro sur
//   localhost:8081, le faux backend sur localhost:310n).
import { BenchError, capture, sleep, step } from "./config.mjs";
import { httpJson, waitFor } from "./processes.mjs";

export const ANDROID_PACKAGE = process.env.NAV_GOLDEN_ANDROID_PACKAGE ?? "com.tentacletv.mobile";
const ACTIVITY = `${ANDROID_PACKAGE}/com.tentacletv.MainActivity`;

/** Les codes Android (`input keyevent`) des gestes du banc. */
export const ANDROID_KEYCODES = { up: 19, down: 20, left: 21, right: 22, select: 23, menu: 4, play: 85, home: 3 };
/** Les codes Linux (console de l'émulateur) des touches qu'un scénario maintient. */
export const LINUX_KEYCODES = { "": 353, up: 103, down: 108, left: 105, right: 106 };

function adb(args, options) {
  const serial = process.env.ANDROID_SERIAL ? ["-s", process.env.ANDROID_SERIAL] : [];
  return capture("adb", [...serial, ...args], options);
}

function shell(command) {
  return adb(["shell", command]);
}

/** L'appareil adb de la place : un seul, ou celui d'ANDROID_SERIAL. */
export function androidDevice() {
  const lines = (capture("adb", ["devices"]) ?? "").split("\n").slice(1).map((l) => l.trim()).filter((l) => l.endsWith("\tdevice"));
  const serials = lines.map((l) => l.split("\t")[0]);
  const serial = process.env.ANDROID_SERIAL ?? (serials.length === 1 ? serials[0] : null);
  if (!serial || !serials.includes(serial)) {
    throw new BenchError(serials.length > 1 ? `plusieurs appareils adb (${serials.join(", ")}) : préciser ANDROID_SERIAL` : "aucun appareil adb : émulateur lancé ? (verrou .claude/locks/android-emulator)");
  }
  const model = shell("getprop ro.product.model")?.trim() ?? "?";
  const release = shell("getprop ro.build.version.release")?.trim() ?? "?";
  return { serial, name: serial, model, runtime: `Android ${release}`, emulator: serial.startsWith("emulator-") };
}

/** L'app de la place est-elle installée ? (une build debug, qui lit Metro). */
export function ensureAndroidApp() {
  const path = shell(`pm path ${ANDROID_PACKAGE}`) ?? "";
  if (!path.includes("package:")) {
    throw new BenchError(`${ANDROID_PACKAGE} n'est pas installée : cd apps/tv/android && ./gradlew assembleDebug, puis adb install -r app/build/outputs/apk/debug/app-debug.apk`);
  }
  const dump = shell(`dumpsys package ${ANDROID_PACKAGE}`) ?? "";
  if (!/flags=\[[^\]]*DEBUGGABLE/.test(dump)) throw new BenchError(`${ANDROID_PACKAGE} n'est pas une build debug : elle ne lira pas le Metro du banc`);
}

/** Metro (port de la place → 8081 de l'app) et le faux backend, joignables depuis l'appareil. */
export function reversePorts(ctx) {
  adb(["reverse", "tcp:8081", `tcp:${ctx.ports.metro}`]);
  adb(["reverse", `tcp:${ctx.ports.backend}`, `tcp:${ctx.ports.backend}`]);
}

const foreground = () => (shell("dumpsys activity activities") ?? "").split("\n").some((l) => /mResumedActivity|topResumedActivity/.test(l) && l.includes(ANDROID_PACKAGE));

/** Arrête l'app et la relance (démarrage à froid). */
export async function launchAndroidApp() {
  shell(`am force-stop ${ANDROID_PACKAGE}`);
  shell(`am start -n ${ACTIVITY}`);
  await sleep(500);
}

/** Les clés de la session du banc (les mêmes qu'au simulateur, `simulator.mjs`). */
function sessionKeys(session, backendPort) {
  if (session === "none") return { tentacle_language: "fr" };
  return {
    tentacle_server_url: `http://localhost:${backendPort}`,
    tentacle_token: "banc",
    tentacle_user: JSON.stringify({ Id: "banc-user", Name: "Knaoxtest" }),
    tentacle_language: "fr",
  };
}

/**
 * Remet le stockage de l'app à la session du banc, par la sonde, puis attend
 * le rechargement du JS (un nouveau `boot` de la sonde).
 */
export async function resetAndroidSession(ctx, evaluate, { session = "paired", storage = {} } = {}) {
  const keys = { ...sessionKeys(session, ctx.ports.backend), ...storage };
  const before = await evaluate(ctx, `globalThis.__navGolden.boot`);
  await evaluate(ctx, `globalThis.__navGolden.androidReset(${JSON.stringify(keys)}), 1`);
  const rebooted = await waitFor(async () => {
    try {
      const boot = await evaluate(ctx, `globalThis.__navGolden ? globalThis.__navGolden.boot : null`, { timeoutMs: 4000 });
      return boot && boot !== before ? boot : null;
    } catch {
      return null;
    }
  }, { timeoutMs: 120_000, everyMs: 500 });
  if (!rebooted) throw new BenchError("l'app n'a pas rechargé son JS après la remise à zéro de sa session");
}

const HOLDS = /^hold(up|down|left|right)?:(\d+(?:\.\d+)?)$/;

/**
 * Les ordres de l'agent, joués par adb ; rend des réponses de la même forme
 * (`{ info }`) : `focus` dit `background:` quand l'app n'est plus devant.
 */
export async function androidRun(ctx, commands) {
  const replies = [];
  for (const command of commands) {
    if (command === "activate") {
      if (!foreground()) shell(`am start -n ${ACTIVITY}`);
      replies.push({ info: "ok" });
    } else if (command === "focus") {
      replies.push({ info: foreground() ? "foreground:" : "background:" });
    } else if (command in ANDROID_KEYCODES) {
      shell(`input keyevent ${ANDROID_KEYCODES[command]}`);
      replies.push({ info: "ok" });
    } else if (HOLDS.test(command)) {
      const [, dir = "", seconds] = command.match(HOLDS);
      await holdKey(LINUX_KEYCODES[dir], Number(seconds));
      replies.push({ info: "ok" });
    } else if (command.startsWith("type:")) {
      const text = command.slice("type:".length).replace(/\n/g, "");
      shell(`input text ${JSON.stringify(text.replace(/ /g, "%s"))}`);
      replies.push({ info: "ok" });
    } else {
      throw new BenchError(`geste sans équivalent sur Android TV : « ${command} »`);
    }
  }
  return replies;
}

/** Une touche réellement TENUE (console de l'émulateur) : Android en synthétise les répétitions. */
async function holdKey(code, seconds) {
  if (adb(["emu", "event", "send", `EV_KEY:${code}:1`, "EV_SYN:0:0"]) === null) {
    throw new BenchError("maintien impossible : la console de l'émulateur ne répond pas (adb emu) — un boîtier réel n'a pas de console");
  }
  await sleep(seconds * 1000);
  adb(["emu", "event", "send", `EV_KEY:${code}:0`, "EV_SYN:0:0"]);
}

/** Ce qui décrit la place dans les relevés. */
export function describeAndroid(device) {
  return { name: device.name, model: device.model, runtime: device.runtime };
}

/** Le paquet JS d'Android, construit avant l'app (sous charge, il dépasse son délai). */
export async function warmAndroidBundle(ctx) {
  const url = `http://127.0.0.1:${ctx.ports.metro}/index.bundle?platform=android&dev=true&minify=false&modulesOnly=false&runModule=true&app=${ANDROID_PACKAGE}`;
  const res = await httpJson(url, { timeoutMs: 600_000 });
  if (res?.status !== 200) throw new BenchError(`Metro n'a pas servi le paquet Android (${res?.status ?? "délai"})`);
  if (!res.text.includes("nav-golden-real-app") && !res.text.includes("navProbe")) throw new BenchError("le paquet Android ne contient pas la sonde du banc");
  step("Paquet Android", `prêt (${Math.round(res.text.length / 1e6)} Mo)`);
}
