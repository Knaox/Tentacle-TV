// Octave SOUS CEF : lance le proto (DevTools 9304, profil octave, en arrière-plan,
// verrou d'écran du lot), joue le scénario musique dans le VRAI front du banc, puis la
// bascule musique → vidéo → musique avec les couches comptées (`shell.debug.layers`).
// Relevé natif : `octave.debug.log` (appels reçus, évènements émis), `octave.debug.prop`.
// Son : `ao=null` + `mute=yes` (musique et vidéo), rien d'audible.
//
//   node web/shim/octave-cef.mjs      (après scripts/build.sh octave-app ; banc du pont lancé)
import { spawn } from "node:child_process";
import { mkdirSync, openSync, rmdirSync } from "node:fs";
import { join } from "node:path";

process.env.PONT_CDP_PORT ??= "9304";
const { Cdp, pageTarget } = await import("./dev/cdp.mjs");
const { scenario } = await import("./octave-scenario.mjs");
const { bascule } = await import("./octave-bascule.mjs");

const cache = process.env.TENTACLE_CEF_CACHE ?? join(process.env.HOME, ".cache/tentacle-cef");
const build = join(cache, "build", process.env.OCTAVE_BUILD ?? "octave-app");  // OCTAVE_BUILD=lecteur : un autre axe
const origin = "http://127.0.0.1:3471";
const appLog = join(build, "app.log");
const lock = join(cache, "locks/ecran");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Une seule fenêtre du proto à la fois : le verrou du lot (échec = attendre).
for (let i = 0; ; i++) {
  try { mkdirSync(lock); break; } catch {
    if (i === 0) console.log("verrou d'écran pris par une autre session : j'attends…");
    if (i > 600) { console.error("verrou d'écran toujours pris après 10 min"); process.exit(3); }
    await sleep(1000);
  }
}
// TENTACLE_APP : le .app à éprouver (recette) ; défaut : build/octave-app.
const bundle = process.env.TENTACLE_APP ?? join(build, "Tentacle.app");
const app = spawn(join(bundle, "Contents/MacOS/Tentacle"), [
  "--mute", `--url=${origin}/`, `--devtools-port=${process.env.PONT_CDP_PORT}`,
  `--profile=${join(cache, "profiles", process.env.OCTAVE_PROFILE ?? "octave")}`, "--background",
], { stdio: ["ignore", openSync(appLog, "w"), openSync(appLog, "a")], env: { ...process.env, TENTACLE_MUTE: "1" } });
let done = false;
const finish = async (code) => {
  if (done) return; done = true;
  try { app.kill("SIGTERM"); } catch { /* parti */ }
  await sleep(1500);
  try { app.kill("SIGKILL"); } catch { /* parti */ }
  try { rmdirSync(lock); } catch { /* déjà rendu */ }
  process.exit(code);
};
process.on("SIGINT", () => finish(130));
console.log(`proto lancé (pid ${app.pid}), journal ${appLog}`);

let target = null;
for (let i = 0; i < 100 && !target; i++) {
  await sleep(300);
  target = await pageTarget().catch(() => null);
}
if (!target) { console.error("pas de DevTools sur", process.env.PONT_CDP_PORT); await finish(2); }
const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
await cdp.send("Runtime.enable");

// L'environnement du scénario, par les canaux de diagnostic natifs d'octave.
const env = {
  calls: [], events: [], fromCall: 0, fromEvent: 0,
  async sync() {
    const log = await cdp.eval(`window.__shell.invoke("octave.debug.log", { fromCall: ${this.fromCall}, fromEvent: ${this.fromEvent} })`)
      .catch(() => null);
    if (!log) return;
    this.calls.push(...log.calls);
    this.events.push(...log.events);
    this.fromCall = log.callCount;
    this.fromEvent = log.eventCount;
  },
  prop: (name) => cdp.eval(`window.__shell.invoke("octave.debug.prop", { name: ${JSON.stringify(name)} })`),
  claim: () => cdp.eval(`window.__shell.invoke("octave.debug.claim", {})`),
};

let failures = 1;
try {
  await cdp.eval(`localStorage.setItem("tentacle_language", "fr"); true`).catch(() => null);
  failures = await scenario({ cdp, env, cache, origin });
  failures += await bascule({ cdp, env, cache, origin, appLog });
} catch (e) {
  console.error("scénario interrompu :", e);
}
// OCTAVE_DUMP=<fichier> : tout le relevé (appels du front, évènements du moteur), horodaté.
if (process.env.OCTAVE_DUMP)
  (await import("node:fs")).writeFileSync(process.env.OCTAVE_DUMP, JSON.stringify({ calls: env.calls, events: env.events }, null, 1));
console.log(`\nTOTAL : ${failures} échec(s)`);
await finish(failures === 0 ? 0 : 1);
