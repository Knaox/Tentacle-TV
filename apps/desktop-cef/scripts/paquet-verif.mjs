// Vérifie qu'un paquet tient debout après un retrait (propriétaire : paquet). Sous le verrou
// d'écran du lot, en arrière-plan, son coupé (`--mute` en tête + TENTACLE_MUTE=1) :
//   1. démarrage, front du banc chargé, connexion par le vrai formulaire si besoin ;
//   2. aucune bibliothèque chargée depuis /opt/homebrew ni le cache (paquet autonome) ;
//   3. scénario vidéo du pont : HDR10, Dolby Vision, SDR (lecture, pistes, plein écran, fin) ;
//   4. scénario musique d'Octave + bascule musique → vidéo → musique.
//   node scripts/paquet-verif.mjs <App.app> [--video-only|--music-only|--bloc=demarrage|hdr10|dv|sdr|musique]
// --bloc : un seul scénario par lancement, pour tenir le verrou d'écran quelques minutes
// seulement (les étapes 1 et 2 sont refaites à chaque bloc) ; « demarrage » = étapes 1 et 2
// seules, SANS le verrou (ordre du lot : rien sous verrou qui se fasse sans fenêtre).
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, openSync, rmdirSync, writeFileSync } from "node:fs";
import { format } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.PONT_CDP_PORT = "9312";  // port DevTools de l'axe paquet
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shim = join(root, "web/shim");
const { Cdp, pageTarget } = await import(join(shim, "dev/cdp.mjs"));
const { scenario } = await import(join(shim, "octave-scenario.mjs"));
const { bascule } = await import(join(shim, "octave-bascule.mjs"));

const appPath = process.argv[2];
const only = process.argv[3] ?? "";
const titles = { hdr10: "Banc HDR10 Pistes (2026)", dv: "Banc Dolby Vision Pistes (2026)", sdr: "Banc Pistes SDR (2026)" };
const bloc = only.startsWith("--bloc=") ? only.slice(7) : "";
if (bloc && !(bloc in titles) && bloc !== "musique" && bloc !== "demarrage") { console.error(`bloc inconnu : ${bloc}`); process.exit(2); }
const videos = bloc ? (titles[bloc] ? [titles[bloc]] : []) : only === "--music-only" ? [] : Object.values(titles);
const music = bloc ? bloc === "musique" : only !== "--video-only";
const cache = process.env.TENTACLE_CEF_CACHE ?? join(process.env.HOME, ".cache/tentacle-cef");
const origin = "http://127.0.0.1:3471";
const out = join(cache, "paquet/verif", new Date().toISOString().slice(0, 16).replace(/[:T]/g, "") + (bloc ? `-${bloc}` : ""));
const lock = join(cache, "locks/ecran");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(out, { recursive: true });
// Toute la console (scénarios musique et bascule compris) va aussi dans verif.txt : un échec
// d'une passe enchaînée doit se lire après coup, sans rejouer sous le verrou.
for (const k of ["log", "error"]) {
  const orig = console[k].bind(console);
  console[k] = (...a) => { orig(...a); appendFileSync(join(out, "verif.txt"), format(...a) + "\n"); };
}

