// Provisoire — à retirer quand la refonte remplace l'UI TV (fusion dans main).
//
// Les services de fond : le backend de dev, le Metro de la refonte, le banc UI
// (son Metro et son relais). Ce qui tourne déjà est réutilisé ; ce que le
// lanceur démarre est retenu dans son état, et lui seul l'arrête.
import fs from "node:fs";
import path from "node:path";
import {
  APP_DIR, LauncherError, REPO, capture, freePort, httpGet, isAlive, loadState, note, portInUse,
  sameDir, shortPath, sleep, spawnDetached, step, stopProcess, updateState, waitFor, warn,
} from "./runtime.mjs";

export const BACKEND_PORT = 3001;
export const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const METRO_DEFAULT_PORT = 8081;
const BENCH_BASE_PORT = 8950;
const BENCH_SCRIPT = path.join(APP_DIR, "harness/ui-bench/bench.mjs");

// ─── Backend de dev ──────────────────────────────────────────────────────────

async function backendHealthy() {
  const res = await httpGet(`http://127.0.0.1:${BACKEND_PORT}/api/health`);
  if (res?.status !== 200) return false;
  try {
    return JSON.parse(res.text).status === "ok";
  } catch {
    return false;
  }
}

/** Le dossier d'où lancer le backend : celui qui porte sa configuration
 *  (`apps/backend/data/database.json`) — ce dossier-ci, sinon le dossier
 *  principal du dépôt (un worktree n'en a pas). */
function backendHome() {
  const configured = (root) => fs.existsSync(path.join(root, "apps/backend/data/database.json"));
  if (configured(REPO)) return REPO;
  const list = capture("git", ["-C", REPO, "worktree", "list", "--porcelain"]) ?? "";
  const main = list.split("\n").find((line) => line.startsWith("worktree "))?.slice("worktree ".length);
  return main && configured(main) ? main : null;
}

/** Le backend de dev sur 3001 : réutilisé s'il répond, lancé sinon. Rend
 *  `true` si un backend répond à la fin. */
export async function ensureBackend() {
  const ours = loadState().backend;
  if (await backendHealthy()) {
    step("Backend de dev", isAlive(ours)
      ? `en marche sur ${BACKEND_URL} (lancé par le lanceur)`
      : `déjà en marche sur ${BACKEND_URL} — réutilisé (lancé hors du lanceur : on n'y touche pas)`);
    return true;
  }
  if (isAlive(ours)) {
    step("Backend de dev", "lancé par le lanceur mais muet — on attend qu'il réponde…");
  } else {
    if (await portInUse(BACKEND_PORT)) {
      warn(`le port ${BACKEND_PORT} est pris par autre chose que le backend : pas de backend de dev pour le jumelage`);
      return false;
    }
    const home = backendHome();
    if (!home) {
      warn("aucun dossier du dépôt n'a de configuration de backend (apps/backend/data/database.json) : lancez-le vous-même (pnpm dev:backend)");
      return false;
    }
    step("Backend de dev", `lancement de « pnpm dev:backend » depuis ${home}…`);
    const record = spawnDetached("backend", "pnpm", ["--filter", "@tentacle-tv/backend", "dev"], { cwd: home });
    updateState((state) => { state.backend = record; });
  }
  const record = loadState().backend;
  if (!(await waitFor(backendHealthy, { timeoutMs: 150_000, everyMs: 1000 }))) {
    warn(`le backend ne répond toujours pas sur ${BACKEND_PORT} — journal : ${shortPath(record.log)}`);
    return false;
  }
  note(`prêt sur ${BACKEND_URL} — journal : ${shortPath(record.log)}`);
  return true;
}

/** La page de jumelage est-elle servie par le backend (client web construit) ? */
export async function pairingPageServed() {
  const res = await httpGet(`http://127.0.0.1:${BACKEND_PORT}/pair-device`);
  return res?.status === 200 && (res.headers.get("content-type") ?? "").includes("text/html");
}

// ─── Metro de la refonte ─────────────────────────────────────────────────────

/** Le dossier que sert le Metro de ce port (`null` s'il n'y en a pas). */
async function metroRoot(port) {
  const res = await httpGet(`http://127.0.0.1:${port}/status`);
  return res?.text === "packager-status:running" ? res.headers.get("x-react-native-project-root") : null;
}

const servesThisApp = async (port) => sameDir(await metroRoot(port), APP_DIR);

/** Un Metro pour CE dossier : celui du lanceur s'il tourne, celui de
 *  `pnpm dev:tv` sur 8081 s'il sert ce dossier, sinon un nouveau sur un port
 *  libre. Rend `{ port, record }` (`record` : le nôtre, pour lire son journal). */
