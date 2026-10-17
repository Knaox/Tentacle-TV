#!/usr/bin/env node
// Banc de FLUIDITÉ de la navigation Apple TV (lot tvgrille, 18/10), sur les
// services de nav-golden (place, faux backend, Metro, agent XCUITest) et la
// sonde `probe/perfProbe.js`. Les chiffres se COMPARENT entre deux codes,
// mesurés dans les mêmes conditions (même place, même charge) — jamais une
// valeur d'appareil : le Mac rend l'Apple TV simulée.
//
//   node apps/tv/harness/nav-golden/perf.mjs <suite> --slot <n> [--at <rév>] [--label <nom>] [--runs 3]
//
//   rafale-accueil   rafales DROITE puis GAUCHE dans une rangée de l'accueil, puis BAS/HAUT entre rangées
//   rafale-grille    rafales dans la grille Films : 1re ligne (1re → dernière colonne), BAS/HAUT
//   latence          focus tenu sur des cartes : focus → fond affiché, focus → 1re image vidéo, sauts
//   lecteur          six cartes d'affilée avec aperçu : vues vidéo créées, retirées (lecteur unique)
//   memoire          5 min de navigation (accueil, grille) : mémoire native et JS toutes les 15 s
//   tout             les cinq
//
// Sortie : un résumé par suite dans le terminal, le relevé entier dans
// `out/perf/<label>-<suite>-<horodatage>.json`.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BenchError, OUT_DIR, benchContext, capture, say, sleep, step, warn } from "./lib/config.mjs";
import { agentRun, evaluate, perform } from "./lib/remote.mjs";
import { journalSeq, settle } from "./lib/observe.mjs";
import { coldStart, prepare, sessionSummary } from "./lib/session.mjs";
import { suites } from "./perf/suites.mjs";
import { summarize } from "./perf/analyze.mjs";

function parseArgs(argv) {
  const options = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const name = arg.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase());
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) options[name] = true;
    else {
      options[name] = next;
      i += 1;
    }
  }
  return { options, positional };
}

/** La mémoire résidente (Kio) du processus de l'app sur le simulateur de la place. */
export function appRss(udid) {
  const lines = (capture("ps", ["-axo", "pid=,rss=,command="]) ?? "").split("\n");
  const line = lines.find((l) => l.includes(udid) && /TentacleTV\.app\/TentacleTV(\s|$)/.test(l));
  if (!line) return null;
  const [pid, rss] = line.trim().split(/\s+/);
  return { pid: Number(pid), rssKb: Number(rss) };
}

/** Le contexte que chaque suite reçoit : gestes, sonde, attente, journal. */
function harness(ctx, session) {
  const probe = (expr) => evaluate(ctx, `globalThis.__perf.${expr}`, { timeoutMs: 30_000 });
  return {
    ctx,
    session,
    keys: (list) => agentRun(ctx, list, { timeoutMs: 120_000 }),
    sleep,
    // Comme `runner.mjs` : démarrage à froid, route poussée, approche geste par geste (app immobile entre deux).
    async start(start) {
      await coldStart(ctx, session, start);
      if (start.route) await evaluate(ctx, `globalThis.__navGolden.navigate(${JSON.stringify(start.route.name)}, ${JSON.stringify(start.route.params ?? null)}, false)`);
      const seq0 = await journalSeq(ctx);
      for (const gesture of start.keys ?? []) {
        const extra = await perform(ctx, gesture);
        await settle(ctx, { since: seq0, minMs: extra, quietMs: 300, timeoutMs: 6000 });
      }
      return settle(ctx, { since: seq0, minMs: 800, quietMs: 1500, timeoutMs: 30_000, nullQuietMs: 10_000 });
    },
    obs: async () => { const o = await evaluate(ctx, "globalThis.__navGolden.observe()"); return { ...o, focus: o?.focus?.key ?? null, frame: o?.focus?.frame ?? null }; },
    eval: (expr) => evaluate(ctx, expr, { timeoutMs: 30_000 }),
    arm: (mode = "fps", watch = null) => probe(`arm(${JSON.stringify(mode)}, ${JSON.stringify(watch)})`),
    async disarm() {
      await probe("disarm()");
      for (let i = 0; i < 40 && !(await probe("ready()")); i++) await sleep(100);
      return probe("report()");
    },
    heap: () => probe("heap()"),
    mounted: (pattern) => probe(`mounted(${JSON.stringify(pattern)})`),
    rss: () => appRss(session.device.udid),
    load: () => Math.round(os.loadavg()[0] * 10) / 10,
  };
}

async function main() {
  const [name = "help", ...rest] = process.argv.slice(2);
  const { options } = parseArgs(rest);
  const wanted = name === "tout" ? Object.keys(suites) : [name];
  if (!wanted.every((w) => suites[w])) {
    say(fs.readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1, 21).join("\n").replace(/^\/\/ ?/gm, ""));
    if (name !== "help") throw new BenchError(`suite inconnue : ${name}`);
    return;
  }
  const ctx = benchContext(options);
  const session = await prepare(ctx, { at: options.at ?? null, erase: options.erase !== false });
  sessionSummary(session);
  const label = options.label ?? (options.at ? String(options.at).slice(0, 9) : "courant");
  const runs = Number(options.runs ?? 1);
  const dir = path.join(OUT_DIR, "perf");
  fs.mkdirSync(dir, { recursive: true });
  const h = harness(ctx, session);
  for (const suite of wanted) {
    for (let run = 1; run <= runs; run++) {
      const load = h.load();
      if (load > 20) warn(`charge du Mac ${load} (> 20) : les images perdues sont faussées, le CPU et les créations de vues restent comparables`);
      step(`${suite} (${label}${runs > 1 ? `, passage ${run}/${runs}` : ""})`, `charge ${load}`);
      const raw = await suites[suite](h, options);
      const summary = summarize(suite, raw);
      const file = path.join(dir, `${label}-${suite}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      fs.writeFileSync(file, JSON.stringify({ suite, label, sha: session.checkout.sha ?? null, checkout: session.checkout.label, loadStart: load, loadEnd: h.load(), summary, raw }, null, 1));
      say(JSON.stringify(summary, null, 1));
      say(`    → ${path.relative(process.cwd(), file)}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof BenchError ? `✗ ${error.message}` : error.stack);
  process.exitCode = 2;
});
