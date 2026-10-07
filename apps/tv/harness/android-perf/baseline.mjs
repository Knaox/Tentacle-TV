#!/usr/bin/env node
// La MESURE DE DÉPART du mode Lite (lot Lite, L1) : chaque écran du parcours
// rejoué sur l'app de MESURE, et, en plus des images du banc (`bench.mjs`) :
// la mémoire du processus après le geste, les vues attachées, les images
// servies (donc décodées) pendant le passage — puis, effet par effet, le même
// geste avec cet effet COUPÉ (`debug.tentacle.fx`, lue par l'app de mesure
// seulement), et une navigation de 10 min pour la mémoire qui monte.
//
//   node apps/tv/harness/android-perf/baseline.mjs screens --apk <release.apk> --debug-apk <debug.apk> --tag <nom> [--only a,b] [--rounds 2] [--keep-session]
//   node apps/tv/harness/android-perf/baseline.mjs effects --tag <nom> --only focus-rangee,fiche --fx blur,glass,… [--rounds 2] [--keep-session --apk … --debug-apk …]
//   node apps/tv/harness/android-perf/baseline.mjs soak --tag <nom> [--minutes 10] [--keep-session --apk … --debug-apk …]
//   node apps/tv/harness/android-perf/baseline.mjs show <nom>
//
// Mêmes variables que le banc : ANDROID_SERIAL, PERF_PACKAGE (l'app de mesure
// sur une vraie Shield), PERF_PORT (le relais ; le faux backend à +10).
// Résultats : ~/Library/Caches/tentacle-android-perf/baseline/<nom>.json.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CACHE, keysDex, startBackend } from "./lib/benchSetup.mjs";
import { PACKAGE, createDevice, sleep } from "./lib/device.mjs";
import { ForegroundError, resumedPackage } from "./lib/keyGuard.mjs";
import { createHostPolicy } from "./lib/host.mjs";
import { startImageProxy } from "./lib/imageProxy.mjs";
import { createPlayer } from "./lib/play.mjs";
import { describe, summarizeScenario } from "./lib/report.mjs";
import { SCENARIOS, scenariosOf } from "./lib/scenarios.mjs";

const OUT = path.join(CACHE, "baseline");
const PORT = Number(process.env.PERF_PORT ?? 3107);
const BACKEND_PORT = Number(process.env.PERF_BACKEND_PORT ?? PORT + 10);

const [command, ...rest] = process.argv.slice(2);
const option = (name, fallback = null) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : fallback;
};
const flag = (name) => rest.includes(`--${name}`);

/** Les écrans du livrable, et les scénarios du banc qui les jouent. */
export const SCREENS = {
  demarrage: ["demarrage"],
  accueil: ["focus-rangee", "accueil-tenu", "rail", "heros"],
  bibliotheque: ["page-films", "grille"],
  fiche: ["fiche"],
  saisons: ["saisons-episodes"],
  recherche: ["recherche"],
  reglages: ["reglages"],
  lecteur: ["lecteur"],
};

const loadNow = () => Math.round(os.loadavg()[0] * 10) / 10;

async function withBench(fn) {
  fs.mkdirSync(OUT, { recursive: true });
  const device = createDevice();
  console.log(`appareil : ${device.describe()} — charge du Mac ${loadNow()}`);
  device.pushKeys(keysDex());
  const host = createHostPolicy(false);
  // `--external` : le faux backend et le relais tournent déjà (un faux
  // backend neuf sert son premier catalogue lentement, et la mise en place
  // des saisons y partait de la barre des filtres) ; pas de relevé d'images.
  const external = flag("external");
  const backend = external ? { kill: () => {} } : await startBackend(BACKEND_PORT);
  const proxy = external
    ? { stats: { log: [] }, close: async () => {} }
    : await startImageProxy({ port: PORT, target: BACKEND_PORT, cacheDir: path.join(CACHE, "images"), resize: true, log: console.log });
  const player = createPlayer({ device, backendPort: BACKEND_PORT, host });
  try {
    if (flag("keep-session")) {
      device.adb(["reverse", `tcp:${PORT}`, `tcp:${PORT}`]);
      if (option("apk")) await player.prepareApk(option("apk"));
      else device.setPerf(true);
    } else {
      const apk = option("apk");
      const debugApk = option("debug-apk");
      if (!apk || !debugApk) throw new Error("--apk et --debug-apk exigés (ou --keep-session)");
      await device.writeSession({ debugApk, port: PORT });
      await player.prepareApk(apk);
    }
    return await fn(device, player, proxy);
  } finally {
    device.setFx([]);
    device.setPerf(false);
    backend.kill();
    await proxy.close();
  }
}

