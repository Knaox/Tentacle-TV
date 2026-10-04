#!/usr/bin/env node
// Mesure d'une RAFALE sur Android TV : une flèche réellement tenue (console de
// l'émulateur, Android synthétise les répétitions), et ce que l'app a dessiné
// pendant — `dumpsys gfxinfo` (images, images ratées, centiles).
//
//   node apps/tv/harness/android-burst/burst.mjs <down|up|left|right> <secondes> [--repeat 3] [--pause 1.5]
//
// L'app doit être DEVANT, le focus là où la rafale doit partir (par exemple
// avec nav-golden `start`/`do --android`). Chaque passage : gfxinfo remis à
// zéro, flèche tenue, relevé ; puis la moyenne.
import { execFileSync } from "node:child_process";

const PACKAGE = process.env.NAV_GOLDEN_ANDROID_PACKAGE ?? "com.tentacletv.mobile";
const CODES = { up: 103, down: 108, left: 105, right: 106 };

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

const runs = [];
for (let i = 0; i < repeat; i++) {
  adb("shell", "dumpsys", "gfxinfo", PACKAGE, "reset");
  adb("emu", "event", "send", `EV_KEY:${CODES[dir]}:1`, "EV_SYN:0:0");
  await sleep(seconds * 1000);
  adb("emu", "event", "send", `EV_KEY:${CODES[dir]}:0`, "EV_SYN:0:0");
  await sleep(800); // la page finit son mouvement
  const run = parse(adb("shell", "dumpsys", "gfxinfo", PACKAGE));
  runs.push(run);
  console.log(`passage ${i + 1} : ${run.frames} images, ${run.janky} ratées (${((100 * run.janky) / run.frames).toFixed(1)} %), p50 ${run.p50} ms, p90 ${run.p90} ms, p99 ${run.p99} ms, UI lent ${run.slowUi}`);
  await sleep(pause * 1000);
}
const sum = (key) => runs.reduce((n, r) => n + r[key], 0);
console.log(`total : ${sum("frames")} images, ${sum("janky")} ratées (${((100 * sum("janky")) / sum("frames")).toFixed(1)} %)`);
