#!/usr/bin/env node
// Le banc de FLUIDITÉ d'Android TV : chaque animation de la refonte rejouée
// sur l'appareil (émulateur sous verrou, ou une Shield), mesurée par le mode
// de mesure de l'app (`debug.tentacle.perf`, journal `[perf-json]` : images,
// images ratées, phases de chaque image, rendus React) et par le temps
// processeur de chaque fil. Faux backend nav-golden derrière un relais qui
// sert les images à la taille demandée, comme Jellyfin : aucun compte réel.
//
//   node apps/tv/harness/android-perf/bench.mjs run --apk <release.apk> --debug-apk <debug.apk> --tag <nom> [--only a,b] [--rounds 3] [--trace] [--shots]
//   node apps/tv/harness/android-perf/bench.mjs ab --a <apk> --tag-a <nom> --b <apk> --tag-b <nom> --debug-apk <apk> [--only a,b] [--rounds 2] [--shots]
//     (deux versions en ALTERNANCE, contre la dérive de l'environnement)
//   `--slow` (run, ab) : l'émulateur sur les cœurs économes du Mac le temps
//     de chaque mesure — constantes, plus proches de la Shield (`lib/host.mjs`)
//   `--no-warmup` (run, ab) : sans échauffement, quand les caches sont déjà
//     chauds (images retaillées par le relais, cache disque de l'app)
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
import { createDevice, sleep } from "./lib/device.mjs";
import { createHostPolicy } from "./lib/host.mjs";
import { startImageProxy } from "./lib/imageProxy.mjs";
import { createPlayer } from "./lib/play.mjs";
import { compareTable, describe, summarizeScenario } from "./lib/report.mjs";
import { scenariosOf } from "./lib/scenarios.mjs";

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

/** Le faux backend, le relais d'images, la session et l'injecteur : ce que
 *  toute mesure partage. `fn(device, player, proxy)` mesure ; tout s'arrête après. */
async function withBench(debugApk, fn) {
  fs.mkdirSync(RUNS, { recursive: true });
  const device = createDevice();
  console.log(`appareil : ${device.describe()}`);
  device.pushKeys(keysDex());
  const host = createHostPolicy(flag("slow"), console.log);
  const backend = await startBackend();
  const proxy = await startImageProxy({ port: PORT, target: BACKEND_PORT, cacheDir: path.join(CACHE, "images"), resize: !flag("no-resize"), log: console.log });
  try {
    await device.writeSession({ debugApk, port: PORT });
    return await fn(device, createPlayer({ device, backendPort: BACKEND_PORT, host }), proxy);
  } finally {
    device.setPerf(false);
    host.restore();
    backend.kill();
    await proxy.close();
  }
}

/** Les fichiers de la passe `round` d'un scénario : trace et capture, à la première seulement. */
function filesOf(tag, scenario, round) {
  const of = (kind, ext, wanted) => {
    if (!wanted || round !== 0) return null;
    const file = path.join(CACHE, kind, `${tag}-${scenario.id}.${ext}`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    return file;
  };
  return { traceFile: of("traces", "txt", flag("trace")), shotFile: of("shots", "png", flag("shots")) };
}

function save(tag, apk, device, proxy, results) {
  const file = path.join(RUNS, `${tag}.json`);
  const host = { slow: flag("slow") };
  fs.writeFileSync(file, JSON.stringify({ tag, apk, date: new Date().toISOString(), device: device.describe(), host, images: proxy.stats, results }, null, 2));
  console.log(`résultats : ${file}`);
}

async function run() {
  const apk = option("apk");
  const debugApk = option("debug-apk");
  const tag = option("tag");
  if (!apk || !debugApk || !tag) throw new Error("usage : run --apk <release.apk> --debug-apk <debug.apk> --tag <nom> [--only a,b] [--rounds 3]");
  const rounds = Number(option("rounds", "3"));
  const scenarios = scenariosOf(option("only"));
  await withBench(debugApk, async (device, player, proxy) => {
    await player.prepareApk(apk);
    if (!flag("no-warmup")) {
      await player.warmup(scenarios);
      console.log("échauffement fait");
    }
    const results = [];
    for (const scenario of scenarios) {
      const played = [];
      for (let i = 0; i < rounds; i++) {
        played.push(await player.playChecked(scenario, filesOf(tag, scenario, i)));
        process.stdout.write(".");
      }
      const summary = summarizeScenario(scenario, played);
      results.push({ ...summary, rawRounds: played });
      console.log(`\n${describe(summary)}`);
    }
    save(tag, apk, device, proxy, results);
  });
}

/**
 * Deux versions mesurées en ALTERNANCE (A, B, puis B, A…) : une dérive de
 * l'environnement (une autre machine virtuelle, un build voisin) touche les
 * deux à parts égales. Chaque bascule réinstalle la version et recompile son
 * profil ; la session et les caches de l'app restent.
 */
async function ab() {
  const apks = { [option("tag-a")]: option("a"), [option("tag-b")]: option("b") };
  const tags = Object.keys(apks);
  const debugApk = option("debug-apk");
  if (tags.length !== 2 || tags.some((t) => !t || !apks[t]) || !debugApk) throw new Error("usage : ab --a <apk> --tag-a <nom> --b <apk> --tag-b <nom> --debug-apk <apk> [--only a,b] [--rounds 2]");
  const rounds = Number(option("rounds", "2"));
  const scenarios = scenariosOf(option("only"));
  await withBench(debugApk, async (device, player, proxy) => {
    for (const tag of flag("no-warmup") ? [] : tags) {
      await player.prepareApk(apks[tag]);
      await player.warmup(scenarios);
      console.log(`échauffement ${tag} fait`);
    }
    const played = Object.fromEntries(tags.map((tag) => [tag, Object.fromEntries(scenarios.map((s) => [s.id, []]))]));
    for (let round = 0; round < rounds; round++) {
      for (const tag of round % 2 === 0 ? tags : [...tags].reverse()) {
        await player.prepareApk(apks[tag]);
        for (const scenario of scenarios) {
          played[tag][scenario.id].push(await player.playChecked(scenario, filesOf(tag, scenario, round)));
          process.stdout.write(".");
        }
        console.log(` passe ${round + 1} ${tag} (charge du Mac ${os.loadavg()[0].toFixed(1)})`);
      }
    }
    for (const tag of tags) {
      const results = scenarios.map((scenario) => ({ ...summarizeScenario(scenario, played[tag][scenario.id]), rawRounds: played[tag][scenario.id] }));
      save(tag, apks[tag], device, proxy, results);
    }
  });
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
  if (command === "ab") return ab();
  if (command === "show") return load(rest[0]).results.forEach((s) => console.log(describe(s)));
  if (command === "compare") return console.log(compareTable(load(rest[0]).results, load(rest[1]).results));
  if (command === "diff") return diffShots(rest[0], rest[1]);
  console.error("usage : bench.mjs run|ab|show|compare|diff — voir l'en-tête du fichier");
  process.exit(2);
}

main().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