/** L'adb RÉSEAU de la Shield tombe toutes les dix minutes environ : le
 *  rétablir (aucune touche). Sans effet sur un émulateur. */
function reconnect(device) {
  if (!device.serial.includes(":")) return;
  try {
    execFileSync(path.join(process.env.ANDROID_HOME ?? path.join(os.homedir(), "Library/Android/sdk"), "platform-tools/adb"), ["connect", device.serial], { stdio: "ignore", timeout: 20_000 });
  } catch {
    // le tour suivant le redira
  }
}

/** Les images servies entre deux instants : nombre, octets transférés, et
 *  octets DÉCODÉS (ARGB_8888 : 4 octets par pixel), par sorte d'image. */
function imagesBetween(log, from, to) {
  const byKind = {};
  for (const entry of log.filter((e) => e.at >= from && e.at <= to)) {
    const kind = (byKind[entry.kind] ??= { count: 0, bytes: 0, decoded: 0, largest: "" , largestPx: 0 });
    kind.count++;
    kind.bytes += entry.bytes;
    const px = entry.width * entry.height;
    kind.decoded += px * 4;
    if (px > kind.largestPx) {
      kind.largestPx = px;
      kind.largest = `${entry.width}×${entry.height}`;
    }
  }
  return byKind;
}

/** Un scénario joué, avec la mémoire et les vues relevées juste après le geste. */
async function playWithExtras(device, player, proxy, scenario) {
  const from = Date.now();
  const round = await player.playChecked(scenario, {});
  const memory = device.memory();
  const hierarchy = device.viewHierarchy();
  return { ...round, memory, hierarchy, images: imagesBetween(proxy.stats.log, from, Date.now()), load: loadNow() };
}

function summarizeExtras(rounds) {
  const avg = (pick) => rounds.reduce((n, r) => n + (pick(r) ?? 0), 0) / rounds.length;
  return {
    memory: Object.fromEntries(["pss", "java", "native", "graphics", "otherMtrack", "code", "privateOther", "views"].map((k) => [k, avg((r) => r.memory?.[k])])),
    views: avg((r) => r.hierarchy?.views),
    displayListKb: avg((r) => r.hierarchy?.displayListKb),
    images: rounds[0]?.images ?? {},
    load: Math.max(...rounds.map((r) => r.load ?? 0), ...rounds.flatMap((r) => r.hostLoad ?? [])),
  };
}

function save(name, data) {
  const file = path.join(OUT, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify({ date: new Date().toISOString(), ...data }, null, 2));
  console.log(`résultats : ${file}`);
}

async function screens() {
  const tag = option("tag");
  if (!tag) throw new Error("--tag exigé");
  const rounds = Number(option("rounds", "2"));
  const scenarios = scenariosOf(option("only") ?? Object.values(SCREENS).flat().join(","));
  await withBench(async (device, player, proxy) => {
    const results = [];
    // `--warmup` : chaque scénario joué une fois sans mesure. Un faux backend
    // neuf met plus de 10 s à servir son premier catalogue (« Chargement du
    // catalogue… » sur la Shield) : la mise en place des saisons partait
    // alors de la barre des filtres.
    if (flag("warmup")) await player.warmup(scenarios);
    // La première passe de chaque scénario est la seule où les images ne sont
    // pas encore dans le cache disque de l'app : les images DÉCODÉES se lisent là.
    for (const scenario of scenarios) {
      const played = [];
      for (let i = 0; i < rounds; i++) {
        played.push(await playWithExtras(device, player, proxy, scenario));
        process.stdout.write(".");
      }
      const summary = { ...summarizeScenario(scenario, played), ...summarizeExtras(played), rawRounds: played.map(({ records: _records, ...r }) => r) };
      results.push(summary);
      // Enregistré après CHAQUE écran : une passe coupée (garde, mise en place
      // ratée) garde ce qu'elle a mesuré.
      save(tag, { device: device.describe(), partial: true, results });
      console.log(`\n${describe(summary)}\n  mémoire (Mo) PSS ${(summary.memory.pss / 1024).toFixed(0)} · Java ${(summary.memory.java / 1024).toFixed(0)} · natif ${(summary.memory.native / 1024).toFixed(0)} · graphique ${(summary.memory.graphics / 1024).toFixed(0)} — ${Math.round(summary.views)} vues — charge ${summary.load}`);
    }
    save(tag, { device: device.describe(), images: { ...proxy.stats, log: undefined }, results });
  });
}

