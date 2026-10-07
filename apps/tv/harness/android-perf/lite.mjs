#!/usr/bin/env node
// Le banc LITE d'Android TV : l'app sur une box FAIBLE imitée — AVD contraints
// (1 Go / 2 Go, 2 / 4 cœurs), émulateur freiné, pression mémoire — et des
// parcours écran par écran mesurés (gfxinfo, meminfo, démarrage, Perfetto),
// comparables d'une passe à l'autre. Doc : docs/android-tv-lite/BANC.md.
//
//   node lite.mjs avd create [Lite_API31_1G|Lite_API31_2G|all]
//   node lite.mjs avd start <avd> [--window]     · avd stop <avd> · avd check <avd>
//   node lite.mjs throttle measure <avd> [--specs ecoe,duty:50,duty:25] [--rounds 3]
//   node lite.mjs pressure trim <avd> <NIVEAU>  · pressure hog <avd> <Mo> <s>  · pressure apps <avd>
//   node lite.mjs setup <avd> --apk <release> --debug-apk <debug>   (session écrite, faux backend jusqu'à Ctrl+C)
//   node lite.mjs parcours run <avd> --apk <release> --debug-apk <debug> --tag <nom>
//        [--throttle duty:25] [--only id,id] [--rounds 2] [--cold 3] [--endurance 3] [--perfetto] [--pressure] [--no-warmup]
//   node lite.mjs parcours compare <dossier-avant> <dossier-après>
//   node lite.mjs cout run <avd> --apk <release> --debug-apk <debug> [--sets aac,truehd,ass] [--throttle duty:25] [--window 20]
//        (le coût d'une lecture : son décodé, sous-titres rendus — `lib/lite/playCost.mjs`)
//
// L'app mesurée est TOUJOURS l'app de mesure (`com.tentacletv.mobile.perf`,
// construite par `-PtentaclePerfApp=1`) ; ports : relais 3111, faux backend
// 3121 (`PERF_PORT` les déplace). Aucun AVD autre que `Lite_*` n'est touché.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkAvd, createAvd, LITE_AVDS, serialOf, startAvd, stopAvd } from "./lib/lite/avd.mjs";
import { launchHeavyApps, pushHog, startHog, trimMemory } from "./lib/lite/pressure.mjs";
import { measureThrottle } from "./lib/lite/throttle.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PERF_PACKAGE = "com.tentacletv.mobile.perf";
process.env.PERF_PACKAGE ??= PERF_PACKAGE;
process.env.PERF_PORT ??= "3111";

const [group, command, ...rest] = process.argv.slice(2);
const option = (name, fallback = null) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : fallback;
};
const flag = (name) => rest.includes(`--${name}`);
/** Les options qui prennent une valeur ; les autres sont des drapeaux. */
const VALUED = new Set(["apk", "debug-apk", "tag", "throttle", "only", "rounds", "cold", "endurance", "specs", "sets", "window"]);
const positional = rest.filter((arg, i) => !arg.startsWith("--") && !(i > 0 && VALUED.has(rest[i - 1].slice(2))));

async function avd() {
  const name = positional[0];
  if (command === "create") {
    for (const each of !name || name === "all" ? Object.keys(LITE_AVDS) : [name]) createAvd(each);
    return;
  }
  if (!name) throw new Error("nom d'AVD attendu (Lite_API31_1G, Lite_API31_2G)");
  if (command === "start") {
    const started = Date.now();
    const result = await startAvd(name, { window: flag("window") });
    console.log(`${name} prêt en ${Math.round((Date.now() - started) / 1000)} s — ${result.serial} (journal ${result.log})`);
    console.log(JSON.stringify(checkAvd(name)));
    return;
  }
  if (command === "stop") return stopAvd(name);
  if (command === "check") return console.log(JSON.stringify(checkAvd(name), null, 1));
  throw new Error(`avd ${command} : create | start | stop | check`);
}

async function throttle() {
  if (command !== "measure") throw new Error("throttle measure <avd>");
  const name = positional[0];
  const specs = (option("specs") ?? "ecoe,duty:50,duty:25").split(",");
  const results = await measureThrottle(serialOf(name), specs, { rounds: Number(option("rounds", "3")), cores: LITE_AVDS[name].cores });
  console.table(results);
}

async function pressure() {
  const name = positional[0];
  const serial = serialOf(name);
  const pkg = process.env.PERF_PACKAGE;
  if (command === "trim") return console.log(trimMemory(serial, pkg, positional[1]) || `${positional[1]} envoyé à ${pkg}`);
  if (command === "hog") {
    pushHog(serial, path.join(process.env.HOME, "Library/Caches/tentacle-android-perf"), path.join(HERE, "keys/Hog.java"));
    const hog = startHog(serial, Number(positional[1]), Number(positional[2]));
    console.log(await hog.done);
    return;
  }
  if (command === "apps") return console.log(`lancées : ${(await launchHeavyApps(serial, `${pkg}/com.tentacletv.MainActivity`)).join(", ")}`);
  throw new Error("pressure trim <avd> <NIVEAU> | hog <avd> <Mo> <s> | apps <avd>");
}

async function main() {
  if (group === "avd") return avd();
  if (group === "throttle") return throttle();
  if (group === "pressure") return pressure();
  if (group === "setup" || group === "parcours" || group === "cout") {
    // L'appareil se choisit AVANT que `device.mjs` ne lise son serial.
    const name = group === "setup" ? command : positional[0];
    if (name && LITE_AVDS[name]) process.env.ANDROID_SERIAL ??= serialOf(name);
    const { runRoute, compareRuns, setupOnly, runPlayCost } = await import("./lib/lite/route.mjs");
    if (group === "cout") return runPlayCost({ avd: name, option });
    if (group === "setup") return setupOnly({ apk: option("apk"), debugApk: option("debug-apk") });
    if (command === "run") return runRoute({ avd: name, option, flag });
    if (command === "compare") return compareRuns(positional[0], positional[1]);
  }
  console.error("usage : lite.mjs avd|throttle|pressure|setup|parcours — voir l'en-tête du fichier");
  process.exit(2);
}

main().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
