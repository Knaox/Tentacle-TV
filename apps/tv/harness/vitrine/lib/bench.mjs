// Le banc de la vitrine : Metro et le relais du banc UI sur des ports à soi,
// l'instantané vitrine d'UNE langue servi par le relais. Les processus lancés
// sont notés (PID + commande) et arrêtés par PID, groupe compris — jamais par
// motif : les autres sessions font tourner les mêmes commandes.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { APP_DIR, BENCH, BENCH_DIR, HOME, SNAPSHOT } from "./paths.mjs";
import { ensureSimulator, foreground, launchApp, screenshot } from "./simulator.mjs";

const STATE = path.join(HOME, ".state/bench.json");
const LOGS = path.join(HOME, ".state/logs");
const RELAY = `http://127.0.0.1:${BENCH.relayPort}`;
const METRO_CLI = path.join(APP_DIR, "node_modules/react-native/cli.js");
const RELAY_SCRIPT = path.join(BENCH_DIR, "relay.mjs");

const readState = () => (fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : {});
function writeState(state) {
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Le processus noté tourne-t-il encore, avec la commande qu'on lui a donnée ? */
function ours(entry) {
  if (!entry) return false;
  try {
    const command = execFileSync("ps", ["-o", "command=", "-p", String(entry.pid)], { encoding: "utf8" }).trim();
    return command.includes(entry.marker);
  } catch {
    return false;
  }
}

function stop(entry) {
  if (!ours(entry)) return;
  // Groupe du processus (lancé détaché) : Metro emporte ses ouvriers.
  try {
    process.kill(-entry.pid, "SIGTERM");
  } catch {
    process.kill(entry.pid, "SIGTERM");
  }
}

function start(name, args, options) {
  fs.mkdirSync(LOGS, { recursive: true });
  const log = fs.openSync(path.join(LOGS, `${name}.log`), "a");
  const child = spawn(process.execPath, args, { ...options, detached: true, stdio: ["ignore", log, log] });
  child.unref();
  return child.pid;
}

async function waitFor(url, test, timeoutMs, what) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const body = await fetch(url).then((res) => res.text()).catch(() => null);
    if (body !== null && test(body)) return body;
    await pause(1000);
  }
  throw new Error(`${what} ne répond pas (${url}) — journaux : ${LOGS}`);
}

async function call(pathname, init) {
  const res = await fetch(`${RELAY}${pathname}`, init);
  return res.json();
}
const post = (pathname, body) => call(pathname, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/** Metro (une fois), le relais sur l'instantané de `lang`, le simulateur,
 *  l'app relancée — puis attend que l'app ait publié les scènes vitrine. */
export async function up(lang) {
  const state = readState();
  if (!ours(state.metro)) {
    const args = [METRO_CLI, "start", "--port", String(BENCH.metroPort)];
    state.metro = { pid: start("metro", args, { cwd: APP_DIR, env: process.env }), marker: `start --port ${BENCH.metroPort}` };
    writeState(state);
    console.log(`Metro lancé sur ${BENCH.metroPort} (PID ${state.metro.pid})`);
  }
  await waitFor(`http://127.0.0.1:${BENCH.metroPort}/status`, (body) => body.includes("running"), 180_000, "Metro");
  if (!ours(state.relay) || state.relay.lang !== lang) {
    stop(state.relay);
    await pause(500);
    const env = { ...process.env, BENCH_PORT: String(BENCH.relayPort), METRO_PORT: String(BENCH.metroPort), BENCH_SNAPSHOT_DIR: path.join(SNAPSHOT, lang) };
    state.relay = { pid: start("relay", [RELAY_SCRIPT], { env }), marker: RELAY_SCRIPT, lang };
    writeState(state);
    console.log(`relais sur ${BENCH.relayPort}, instantané « ${lang} » (PID ${state.relay.pid})`);
  }
  await waitFor(`${RELAY}/bench/state`, () => true, 20_000, "Le relais");
  const udid = ensureSimulator();
  await post("/bench/control", { scene: null, focus: null, lang, glass: true, nativeGlass: true });
  launchApp(udid);
  // Le premier paquet JS se construit : jusqu'à plusieurs minutes sous charge.
  await waitFor(`${RELAY}/bench/scenes`, (body) => body.includes('"vitrine/'), 600_000, "L'app du banc (catalogue vitrine)");
  return udid;
}

/** Pose un état et attend que le banc l'ait AFFICHÉ (images comprises). */
export async function apply(udid, patch) {
  const state = await post("/bench/control", patch);
  let ready = await call(`/bench/ready?rev=${state.rev}&timeout=20000`);
  if (ready.readyRev < state.rev) {
    foreground(udid);
    ready = await call(`/bench/ready?rev=${state.rev}&timeout=45000`);
  }
  if (ready.readyRev < state.rev) throw new Error(`le banc n'a pas affiché la révision ${state.rev}`);
}

/** Une scène, figée sur `focus`, capturée en 3840×2160 dans `file`. */
export async function capture(udid, { scene, focus = null, lang, glass = "on", settleMs = 600 }, file) {
  const glassPatch = glass === "off" ? { glass: false, nativeGlass: true } : { glass: true, nativeGlass: glass !== "sim" };
  await apply(udid, { scene, focus, lang, ...glassPatch });
  // Les animations d'arrivée (focus, fondus) se posent après le « prêt ».
  await pause(settleMs);
  screenshot(udid, file);
}

export const benchScenes = () => call("/bench/scenes");

/** Arrête Metro et le relais lancés par la vitrine (par PID), rien d'autre. */
export function down() {
  const state = readState();
  stop(state.relay);
  stop(state.metro);
  writeState({});
}
