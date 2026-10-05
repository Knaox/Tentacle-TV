#!/usr/bin/env node
// Le banc de FLUIDITÉ d'Android TV : chaque animation de la refonte rejouée
// sur l'appareil (émulateur sous verrou, ou une Shield), mesurée par le mode
// de mesure de l'app (`debug.tentacle.perf`, journal `[perf-json]` : images,
// images ratées, phases de chaque image, rendus React) et par le temps
// processeur de chaque fil. Faux backend nav-golden derrière un relais qui
// sert les images à la taille demandée, comme Jellyfin : aucun compte réel.
//
//   node apps/tv/harness/android-perf/bench.mjs run --apk <release.apk> --debug-apk <debug.apk> --tag <nom> [--only a,b] [--rounds 3] [--trace] [--shots]
//   node apps/tv/harness/android-perf/bench.mjs show <nom>
//   node apps/tv/harness/android-perf/bench.mjs compare <avant> <après>
//   node apps/tv/harness/android-perf/bench.mjs diff <avant> <après>     (captures : SSIM, PSNR, côte à côte)
//
// L'appareil doit tourner AVANT (pnpm tv:refonte:android, verrou pris). Les
// deux APK : la release à mesurer, et une debug de la même clé (la session
// s'écrit par `run-as`). Résultats : ~/Library/Caches/tentacle-android-perf/runs/.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDevice, PACKAGE, sleep } from "./lib/device.mjs";
import { startImageProxy } from "./lib/imageProxy.mjs";
import { compareTable, cpuDelta, describe, summarizeRound, summarizeScenario } from "./lib/report.mjs";
import { scenariosOf } from "./lib/scenarios.mjs";
import { startTrace, stopTrace, summarizeTrace } from "./lib/trace.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(os.homedir(), "Library/Caches/tentacle-android-perf");
const RUNS = path.join(CACHE, "runs");
const SDK = process.env.ANDROID_HOME ?? path.join(os.homedir(), "Library/Android/sdk");
/** Le port du relais (celui que l'app appelle) et celui du faux backend, derrière. */
const PORT = Number(process.env.PERF_PORT ?? 3107);
const BACKEND_PORT = PORT + 10;

const [command, ...rest] = process.argv.slice(2);
const option = (name, fallback = null) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : fallback;
};
const flag = (name) => rest.includes(`--${name}`);

function latestSnapshot() {
  if (process.env.SNAPSHOT_DIR) return process.env.SNAPSHOT_DIR;
  const root = path.join(os.homedir(), "Library/Caches/tentacle-nav-golden/snapshots");
  const dirs = fs.readdirSync(root).map((name) => path.join(root, name)).filter((dir) => fs.existsSync(path.join(dir, "snapshot.json")));
  if (!dirs.length) throw new Error(`aucun instantané nav-golden dans ${root}`);
  return dirs.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

/** L'injecteur de touches (`keys/Keys.java`), compilé au besoin. */
function keysDex() {
  const source = path.join(HERE, "keys/Keys.java");
  const out = path.join(CACHE, "keys");
  const dex = path.join(out, "classes.dex");
  if (fs.existsSync(dex) && fs.statSync(dex).mtimeMs > fs.statSync(source).mtimeMs) return dex;
  fs.mkdirSync(out, { recursive: true });
  const platforms = fs.readdirSync(path.join(SDK, "platforms")).sort();
  const jar = path.join(SDK, "platforms", platforms[platforms.length - 1], "android.jar");
  const tools = fs.readdirSync(path.join(SDK, "build-tools")).sort();
  execFileSync("javac", ["-source", "1.8", "-target", "1.8", "-cp", jar, "-d", out, source], { stdio: "ignore" });
  execFileSync(path.join(SDK, "build-tools", tools[tools.length - 1], "d8"), ["--output", out, "--lib", jar, path.join(out, "Keys.class")]);
  return dex;
}

async function startBackend() {
  const log = fs.openSync(path.join(CACHE, "backend.log"), "w");
  const child = spawn(process.execPath, [path.join(HERE, "../nav-golden/server/fakeServer.mjs")], {
    env: { ...process.env, PORT: String(BACKEND_PORT), SNAPSHOT_DIR: latestSnapshot() },
    stdio: ["ignore", log, log],
  });
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    try {
      execFileSync("curl", ["-s", "-X", "POST", `http://127.0.0.1:${BACKEND_PORT}/__fixtures`, "-d", '{"sets":["base/vigie-off"]}'], { stdio: "ignore" });
      return child;
    } catch {
      // pas encore à l'écoute
    }
  }
  child.kill();
  throw new Error(`le faux backend ne répond pas sur ${BACKEND_PORT} — ${path.join(CACHE, "backend.log")}`);
}

/** Les jeux du faux backend d'un scénario (nav-golden `/__fixtures`). */
function applyFixtures(sets) {
  execFileSync("curl", ["-s", "-X", "POST", `http://127.0.0.1:${BACKEND_PORT}/__fixtures`, "-d", JSON.stringify({ sets })], { stdio: "ignore" });
}

