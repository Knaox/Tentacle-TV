#!/usr/bin/env node
// Mesure d'une RAFALE sur Android TV : une flèche réellement tenue (console de
// l'émulateur, Android synthétise les répétitions), et ce que l'app a dessiné
// pendant — `dumpsys gfxinfo` (images, images ratées, centiles).
//
//   node apps/tv/harness/android-burst/burst.mjs <down|up|left|right> <secondes> [--repeat 3] [--pause 1.5] [--device /dev/input/eventN]
//
// La touche est tenue par `sendevent` sur le périphérique d'entrée qui déclare
// les flèches (`--device`, sinon cherché par `getevent -lp`), ou à défaut par
// la console de l'émulateur. Au niveau du noyau, Android synthétise lui-même
// les répétitions, comme sous une vraie télécommande.
//
// L'app doit être DEVANT, le focus là où la rafale doit partir (par exemple
// avec nav-golden `start`/`do --android`). Chaque passage : gfxinfo remis à
// zéro, flèche tenue, relevé ; puis la moyenne.
import { execFileSync } from "node:child_process";

const PACKAGE = process.env.NAV_GOLDEN_ANDROID_PACKAGE ?? "com.tentacletv.mobile";
const CODES = { up: 103, down: 108, left: 105, right: 106 };
/** Les codes Android, pour l'injecteur (`hold/Hold.java`). */
const ANDROID_CODES = { up: 19, down: 20, left: 21, right: 22 };
const HOLD_DEX = "/data/local/tmp/hold.dex";

const [dir, secondsArg, ...rest] = process.argv.slice(2);
const option = (name, fallback) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? Number(rest[i + 1]) : fallback;
};
if (!(dir in CODES) || !Number(secondsArg)) {
  console.error("usage : burst.mjs <down|up|left|right> <secondes> [--repeat 3] [--pause 1.5]");
  process.exit(2);
}
const seconds = Number(secondsArg);
const repeat = option("repeat", 3);
const pause = option("pause", 1.5);

const deviceArg = (() => {
  const i = rest.indexOf("--device");
  return i >= 0 ? rest[i + 1] : null;
})();
const adb = (...args) => execFileSync("adb", [...(process.env.ANDROID_SERIAL ? ["-s", process.env.ANDROID_SERIAL] : []), ...args], { encoding: "utf8" });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parse(text) {
  const num = (re) => Number((text.match(re) ?? [])[1] ?? NaN);
  return {
    frames: num(/Total frames rendered: (\d+)/),
    janky: num(/Janky frames: (\d+)/),
    p50: num(/50th percentile: (\d+)ms/),
    p90: num(/90th percentile: (\d+)ms/),
    p95: num(/95th percentile: (\d+)ms/),
    p99: num(/99th percentile: (\d+)ms/),
    slowUi: num(/Number Slow UI thread: (\d+)/),
    slowDraw: num(/Number Slow issue draw commands: (\d+)/),
  };
}

/** Le périphérique d'entrée qui déclare les quatre flèches (`getevent -lp`). */
function arrowDevice() {
  if (deviceArg) return deviceArg;
  const blocks = adb("shell", "getevent", "-lp").split(/^add device \d+: /m).slice(1);
  for (const block of blocks) {
    const path = block.split("\n")[0].trim();
    if (["KEY_UP", "KEY_DOWN", "KEY_LEFT", "KEY_RIGHT"].every((key) => new RegExp(`\\b${key}\\b`).test(block))) return path;
  }
  return null;
}

// L'injecteur d'abord (comme `input`, droits du shell : de vraies répétitions,
// même sans clavier déclaré) ; sinon sendevent ; sinon la console.
const injector = adb("shell", `ls ${HOLD_DEX} 2>/dev/null || true`).includes("hold.dex");
const device = injector ? null : arrowDevice();
console.log(injector ? "touche tenue par l'injecteur (hold.dex)" : device ? `touche tenue par sendevent sur ${device}` : "touche tenue par la console de l'émulateur");
const press = (down) =>
  device
    ? adb("shell", `sendevent ${device} 1 ${CODES[dir]} ${down ? 1 : 0}; sendevent ${device} 0 0 0`)
    : adb("emu", "event", "send", `EV_KEY:${CODES[dir]}:${down ? 1 : 0}`, "EV_SYN:0:0");

const runs = [];
for (let i = 0; i < repeat; i++) {
  adb("shell", "dumpsys", "gfxinfo", PACKAGE, "reset");
  if (injector) adb("shell", `CLASSPATH=${HOLD_DEX} app_process /system/bin Hold ${ANDROID_CODES[dir]} ${Math.round(seconds * 1000)}`);
  else {
    press(true);
    await sleep(seconds * 1000);
    press(false);
  }
  await sleep(800); // la page finit son mouvement
  const run = parse(adb("shell", "dumpsys", "gfxinfo", PACKAGE));
  runs.push(run);
  console.log(`passage ${i + 1} : ${run.frames} images, ${run.janky} ratées (${((100 * run.janky) / run.frames).toFixed(1)} %), p50 ${run.p50} ms, p90 ${run.p90} ms, p99 ${run.p99} ms, UI lent ${run.slowUi}`);
  await sleep(pause * 1000);
}
const sum = (key) => runs.reduce((n, r) => n + r[key], 0);
console.log(`total : ${sum("frames")} images, ${sum("janky")} ratées (${((100 * sum("janky")) / sum("frames")).toFixed(1)} %)`);
