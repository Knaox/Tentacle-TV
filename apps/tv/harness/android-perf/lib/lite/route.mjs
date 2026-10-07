// Le PARCOURS du banc Lite : sur un appareil faible (AVD `Lite_*`, ou une box
// réelle par `ANDROID_SERIAL`), l'app de mesure jouée écran par écran, et
// tout ce qui dit si elle y tient :
//
// 1. démarrage à froid jusqu'à un accueil PRÊT (`prêt:accueil`, mode de mesure) ;
// 2. mémoire AU REPOS : l'accueil chargé, 10 s sans rien toucher ;
// 3. chaque écran (`LITE_ROUTE`, scénarios de `scenarios.mjs`) : images et
//    images ratées (FrameMetrics et gfxinfo, avec la part du fil UI), temps
//    processeur par fil (UI, JS, rendu, images), mémoire après le geste ;
// 4. ENDURANCE : la navigation enchaînée sans relancer, la mémoire après
//    chaque tour (une fuite se lit à la pente) ;
// 5. au besoin, une trace Perfetto (démarrage, premier tour) et la pression
//    mémoire (`onTrimMemory`, puis un mangeur de mémoire native).
//
// Tout part dans un dossier daté, `resume.json` en tête ; `compareRuns`
// met deux dossiers face à face.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertPortFree, CACHE, keysDex, startBackend } from "../benchSetup.mjs";
import { createDevice, PACKAGE, sleep } from "../device.mjs";
import { startImageProxy } from "../imageProxy.mjs";
import { createPlayer, SetupError } from "../play.mjs";
import { summarizeScenario } from "../report.mjs";
import { scenariosOf } from "../scenarios.mjs";
import { createCapture, startPerfetto } from "./capture.mjs";
import { compareLite, describeLite } from "./liteReport.mjs";
import { pushHog, startHog, trimMemory } from "./pressure.mjs";
import { applyThrottle, hostLoad, qemuPidOf } from "./throttle.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const LITE_RUNS = path.join(CACHE, "lite");
const PORT = Number(process.env.PERF_PORT ?? 3111);
const BACKEND_PORT = Number(process.env.PERF_BACKEND_PORT ?? PORT + 10);
/** Au-delà, une passe ne se compare plus : on la refait (consigne du lot). */
export const MAX_HOST_LOAD = 30;

/** Les écrans du parcours, dans l'ordre : accueil, bibliothèque, fiche, saisons, recherche, réglages, lecteur. */
export const LITE_ROUTE = ["focus-rangee", "accueil-pas", "rail", "page-films", "grille", "fiche", "saisons-episodes", "recherche", "reglages", "lecteur"];

/**
 * Un tour d'endurance, sans relancer : des SEGMENTS qui partent du contenu de
 * l'accueil et y reviennent, chacun vérifié par l'écran où il doit finir
 * (`écran:<route>` du mode de mesure). Une dérive arrête l'endurance — jamais
 * de touches jouées à l'aveugle sur un autre écran.
 *
 * - rangées : BAS, 5 pas à droite puis à gauche, BAS et HAUT tenus ;
 * - fiche : depuis le héros (HAUT tenu y ramène), DROITE ×3 (le dernier
 *   bouton, quel que soit le départ) puis GAUCHE : « Plus d'infos » ; OK, 3
 *   sections, Retour ;
 * - Films : Retour sur l'accueil ouvre le rail sur « Accueil » ; Films est
 *   5 crans plus bas ; 6 rangées de la grille vers le bas puis vers le haut
 *   (des pas comptés : après une tenue, la grille n'est pas revenue en haut et
 *   la suite dérive — vécu), puis Retour, qui ouvre le rail sur « Films »
 *   (règle du Retour des pages du rail, la même que l'Apple TV —
 *   nav-golden `retour-rail/retour-pages#bibliotheque-retour-x3` : la page
 *   ne s'empile plus sur l'accueil, un 2e Retour irait aux Réglages et un 3e
 *   quitterait l'app) ; 5 crans vers le haut jusqu'à « Accueil », OK.
 */
export const ENDURANCE_SEGMENTS = [
  { id: "rangees", expect: "Home", keys: ["tap:20", "wait:900", "tap:22x5@500", "wait:600", "tap:21x5@500", "wait:600", "hold:20:2500", "wait:900", "hold:19:3500", "wait:1200"] },
  { id: "fiche", expect: "Home", through: "MediaDetail", keys: ["tap:22x3@450", "wait:600", "tap:21", "wait:700", "tap:23", "wait:3500", "tap:20x3@700", "wait:900", "tap:4", "wait:2500"] },
  { id: "films", expect: "Home", through: "Library", keys: ["wait:1500", "tap:4", "wait:1800", "tap:20x5@450", "wait:2000", "tap:23", "wait:4500", "tap:20x6@450", "wait:900", "tap:19x6@450", "wait:1500", "tap:4", "wait:1800", "tap:19x5@450", "wait:1500", "tap:23", "wait:3500"] },
];

