#!/usr/bin/env node
// Banc de référence de la navigation Apple TV — une commande, depuis n'importe
// quel dossier de travail du dépôt. Mode d'emploi : docs/tv-navigation/banc.md.
//
//   node apps/tv/harness/nav-golden/nav-golden.mjs <commande> --slot <n> [cibles…]
//
//   record  [cibles] [--at <rév>] [--repeat 2]  enregistre la référence (défaut : la `reference` des fichiers)
//   verify  [cibles] [--at <rév>]               rejoue le dossier courant (ou <rév>) et compare
//   check   [cibles]                            valide les scénarios, sans simulateur
//   list                                        domaines, fichiers, scénarios, références
//   sets                                        les jeux de données (base et domaines)
//   up      [--at <rév>]  /  down [--sim-off]   prépare / arrête la place
//   start   <cible#id>                          démarre à froid sur l'entrée d'un scénario, affiche le relevé
//   do      <geste…>                            joue des gestes sur l'app en cours, affiche le relevé
//   obs                                         le relevé de l'app en cours
//   import-app <chemin.app> [--at <rév>]        range une build déjà faite dans le cache (par empreinte)
//
// Cibles : <domaine> · <domaine>/<fichier> · <domaine>#<id> · <domaine>/<fichier>#<id>.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { BenchError, SCENARIOS_DIR, benchContext, capture, duration, say, step, warn } from "./lib/config.mjs";
import { currentCheckout, referenceCheckout } from "./lib/checkout.mjs";
import { recordSuites, readGolden, verifySuites } from "./lib/golden.mjs";
import { importNativeApp } from "./lib/nativeApp.mjs";
import { journalSeq, settle } from "./lib/observe.mjs";
import { printResult, writeReport } from "./lib/report.mjs";
import { perform } from "./lib/remote.mjs";
import { listDomains, selectSuites } from "./lib/scenarios.mjs";
import { coldStart, prepare, sessionSummary } from "./lib/session.mjs";
import { stopAll } from "./lib/services.mjs";
import { findDevice } from "./lib/simulator.mjs";
import { loadSets } from "./server/fixtures.mjs";

function parseArgs(argv) {
  const options = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--no-erase") options.erase = false;
    else if (arg === "--sim-off") options.simOff = true;
    else if (arg.startsWith("--")) {
      const [key, inline] = arg.slice(2).split("=");
      options[key] = inline ?? argv[++i];
    } else positional.push(arg);
  }
  return { options, positional };
}

/** Les suites valides, ou une erreur qui les liste toutes. */
function validSuites(targets) {
  const suites = selectSuites(targets);
  const errors = suites.flatMap((s) => s.errors);
  if (errors.length) throw new BenchError(`scénarios invalides :\n  ${errors.join("\n  ")}`);
  return suites;
}

/** La référence d'un enregistrement : `--at`, sinon la `reference` (unique) des fichiers visés. */
function referenceOf(suites, at) {
  if (at) return at;
  const refs = [...new Set(suites.map((s) => readGoldenRef(s)).filter(Boolean))];
  if (refs.length === 1) return refs[0];
  throw new BenchError(refs.length ? `références différentes dans les fichiers visés (${refs.join(", ")}) : préciser --at` : "record exige --at <révision> (ou une « reference » dans les fichiers de scénarios)");
}
const readGoldenRef = (suite) => {
  try {
    return JSON.parse(fs.readFileSync(suite.path, "utf8")).reference ?? null;
  } catch {
    return null;
  }
};

async function runSuites(mode, options, targets) {
  const startedAt = Date.now();
  const suites = validSuites(targets);
  const ctx = benchContext(options);
  const at = mode === "record" ? referenceOf(suites, options.at) : options.at ?? null;
  const count = suites.reduce((n, s) => n + s.scenarios.length, 0);
  step(mode === "record" ? "Enregistrer" : "Vérifier", `${count} scénario(s) de ${[...new Set(suites.map((s) => s.domain))].join(", ")} — place ${ctx.ports.slot}, simulateur « ${ctx.sim} »`);
  const session = await prepare(ctx, { at, erase: options.erase !== false });
  sessionSummary(session);
  if (mode === "verify" && at === null && session.checkout.dirty) warn("le dossier courant a des modifications non commitées : elles sont rejouées telles quelles");
  const onResult = printResult;
  const results = mode === "record"
    ? await recordSuites(ctx, session, suites, { repeat: Number(options.repeat ?? 2), onResult })
    : await verifySuites(ctx, session, suites, { onResult });
  const failing = writeReport(mode, results, { session, startedAt });
  process.exitCode = failing ? 1 : 0;
}