export async function ensureMetro() {
  const mine = loadState().metro;
  if (isAlive(mine) && !sameDir(mine.cwd, APP_DIR)) {
    // Le simulateur de la refonte change de dossier : l'ancien Metro ne servirait plus personne.
    await stopProcess(mine);
    note(`Metro du lanceur pour ${mine.cwd} arrêté (on lance depuis ce dossier-ci)`);
  } else if (isAlive(mine)) {
    if (await waitFor(() => servesThisApp(mine.port), { timeoutMs: 60_000 })) {
      step("Metro", `déjà en marche sur le port ${mine.port} (lancé par le lanceur) — réutilisé`);
      return { port: mine.port, record: mine };
    }
    await stopProcess(mine);
    note(`Metro du lanceur muet sur ${mine.port} : arrêté, on en relance un`);
  }
  if (await servesThisApp(METRO_DEFAULT_PORT)) {
    step("Metro", `déjà en marche sur le port ${METRO_DEFAULT_PORT} pour ce dossier — réutilisé`);
    return { port: METRO_DEFAULT_PORT, record: null };
  }
  const port = await freePort(METRO_DEFAULT_PORT);
  const record = { ...spawnDetached("metro", "npx", ["react-native", "start", "--port", String(port)], { cwd: APP_DIR }), port };
  updateState((state) => { state.metro = record; });
  if (!(await waitFor(() => servesThisApp(port), { timeoutMs: 120_000 }))) {
    throw new LauncherError(`Metro ne répond pas sur le port ${port} — journal : ${shortPath(record.log)}`);
  }
  const why = port === METRO_DEFAULT_PORT ? "" : ` (${METRO_DEFAULT_PORT} est occupé)`;
  step("Metro", `lancé sur le port ${port}${why} — journal : ${shortPath(record.log)}`);
  return { port, record };
}

/**
 * Attend que l'app ait reçu son code, dans le journal de NOTRE Metro (un Metro
 * réutilisé n'a pas de journal lisible). Hors terminal, Metro clôt un bundle
 * par sa ligne « BUNDLE ./index.js » SANS pourcentage — la même en cas
 * d'échec, que dit alors une ligne « ERROR » (écrite juste avant ou juste
 * après : on la guette encore un instant).
 */
export async function awaitFirstBundle(record, sinceBytes) {
  if (!record) return null;
  const read = () => {
    try {
      return fs.readFileSync(record.log).subarray(sinceBytes).toString("utf8");
    } catch {
      return "";
    }
  };
  const failure = (text) => {
    const error = text.match(/^ ERROR +([^\n]+)/m);
    return error ? { ok: false, line: error[1].trim() } : null;
  };
  return waitFor(async () => {
    if (!/^ BUNDLE +\S+ *$/m.test(read())) return failure(read());
    await sleep(1500);
    return failure(read()) ?? { ok: true };
  }, { timeoutMs: 240_000, everyMs: 1000 });
}

export const logSize = (record) => {
  try {
    return record ? fs.statSync(record.log).size : 0;
  } catch {
    return 0;
  }
};

// ─── Banc UI ─────────────────────────────────────────────────────────────────

async function benchResponds(bench) {
  const res = await httpGet(`http://127.0.0.1:${bench.benchPort}/bench/state`);
  return res?.status === 200 && (await servesThisApp(bench.metroPort));
}

/** Le banc (`bench:ui up` : Metro + relais) en arrière-plan, sur des ports libres. */
export async function ensureBench() {
  const mine = loadState().banc;
  if (isAlive(mine) && sameDir(mine.cwd, APP_DIR) && (await waitFor(() => benchResponds(mine), { timeoutMs: 30_000 }))) {
    step("Banc UI", `déjà en marche (relais ${mine.benchPort}, Metro ${mine.metroPort}) — réutilisé`);
    return mine;
  }
  if (isAlive(mine)) {
    await stopProcess(mine);
    note(`ancien banc du lanceur (${mine.cwd}) arrêté`);
  }
  // Hors de 8093/8094, les ports par défaut des bancs des sessions Claude : une
  // commande « bench:ui » lancée sans ports parlerait sinon à ce banc-ci.
  const benchPort = await freePort(BENCH_BASE_PORT);
  const metroPort = await freePort(benchPort + 1, [benchPort]);
  const env = { BENCH_PORT: String(benchPort), METRO_PORT: String(metroPort) };
  const record = { ...spawnDetached("banc", process.execPath, [BENCH_SCRIPT, "up"], { cwd: APP_DIR, env }), benchPort, metroPort };
  updateState((state) => { state.banc = record; });
  if (!(await waitFor(() => benchResponds(record), { timeoutMs: 120_000 }))) {
    throw new LauncherError(`le banc ne répond pas (relais ${benchPort}, Metro ${metroPort}) — journal : ${shortPath(record.log)}`);
  }
  step("Banc UI", `« bench:ui up » lancé en arrière-plan — relais ${benchPort}, Metro ${metroPort}, journal : ${shortPath(record.log)}`);
  return record;
}

/** Attend que l'app du banc ait publié son catalogue au relais — elle est
 *  alors pilotable (`pnpm tv:banc <commande>`). Rend le nombre de scènes. */
export function awaitBenchCatalogue(bench) {
  return waitFor(async () => {
    const res = await httpGet(`http://127.0.0.1:${bench.benchPort}/bench/scenes`);
    try {
      const scenes = JSON.parse(res?.text ?? "[]");
      return Array.isArray(scenes) && scenes.length > 0 ? scenes.length : null;
    } catch {
      return null;
    }
  }, { timeoutMs: 240_000, everyMs: 1000 });
}
