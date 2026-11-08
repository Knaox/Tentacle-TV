#!/usr/bin/env node
// pnpm dev:update -- --severity=minor|major|critical [--broken] [--scenario] [--app=…] [--rate=Mo/s]
//
// Sert un faux flux de mise à jour LOCAL (Node, 127.0.0.1, archive signée avec une clé de
// TEST de ~/.cache/tentacle-cef/update-test/) et lance l'app construite dessus (--mute,
// DevTools 9315), installée dans une copie à la version 1.0.0 — jamais l'app du build.
//   sans --scenario : l'app reste ouverte, à vous de cliquer ; Ctrl+C arrête tout ;
//   --scenario      : le parcours est joué et vérifié de bout en bout (bench/update/scenarios.mjs),
//                     jusqu'au redémarrage sur la nouvelle version.
//   --broken        : la nouvelle version s'arrête au démarrage → retour arrière (avec major).
//   --preflight     : vérifie seulement, SANS FENÊTRE, que l'app peut démarrer (à faire avant de
//                     prendre le verrou d'écran) ; c'est aussi la première chose que fait le banc.
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { BASE_VERSION, CACHE, DIR, RELEASES, appCopy, archive, envelope, serve, testKey } from "./feed.mjs";
import { INSTALL, STATE, killAll, pids, sleep } from "./app.mjs";
import { preflight } from "./preflight.mjs";
import * as scenarios from "./scenarios.mjs";

const opt = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith("--"))
  .map((a) => { const [k, v] = a.slice(2).split("="); return [k, v ?? true]; }));
const severity = opt.severity || "major";
if (!RELEASES[severity]) {
  console.error("--severity=minor|major|critical");
  process.exit(64);
}
const broken = !!opt.broken;
const appSrc = path.resolve(opt.app || path.join(CACHE, "build/maj/Tentacle.app"));
if (!existsSync(path.join(appSrc, "Contents/MacOS/tentacle-update"))) {
  console.error(`app construite introuvable ou sans assistant : ${appSrc}\n  → scripts/build.sh maj`);
  process.exit(1);
}
const problems = preflight(appSrc);
if (problems.length) {
  console.error(`[maj] ${appSrc} ne peut pas démarrer (dyld) :\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`);
  process.exit(3);
}
if (opt.preflight) {
  console.log(`[maj] ${appSrc} : chargement résolu`);
  process.exit(0);
}
const port = Number(opt.port || 8475);

// Le banc Tentacle (1.42 sur :3471) s'il répond, sinon la page de test du socle.
let url = opt.url;
if (!url) {
  try { if ((await fetch("http://127.0.0.1:3471", { signal: AbortSignal.timeout(1500) })).ok) url = "http://127.0.0.1:3471"; } catch { /* banc absent */ }
}

console.log(`[maj] ${severity}${broken ? " (version cassée)" : ""} : ${BASE_VERSION} → ${RELEASES[severity].version}, flux http://127.0.0.1:${port}`);
const key = testKey();
const { name, file } = archive(appSrc, severity, { broken });
const feedJson = envelope(key, severity, port, file, name);
await killAll();
appCopy(appSrc, INSTALL, BASE_VERSION);
rmSync(path.join(path.dirname(INSTALL), ".Tentacle.app.previous"), { recursive: true, force: true });
rmSync(STATE, { recursive: true, force: true });
mkdirSync(path.join(CACHE, "profiles/maj"), { recursive: true });

const quiet = !!opt.scenario && !opt.verbose;
const server = await serve({
  port, feedJson, archiveFile: file, archiveName: name, rate: Number(opt.rate || 25) * 1e6,
  cutFirst: severity === "critical", log: quiet ? () => {} : console.log,
});
const env = {
  feedUrl: `http://127.0.0.1:${port}/stable.json`, deadFeedUrl: `http://127.0.0.1:${port + 1}/stable.json`,
  publicKey: key.publicKey, url, profile: path.join(CACHE, "profiles/maj"),
  previous: path.join(path.dirname(INSTALL), ".Tentacle.app.previous"),
};

async function stop(code) {
  await killAll();
  server.close();
  process.exit(code);
}
process.on("SIGINT", () => stop(130));

if (opt.scenario) {
  const run = broken ? scenarios.rollback : scenarios[severity];
  const t0 = Date.now();
  try {
    await run(env);
    console.log(`[maj] parcours ${broken ? "retour arrière" : severity} : RÉUSSI en ${Math.round((Date.now() - t0) / 1000)} s`);
    await stop(0);
  } catch (e) {
    console.error(`[maj] parcours ${severity} : ${e.message}\n  journaux : ${DIR}/app.log, ${STATE}/helper.log`);
    await stop(1);
  }
} else {
  const { launch } = await import("./app.mjs");
  launch(env);
  console.log(`[maj] app lancée (${INSTALL}), DevTools ${9315}, état ${STATE}`);
  console.log("[maj] Ctrl+C pour tout arrêter (l'app relancée par l'assistant comprise).");
  for (;;) {
    await sleep(5000);
    if (!pids().length && !quiet) console.log("[maj] aucune instance ouverte (relance en cours, ou app fermée)");
  }
}