async function interactive(command, options, positional) {
  const ctx = benchContext(options);
  if (command === "start") {
    const [suite] = validSuites([positional[0]]);
    const scenario = suite.scenarios[0];
    const session = await prepare(ctx, { at: options.at ?? null, erase: options.erase !== false });
    const obs = await coldStart(ctx, session, scenario.start ?? {});
    return say(JSON.stringify(obs, null, 2));
  }
  if (!findDevice(ctx.sim)) throw new BenchError(`pas de simulateur « ${ctx.sim} » : « up » ou « start » d'abord`);
  const since = await journalSeq(ctx);
  let extra = 0;
  for (const gesture of command === "do" ? positional : []) {
    extra = await perform(ctx, gesture);
    if (positional.length > 1) say(`  ${gesture} → ${JSON.stringify((await settle(ctx, { since, minMs: extra })).focus)}`);
  }
  const texts = options.texts ? String(options.texts).split(",") : [];
  const obs = await settle(ctx, { since, minMs: extra, texts });
  say(JSON.stringify(obs, null, 2));
}

async function main() {
  const [command = "help", ...rest] = process.argv.slice(2);
  const { options, positional } = parseArgs(rest);
  if (command === "record" || command === "verify") return runSuites(command, options, positional);
  if (command === "check") {
    const suites = selectSuites(positional);
    const errors = suites.flatMap((s) => s.errors);
    for (const s of suites) say(`  ${s.errors.length ? "✗" : "✓"} ${s.domain}/${s.name} — ${s.scenarios.length} scénario(s)`);
    if (errors.length) throw new BenchError(`${errors.length} erreur(s) :\n  ${errors.join("\n  ")}`);
    return say(`tout est valide (${suites.reduce((n, s) => n + s.scenarios.length, 0)} scénarios)`);
  }
  if (command === "list") {
    for (const domain of listDomains()) {
      let suites = [];
      try {
        suites = selectSuites([domain]);
      } catch {
        suites = [];
      }
      say(`${domain} — ${suites.length ? "" : "(aucun scénario)"}`);
      for (const s of suites) {
        const golden = readGolden(s.golden);
        const recorded = s.scenarios.filter((sc) => golden?.scenarios?.[sc.id]).length;
        say(`  ${s.name} : ${s.scenarios.length} scénario(s), ${recorded} enregistré(s)${golden ? ` sur ${golden.reference?.sha?.slice(0, 9)}` : ""}`);
      }
    }
    return undefined;
  }
  if (command === "sets") {
    const { sets, errors } = await loadSets(SCENARIOS_DIR);
    for (const [name, set] of sets) say(`  ${name}${set.description ? ` — ${set.description}` : ""}`);
    for (const error of errors) warn(error);
    return undefined;
  }
  if (command === "up") {
    const ctx = benchContext(options);
    const session = await prepare(ctx, { at: options.at ?? null, erase: options.erase !== false });
    return sessionSummary(session);
  }
  if (command === "down") {
    const ctx = benchContext(options);
    const stopped = await stopAll(ctx);
    step("Place", stopped.length ? `arrêtés : ${stopped.join(", ")}` : "rien ne tournait");
    const device = findDevice(ctx.sim);
    if (options.simOff && device?.state === "Booted") capture("xcrun", ["simctl", "shutdown", device.udid]);
    return undefined;
  }
  if (command === "import-app") {
    const checkout = options.at ? await referenceCheckout(options.at) : currentCheckout();
    const { fingerprint, app } = importNativeApp(positional[0], checkout);
    return step("App native", `rangée pour l'empreinte ${fingerprint} : ${app}`);
  }
  if (["start", "do", "obs"].includes(command)) return interactive(command, options, positional);
  const help = fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 20).join("\n").replace(/^\/\/ ?/gm, "");
  say(help);
  if (command !== "help") throw new BenchError(`commande inconnue : ${command}`);
  return undefined;
}

const began = Date.now();
main().catch((error) => {
  console.error(`✗ ${error instanceof BenchError ? error.message : error.stack ?? error.message}`);
  process.exitCode = 1;
}).finally(() => {
  if (process.env.NAV_GOLDEN_TIMING === "1") say(`(${duration(Date.now() - began)})`);
});