export function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** Le faux backend, le relais d'images, la session écrite, l'injecteur : ce que tout passage partage. */
export async function withLiteBench({ apk, debugApk, keepSession = false }, fn) {
  if (!PACKAGE.endsWith(".perf")) throw new Error(`le banc Lite ne mesure que l'app de mesure (PERF_PACKAGE=…perf), pas ${PACKAGE}`);
  assertPortFree(PORT);
  const device = createDevice();
  device.pushKeys(keysDex());
  const backend = await startBackend(BACKEND_PORT);
  const proxy = await startImageProxy({ port: PORT, target: BACKEND_PORT, cacheDir: path.join(CACHE, "images"), resize: true, log: () => {} });
  try {
    if (keepSession) device.adb(["reverse", `tcp:${PORT}`, `tcp:${PORT}`]);
    else await device.writeSession({ debugApk, port: PORT });
    if (apk) device.install(apk);
    return await fn(device, proxy);
  } finally {
    device.setPerf(false);
    backend.kill();
    await proxy.close();
  }
}

/** Mise en place seule, pour explorer à la main : la session, l'APK, le faux backend jusqu'à Ctrl+C. */
export async function setupOnly({ apk, debugApk }) {
  if (!apk || !debugApk) throw new Error("setup <avd> --apk <release.apk> --debug-apk <debug.apk>");
  await withLiteBench({ apk, debugApk }, async (device) => {
    device.setPerf(true);
    console.log(`${device.describe()} — ${PACKAGE} prêt ; faux backend ${BACKEND_PORT}, relais ${PORT} — Ctrl+C pour arrêter`);
    await new Promise((resolve) => {
      process.on("SIGINT", resolve);
      process.on("SIGTERM", resolve);
    });
  });
}

/** Le coût d'une lecture (son décodé, sous-titres rendus), jeu par jeu — `playCost.mjs`. */
export async function runPlayCost({ avd, option }) {
  const { measurePlayCost, PLAY_COST_SETS } = await import("./playCost.mjs");
  const apk = option("apk");
  const debugApk = option("debug-apk");
  if (!apk || !debugApk) throw new Error("cout run <avd> --apk <release.apk> --debug-apk <debug.apk> [--sets aac,truehd] [--throttle duty:25] [--window 20]");
  const sets = option("sets") ? option("sets").split(",") : PLAY_COST_SETS;
  const spec = option("throttle", "none");
  const dir = path.join(LITE_RUNS, `${stamp()}-cout-${spec.replace(/[^a-z0-9]/gi, "")}`);
  fs.mkdirSync(dir, { recursive: true });
  const log = (line) => {
    console.log(line);
    fs.appendFileSync(path.join(dir, "journal.txt"), `${line}\n`);
  };
  await withLiteBench({ apk: null, debugApk }, async (device) => {
    const player = createPlayer({ device, backendPort: BACKEND_PORT, host: { measuring: (fn) => fn() } });
    await player.prepareApk(apk);
    const applyFixtures = (sets) => player.applyFixtures(sets);
    log(`appareil : ${device.describe()} · ${avd ?? device.serial} · freinage ${spec} · charge du Mac ${hostLoad()}`);
    const results = await measurePlayCost({ device, applyFixtures, sets, spec, windowS: Number(option("window", "20")), dir, log });
    fs.writeFileSync(path.join(dir, "resume.json"), JSON.stringify({ avd, throttle: spec, date: new Date().toISOString(), results }, null, 1));
    log(`→ ${dir}`);
  });
}

/** La mémoire de l'app et du système, avec la charge du Mac au moment du relevé. */
function memorySample(capture, label) {
  return { label, at: new Date().toISOString(), hostLoad: hostLoad(), app: capture.meminfo(), system: capture.system() };
}