for (let i = 0; bloc !== "demarrage"; i++) {  // verrou d'écran : échec = attendre, réessayer toutes les 30 s
  try { mkdirSync(lock); break; } catch {
    if (i === 0) console.log("verrou d'écran pris : j'attends (30 s)…");
    if (i > 80) { console.error("verrou toujours pris après 40 min"); process.exit(3); }
    await sleep(30000);
  }
}
if (bloc !== "demarrage") writeFileSync(join(lock, "qui"), `paquet ${new Date().toISOString()} verif ${bloc}\n`);
const appLog = join(out, "app.log");
const env = { ...process.env, TENTACLE_MUTE: "1" };
const app = spawn(join(appPath, "Contents/MacOS/Tentacle"), [
  "--mute", `--url=${origin}/`, "--devtools-port=9312", `--profile=${join(cache, "profiles/paquet")}`, "--background",
], { env, stdio: ["ignore", openSync(appLog, "w"), openSync(appLog, "a")] });
let failures = 0;
const finish = async (code) => {
  try { app.kill("SIGTERM"); } catch { /* parti */ }
  await sleep(1500);
  try { app.kill("SIGKILL"); } catch { /* parti */ }
  if (bloc !== "demarrage") try { execFileSync("rm", ["-f", join(lock, "qui")]); rmdirSync(lock); } catch { /* rendu */ }
  console.log(`journaux : ${out}`);
  process.exit(code);
};
process.on("SIGINT", () => finish(130));
const check = (label, ok, info = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "✅" : "❌"} ${label}${info ? " — " + info : ""}`);
};

let target = null;
for (let i = 0; i < 100 && !target; i++) { await sleep(300); target = await pageTarget().catch(() => null); }
check("démarrage (DevTools 9312)", !!target, `pid ${app.pid}`);
if (!target) await finish(2);
let cdp = await Cdp.connect(target.webSocketDebuggerUrl);
for (let i = 0; i < 60; i++) {
  if (await cdp.eval("document.readyState === 'complete' && !!document.querySelector('#root, #app, body > div')").catch(() => false)) break;
  await sleep(500);
}
await sleep(2000);
if ((await cdp.eval("location.pathname")).startsWith("/login")) {
  const r = spawnSync("node", [join(shim, "dev/login.mjs"), "admin"], { env: process.env, encoding: "utf8" });
  console.log(r.stdout.trim());
}
const page = await cdp.eval("location.host + location.pathname + ' — ' + document.title");
check("front du banc chargé", page.startsWith("127.0.0.1:3471") && !page.includes("/login"), page);

// Bibliothèques réellement chargées par l'app et ses helpers (après démarrage de CEF).
const pids = [app.pid, ...spawnSync("pgrep", ["-P", String(app.pid)], { encoding: "utf8" }).stdout.split("\n").filter(Boolean)];
const libs = spawnSync("lsof", ["-p", pids.join(",")], { encoding: "utf8" }).stdout;
const outside = [...new Set(libs.split("\n").filter((l) => /\/opt\/homebrew\/|\/\.cache\/tentacle-cef\/deps\//.test(l))
  .map((l) => l.slice(l.indexOf("/"))))];
check("aucune bibliothèque hors du paquet", outside.length === 0, outside.length ? outside.join(", ") : `${pids.length} processus`);

for (const title of videos) {
  const r = spawnSync("node", [join(shim, "dev/scenario-video.mjs"), title], { env: process.env, encoding: "utf8", timeout: 240000 });
  writeFileSync(join(out, `video-${title.replace(/\W/g, "")}.txt`), r.stdout + r.stderr);
  const ko = (r.stdout.match(/❌/g) ?? []).length, ok = (r.stdout.match(/✅/g) ?? []).length;
  const sig = (r.stdout.match(/video-target-params\/gamma[^,\n]*/) ?? [""])[0];
  check(`vidéo ${title}`, r.status === 0 && ko === 0 && ok > 0, `${ok} ✅ / ${ko} ❌ ${sig}`);
  await sleep(3000);
}
if (music) {
  cdp = await Cdp.connect((await pageTarget()).webSocketDebuggerUrl);
  await cdp.send("Runtime.enable");
  const menv = {
    calls: [], events: [], fromCall: 0, fromEvent: 0,
    async sync() {
      const log = await cdp.eval(`window.__shell.invoke("octave.debug.log", { fromCall: ${this.fromCall}, fromEvent: ${this.fromEvent} })`).catch(() => null);
      if (!log) return;
      this.calls.push(...log.calls); this.events.push(...log.events);
      this.fromCall = log.callCount; this.fromEvent = log.eventCount;
    },
    prop: (name) => cdp.eval(`window.__shell.invoke("octave.debug.prop", { name: ${JSON.stringify(name)} })`),
    claim: () => cdp.eval(`window.__shell.invoke("octave.debug.claim", {})`),
  };
  // Après une vidéo, le front (mode films) ouvre la feuille « Nouveautés » par-dessus tout
  // (.lg-scrim, z-100) : le clic du scénario sur la barre d'Octave tombait dessus (seek jamais
  // envoyé, échec de la passe enchaînée seulement). On la ferme par son bouton, comme la bascule.
  for (let i = 0; i < 6; i++) {
    const open = await cdp.eval(`(() => { const b = [...document.querySelectorAll(".lg-scrim button")]
      .find((e) => e.getAttribute("aria-label") === "Fermer"); b?.click(); return !!document.querySelector(".lg-scrim"); })()`);
    if (!open) break;
    await sleep(700);
  }
  check("aucune feuille ouverte avant la musique", !(await cdp.eval(`!!document.querySelector(".lg-scrim")`)));
  let m = 1;
  try {
    await cdp.eval(`localStorage.setItem("tentacle_language", "fr"); true`).catch(() => null);
    m = await scenario({ cdp, env: menv, cache, origin });
    m += await bascule({ cdp, env: menv, cache, origin, appLog });
  } catch (e) { console.error("scénario musique interrompu :", e); }
  check("musique (Octave) + bascule", m === 0, `${m} échec(s)`);
}
console.log(`\nTOTAL paquet-verif : ${failures} échec(s)`);
await finish(failures === 0 ? 0 : 1);