/** Le même geste, effet par effet coupé, en ALTERNANCE avec la référence
 *  (rien de coupé) : une dérive de l'appareil touche les deux à parts égales. */
async function effects() {
  const tag = option("tag");
  const fxList = (option("fx") ?? "").split(",").filter(Boolean);
  if (!tag || fxList.length === 0) throw new Error("--tag et --fx exigés");
  const rounds = Number(option("rounds", "2"));
  const scenarios = scenariosOf(option("only") ?? "focus-rangee");
  await withBench(async (device, player, proxy) => {
    const variants = ["aucun", ...fxList];
    const played = Object.fromEntries(variants.map((v) => [v, Object.fromEntries(scenarios.map((s) => [s.id, []]))]));
    for (let round = 0; round < rounds; round++) {
      for (const variant of round % 2 === 0 ? variants : [...variants].reverse()) {
        device.setFx(variant === "aucun" ? [] : variant.split("+"));
        for (const scenario of scenarios) {
          try {
            played[variant][scenario.id].push(await playWithExtras(device, player, proxy, scenario));
            process.stdout.write(".");
          } catch (error) {
            // La garde des touches ne se rattrape jamais ; un autre échec
            // (adb réseau tombé, accueil pas prêt) perd ce tour-là seulement.
            if (error instanceof ForegroundError) throw error;
            console.log(`\n${variant} ${scenario.id} : ${error.message} — tour perdu`);
            // L'adb RÉSEAU de la Shield tombe toutes les dix minutes environ :
            // on le rétablit avant le tour suivant (aucune touche ici).
            reconnect(device);
            await sleep(3000);
          }
        }
        console.log(` passe ${round + 1} ${variant} (charge ${loadNow()})`);
        // Enregistré à chaque variante : une passe coupée garde ses tours.
        save(`${tag}-tours`, { device: device.describe(), kind: "effects-raw", played: Object.fromEntries(Object.entries(played).map(([v, byId]) => [v, Object.fromEntries(Object.entries(byId).map(([id, rs]) => [id, rs.map(({ records: _records, ...r }) => r)]))])) });
      }
    }
    device.setFx([]);
    const results = Object.fromEntries(variants.map((v) => [v, scenarios.filter((s) => played[v][s.id].length > 0).map((s) => {
      const rs = played[v][s.id];
      return { ...summarizeScenario(s, rs), ...summarizeExtras(rs), rawRounds: rs.map(({ records: _records, ...r }) => r) };
    })]));
    save(tag, { device: device.describe(), kind: "effects", results });
    printEffects(results);
  });
}

function printEffects(results) {
  const base = results.aucun;
  for (const [variant, list] of Object.entries(results)) {
    for (const s of list) {
      const b = base.find((x) => x.id === s.id);
      if (!b) continue;
      const pct = (n, d) => ((100 * n) / Math.max(1, d)).toFixed(0);
      console.log(`${variant.padEnd(14)} ${s.id.padEnd(14)} ratées ${pct(s.janky, s.frames)} % (réf ${pct(b.janky, b.frames)}) · p95 ${s.worstP95.toFixed(0)} (réf ${b.worstP95.toFixed(0)}) · rendu ${Math.round(s.cpu.render ?? 0)} (réf ${Math.round(b.cpu.render ?? 0)}) · UI ${Math.round(s.cpu.ui ?? 0)} (réf ${Math.round(b.cpu.ui ?? 0)}) · JS ${Math.round(s.cpu.js ?? 0)} · cmd GPU ${Math.round(s.phases.issue)} (réf ${Math.round(b.phases.issue)}) · graphique ${(s.memory.graphics / 1024).toFixed(0)} Mo`);
    }
  }
}