export async function runRoute({ avd, option, flag }) {
  const apk = option("apk");
  const debugApk = option("debug-apk");
  const tag = option("tag");
  if (!apk || !debugApk || !tag) throw new Error("parcours run <avd> --apk <release.apk> --debug-apk <debug.apk> --tag <nom>");
  const rounds = Number(option("rounds", "2"));
  const coldRuns = Number(option("cold", "3"));
  const loops = Number(option("endurance", "3"));
  const spec = option("throttle", "none");
  // `--tier lite|normal` : le niveau de rendu forcé pendant la passe (L5a) ;
  // `--shots` : une capture de chaque écran après son geste (différentiel visuel).
  const tier = option("tier", null);
  const ids = option("only") ? option("only").split(",") : LITE_ROUTE;
  const scenarios = scenariosOf(ids.join(","));
  const dir = path.join(LITE_RUNS, `${stamp()}-${tag}`);
  fs.mkdirSync(dir, { recursive: true });
  const log = (line) => {
    console.log(line);
    fs.appendFileSync(path.join(dir, "journal.txt"), `${line}\n`);
  };

  await withLiteBench({ apk: null, debugApk }, async (device, proxy) => {
    const capture = createCapture(device.serial, PACKAGE);
    const player = createPlayer({ device, backendPort: BACKEND_PORT, host: { measuring: (fn) => fn() } });
    // Avant l'installation et l'échauffement : chaque lancement lit le niveau forcé.
    if (tier) device.setTier(tier);
    log(`appareil : ${device.describe()} · ${avd ?? device.serial} · freinage ${spec} · niveau ${tier ?? "auto"} · charge du Mac ${hostLoad()}`);
    await player.prepareApk(apk);
    if (!flag("no-warmup")) await player.warmup(scenarios);
    // Le freinage ne couvre que la MESURE : l'installation et l'échauffement restent rapides.
    const lift = device.serial.startsWith("emulator-") ? applyThrottle(qemuPidOf(device.serial), spec) : () => {};
    const result = { tag, tier, avd, device: device.describe(), throttle: spec, date: new Date().toISOString(), apk, cold: [], memory: [], screens: [], endurance: [], pressure: null, traces: [] };
    try {
      // 1. Démarrage à froid.
      const cold = scenariosOf("demarrage")[0];
      for (let i = 0; i < coldRuns; i++) {
        const round = await player.playScenario(cold);
        result.cold.push({ launchMs: round.launchMs, readyMs: round.readyMs, hostLoad: round.hostLoad, cpu: round.cpu });
        log(`froid ${i + 1} : première image ${round.launchMs} ms, accueil prêt ${Math.round(round.readyMs ?? NaN)} ms (charge ${round.hostLoad.join(" → ")})`);
      }
      // 2. Mémoire au repos (et trace Perfetto du démarrage).
      device.forceStop();
      const coldTrace = flag("perfetto") ? startPerfetto(device.serial, PACKAGE, 60_000) : null;
      device.clearLog();
      device.launch();
      await device.waitReady("accueil", 60_000);
      await sleep(10_000);
      if (coldTrace) result.traces.push(await coldTrace.stop(path.join(dir, "demarrage.pftrace")));
      result.memory.push(memorySample(capture, "repos"));
      if (flag("shots")) device.screencap(path.join(dir, "accueil.png"));
      log(`repos : PSS ${result.memory[0].app.totalPss} Mo (Java ${result.memory[0].app.javaHeap}, natif ${result.memory[0].app.nativeHeap}, graphique ${result.memory[0].app.graphics}) · système dispo ${result.memory[0].system.availableMb} Mo`);
      // 3. Écran par écran.
      for (const scenario of scenarios) {
        const played = [];
        try {
          for (let i = 0; i < rounds; i++) {
            const round = await player.playChecked(scenario);
            played.push({ ...round, gfxFull: capture.gfx(), memory: capture.meminfo() });
          }
        } catch (error) {
          // Une mise en place ratée deux fois : l'écran n'est pas mesuré, le
          // parcours continue. Toute autre erreur (la garde des touches
          // comprise) arrête tout.
          if (!(error instanceof SetupError)) throw error;
          // La capture de l'écran où la mise en place s'est arrêtée.
          device.screencap(path.join(dir, `${scenario.id}-echec.png`));
          result.screens.push({ id: scenario.id, title: scenario.title, skipped: error.message });
          log(`${scenario.id} — NON MESURÉ : ${error.message}`);
          continue;
        }
        if (flag("shots")) {
          await sleep(1500);
          device.screencap(path.join(dir, `${scenario.id}.png`));
        }
        const summary = summarizeScenario(scenario, played);
        const screen = { ...summary, gfxFull: played.map((r) => r.gfxFull), memory: played.map((r) => r.memory), rawRounds: played.map(({ records: _records, ...r }) => r) };
        result.screens.push(screen);
        log(describeLite(screen));
      }
      // 4. Endurance, sans relancer.
      device.forceStop();
      device.launch();
      await device.waitReady("accueil", 60_000);
      await sleep(3000);
      result.endurance.push(memorySample(capture, "tour 0"));
      for (let loop = 1; loop <= loops; loop++) {
        const trace = flag("perfetto") && loop === 1 ? startPerfetto(device.serial, PACKAGE, 240_000) : null;
        const drift = await playEndurance(device);
        if (trace) result.traces.push(await trace.stop(path.join(dir, "endurance-tour1.pftrace")));
        if (!device.pid()) {
          log(`endurance : l'app est MORTE au tour ${loop}`);
          result.endurance.push({ label: `tour ${loop}`, died: true });
          break;
        }
        if (drift) {
          device.screencap(path.join(dir, `endurance-derive-tour${loop}.png`));
          log(`endurance : dérive au tour ${loop} — ${drift} ; arrêt de l'endurance`);
          result.endurance.push({ label: `tour ${loop}`, drift });
          break;
        }
        result.endurance.push(memorySample(capture, `tour ${loop}`));
        const last = result.endurance[result.endurance.length - 1];
        log(`endurance tour ${loop} : PSS ${last.app.totalPss} Mo (Java ${last.app.javaHeap}, natif ${last.app.nativeHeap}, graphique ${last.app.graphics}, vues ${last.app.views})`);
      }
      // 5. Pression mémoire.
      if (flag("pressure")) result.pressure = await applyPressure(device, capture, log);
    } catch (error) {
      result.aborted = error.message;
      log(`✗ parcours interrompu : ${error.message}`);
      throw error;
    } finally {
      lift();
      if (tier) device.setTier("auto");
      // Même interrompu, ce qui a été mesuré est gardé (`aborted` le dit).
      result.images = proxy.stats;
      result.maxHostLoad = Math.max(0, ...result.cold.flatMap((c) => c.hostLoad ?? []), ...result.screens.map((s) => s.hostLoad ?? 0));
      fs.writeFileSync(path.join(dir, "resume.json"), JSON.stringify(result, null, 1));
      if (result.maxHostLoad > MAX_HOST_LOAD) log(`⚠ charge du Mac jusqu'à ${result.maxHostLoad} (> ${MAX_HOST_LOAD}) : passe à refaire avant de comparer`);
      log(`→ ${dir}`);
    }
  });
}