async function playScenario(device, scenario, traceFile, shotFile) {
  applyFixtures(scenario.fixtures ?? ["base/vigie-off"]);
  device.forceStop();
  device.clearLog();
  const launchMs = device.launch();
  const ready = await device.waitReady("accueil", 45_000);
  if (!ready) throw new Error("l'accueil ne s'est jamais dit prêt (session ? faux backend ? mode de mesure ?)");
  if (scenario.cold) {
    await device.waitQuiet(1500);
    const round = summarizeRound(device.perfRecords(), cpuDelta({}, device.threadCpu()));
    return { ...round, launchMs };
  }
  await sleep(3000);
  device.keys(...(scenario.setup ?? []));
  await device.waitQuiet(1200);
  if (shotFile) device.screencap(shotFile);
  device.clearLog();
  device.gfxReset();
  const before = device.threadCpu();
  if (traceFile) startTrace(device, PACKAGE);
  device.keys(...scenario.gesture);
  await device.waitQuiet(1500);
  const after = device.threadCpu();
  const round = { ...summarizeRound(device.perfRecords(), cpuDelta(before, after)), gfx: device.gfxStats() };
  if (!traceFile) return round;
  const text = stopTrace(device);
  fs.writeFileSync(traceFile, text);
  return { ...round, trace: summarizeTrace(text) };
}

async function run() {
  const apk = option("apk");
  const debugApk = option("debug-apk");
  const tag = option("tag");
  if (!apk || !debugApk || !tag) throw new Error("usage : run --apk <release.apk> --debug-apk <debug.apk> --tag <nom> [--only a,b] [--rounds 3]");
  const rounds = Number(option("rounds", "3"));
  const scenarios = scenariosOf(option("only"));
  fs.mkdirSync(RUNS, { recursive: true });
  const device = createDevice();
  console.log(`appareil : ${device.describe()}`);
  device.pushKeys(keysDex());
  const backend = await startBackend();
  const proxy = await startImageProxy({ port: PORT, target: BACKEND_PORT, cacheDir: path.join(CACHE, "images"), resize: !flag("no-resize"), log: console.log });
  const results = [];
  try {
    await device.writeSession({ debugApk, port: PORT });
    device.install(apk);
    device.setPerf(true);
    // Un premier lancement écrit le profil ; puis la compilation qu'aurait faite le Play Store.
    device.forceStop();
    device.clearLog();
    device.launch();
    await device.waitReady("accueil", 60_000);
    device.forceStop();
    device.compileProfile();
    // L'échauffement, non mesuré : chaque scénario joué une fois. Le relais
    // retaille alors les images à la taille que CETTE version demande, et
    // l'app remplit son cache disque — toutes les versions se mesurent sur
    // des caches pleins, comme chez un utilisateur qui revient.
    for (const scenario of scenarios) await playScenario(device, scenario, null, null);
    console.log("échauffement fait");
    for (const scenario of scenarios) {
      const played = [];
      for (let i = 0; i < rounds; i++) {
        const traceFile = flag("trace") && i === 0 ? path.join(CACHE, "traces", `${tag}-${scenario.id}.txt`) : null;
        if (traceFile) fs.mkdirSync(path.dirname(traceFile), { recursive: true });
        // Une capture au moment où le geste part (l'état de départ, focus posé) : la preuve qu'une version rend comme l'autre.
        const shotFile = flag("shots") && i === 0 ? path.join(CACHE, "shots", `${tag}-${scenario.id}.png`) : null;
        if (shotFile) fs.mkdirSync(path.dirname(shotFile), { recursive: true });
        played.push(await playScenario(device, scenario, traceFile, shotFile));
        process.stdout.write(".");
      }
      const summary = summarizeScenario(scenario, played);
      results.push({ ...summary, rawRounds: played });
      console.log(`\n${describe(summary)}`);
    }
  } finally {
    device.setPerf(false);
    backend.kill();
    await proxy.close();
  }
  const file = path.join(RUNS, `${tag}.json`);
  fs.writeFileSync(file, JSON.stringify({ tag, apk, date: new Date().toISOString(), device: device.describe(), images: proxy.stats, results }, null, 2));
  console.log(`\nrésultats : ${file} · images servies ${proxy.stats.images} (${proxy.stats.resized} réduites, ${Math.round(proxy.stats.bytesOut / 1024)} Ko sur ${Math.round(proxy.stats.bytesIn / 1024)} Ko)`);
}

const load = (tag) => JSON.parse(fs.readFileSync(path.join(RUNS, `${tag}.json`), "utf8"));

/** Les captures de deux passages, scénario par scénario : SSIM et PSNR (ImageMagick), et l'image côte à côte. */
function diffShots(a, b) {
  const dir = path.join(CACHE, "shots");
  for (const name of fs.readdirSync(dir).filter((f) => f.startsWith(`${a}-`) && f.endsWith(".png"))) {
    const scenario = name.slice(a.length + 1, -4);
    const other = path.join(dir, `${b}-${scenario}.png`);
    if (!fs.existsSync(other)) continue;
    const metric = (kind) => {
      try {
        execFileSync("magick", ["compare", "-metric", kind, path.join(dir, name), other, "null:"], { stdio: ["ignore", "ignore", "pipe"] });
        return "identiques";
      } catch (error) {
        return String(error.stderr ?? "").trim();
      }
    };
    const side = path.join(dir, `cote-a-cote-${a}-${b}-${scenario}.png`);
    execFileSync("magick", [path.join(dir, name), other, "+append", side]);
    console.log(`${scenario} : SSIM ${metric("SSIM")} · PSNR ${metric("PSNR")} — ${side}`);
  }
}

async function main() {
  if (command === "run") return run();
  if (command === "show") return load(rest[0]).results.forEach((s) => console.log(describe(s)));
  if (command === "compare") return console.log(compareTable(load(rest[0]).results, load(rest[1]).results));
  if (command === "diff") return diffShots(rest[0], rest[1]);
  console.error("usage : bench.mjs run|show|compare|diff — voir l'en-tête du fichier");
  process.exit(2);
}

main().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