/** Dix minutes de navigation (accueil, rangées, fiches, bibliothèque, recherche,
 *  réglages), la mémoire relevée au repos avant, toutes les minutes, et après. */
async function soak() {
  const tag = option("tag");
  const minutes = Number(option("minutes", "10"));
  if (!tag) throw new Error("--tag exigé");
  const loop = ["fiche", "page-films", "saisons-episodes", "focus-rangee", "recherche", "reglages", "accueil-tenu", "grille"].map((id) => SCENARIOS.find((s) => s.id === id));
  await withBench(async (device) => {
    device.forceStop();
    device.clearLog();
    device.launch();
    await device.waitReady("accueil", 45_000);
    await sleep(8000);
    const samples = [{ minute: 0, memory: device.memory(), hierarchy: device.viewHierarchy(), load: loadNow() }];
    console.log(`repos : PSS ${(samples[0].memory.pss / 1024).toFixed(0)} Mo`);
    const end = Date.now() + minutes * 60_000;
    const started = Date.now();
    const pid0 = device.pid();
    let next = 1;
    // Revenir à l'accueil SANS relancer le processus : Retour, un à la fois
    // (par la GARDE : l'injecteur relit le premier plan avant l'appui),
    // jusqu'à ce que l'app passe en arrière-plan (Retour sur l'accueil la
    // quitte), puis `am start` la ramène — même processus, comme un
    // utilisateur qui sort et revient. La lecture du premier plan ne lève
    // rien ici : une app sortie est le but ; aucune touche ne part après.
    const inForeground = () => resumedPackage(device.shell("dumpsys activity activities", { timeout: 30_000 })) === PACKAGE;
    const goHome = async () => {
      for (let i = 0; i < 6 && inForeground(); i++) {
        device.keys("tap:4");
        await sleep(1100);
      }
      device.launch();
      await sleep(3500);
      device.assertForeground();
    };
    while (Date.now() < end) {
      for (const scenario of loop) {
        if (Date.now() >= end) break;
        try {
          device.keys(...(scenario.setup ?? []), ...(scenario.gesture ?? []));
          await goHome();
        } catch (error) {
          if (error instanceof ForegroundError) throw error;
          // adb réseau tombé : rétabli, l'app ramenée par am start (jamais une touche).
          console.log(`${scenario.id} : ${error.message} — on reprend`);
          reconnect(device);
          await sleep(3000);
          device.launch();
          await sleep(3500);
        }
        if (Date.now() >= started + next * 60_000) {
          reconnect(device);
          const sample = { minute: next, memory: device.memory(), hierarchy: device.viewHierarchy(), load: loadNow(), samePid: device.pid() === pid0 };
          samples.push(sample);
          console.log(`${next} min : PSS ${(sample.memory.pss / 1024).toFixed(0)} Mo · Java ${(sample.memory.java / 1024).toFixed(0)} · natif ${(sample.memory.native / 1024).toFixed(0)} · graphique ${(sample.memory.graphics / 1024).toFixed(0)} · ${sample.hierarchy.views} vues · même processus ${sample.samePid}`);
          next++;
        }
      }
    }
    // Le repos après : l'accueil, rien qui bouge, 15 s.
    await sleep(15_000);
    samples.push({ minute: "repos-après", memory: device.memory(), hierarchy: device.viewHierarchy(), load: loadNow(), samePid: device.pid() === pid0 });
    console.log(`repos après : PSS ${(samples.at(-1).memory.pss / 1024).toFixed(0)} Mo`);
    save(tag, { device: device.describe(), kind: "soak", minutes, samples });
  });
}

async function main() {
  if (command === "screens") return screens();
  if (command === "effects") return effects();
  if (command === "soak") return soak();
  if (command === "show") return console.log(JSON.stringify(JSON.parse(fs.readFileSync(path.join(OUT, `${rest[0]}.json`), "utf8")), null, 1).slice(0, 20000));
  console.error("usage : baseline.mjs screens|effects|soak|show — voir l'en-tête");
  process.exit(2);
}

main().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