/** Un tour d'endurance ; rend la dérive (texte) ou null. */
export async function playEndurance(device) {
  let screen = device.screens().at(-1) ?? "Home";
  for (const segment of ENDURANCE_SEGMENTS) {
    device.clearLog();
    device.keys(...segment.keys);
    await device.waitQuiet(1200, 6000);
    const visited = device.screens();
    screen = visited.at(-1) ?? screen;
    if (segment.through && !visited.includes(segment.through)) return `segment « ${segment.id} » n'est pas passé par ${segment.through} (${visited.join(" → ") || "aucun écran"})`;
    if (screen !== segment.expect) return `segment « ${segment.id} » fini sur ${screen}, attendu ${segment.expect}`;
  }
  return null;
}

/** `onTrimMemory` puis 600 Mo de mémoire native prise à côté : l'app survit-elle, que rend-elle ? */
async function applyPressure(device, capture, log) {
  const before = memorySample(capture, "avant pression");
  const out = { before, trims: [], hog: null };
  for (const level of ["RUNNING_LOW", "RUNNING_CRITICAL"]) {
    let error = null;
    try {
      trimMemory(device.serial, PACKAGE, level);
    } catch (e) {
      error = e.message;
    }
    await sleep(3000);
    out.trims.push({ level, error, after: memorySample(capture, `après ${level}`) });
    log(`trim ${level} : ${error ?? `PSS ${out.trims.at(-1).after.app.totalPss} Mo`}`);
  }
  pushHog(device.serial, CACHE, path.join(HERE, "../../keys/Hog.java"));
  const megabytes = Math.max(128, Math.round((capture.system().availableMb ?? 600) * 0.8 / 16) * 16);
  device.clearLog();
  const hog = startHog(device.serial, megabytes, 20, 150);
  await hog.done;
  const alive = Boolean(device.pid());
  out.hog = { megabytes, alive, kills: capture.lmkKills().slice(-20), after: alive ? memorySample(capture, "après mangeur") : null };
  log(`mangeur de ${megabytes} Mo : l'app ${alive ? "a survécu" : "a été TUÉE"} (${out.hog.kills.length} morts relevées)`);
  return out;
}

export function compareRuns(a, b) {
  const load = (dir) => JSON.parse(fs.readFileSync(path.join(path.isAbsolute(dir) ? dir : path.join(LITE_RUNS, dir), "resume.json"), "utf8"));
  console.log(compareLite(load(a), load(b)));
}
