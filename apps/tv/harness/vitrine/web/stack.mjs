// La pile de la vitrine web : le faux serveur (server.mjs) et le client web
// de `main` en build de PRODUCTION (`vite preview`, branché sur le faux
// serveur par TENTACLE_DEV_API). Ce qui tourne déjà sur le port est gardé ;
// ce que la vitrine lance est noté (PID) et arrêté par PID, rien d'autre.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HOME, WEB_ROOT } from "../lib/paths.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STATE = path.join(HOME, ".state/web.json");
const LOGS = path.join(HOME, ".state/logs");

export const WEB = {
  apiPort: Number(process.env.VITRINE_WEB_API_PORT ?? 3061),
  webPort: Number(process.env.VITRINE_WEB_PORT ?? 5261),
};
export const ORIGIN = `http://localhost:${WEB.webPort}`;
const API = `http://127.0.0.1:${WEB.apiPort}`;

const readState = () => (fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : {});
const writeState = (state) => {
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function answers(url) {
  try {
    await fetch(url);
    return true;
  } catch {
    return false;
  }
}

async function waitFor(url, what) {
  for (let i = 0; i < 120; i++) {
    if (await answers(url)) return;
    await sleep(500);
  }
  throw new Error(`${what} ne répond pas (${url}) — journaux : ${LOGS}`);
}

function start(name, command, args, options) {
  fs.mkdirSync(LOGS, { recursive: true });
  const log = fs.openSync(path.join(LOGS, `${name}.log`), "a");
  const child = spawn(command, args, { ...options, detached: true, stdio: ["ignore", log, log] });
  child.unref();
  return child.pid;
}

/** Le build de production du client web (fait s'il manque, ou si `rebuild`). */
function ensureWebBuild(rebuild) {
  const dist = path.join(WEB_ROOT, "apps/web/dist/index.html");
  if (fs.existsSync(dist) && !rebuild) return;
  console.log(`build de production du client web (${WEB_ROOT})…`);
  execFileSync("pnpm", ["--filter", "@tentacle-tv/web", "build"], { cwd: WEB_ROOT, stdio: "inherit" });
}

/** Le faux serveur et le client web, prêts. */
export async function upWeb({ rebuild = false } = {}) {
  const state = readState();
  if (!(await answers(`${API}/__vitrine/journal`))) {
    const env = { ...process.env, VITRINE_WEB_API_PORT: String(WEB.apiPort) };
    state.api = start("web-api", process.execPath, [path.join(HERE, "server.mjs")], { env });
    console.log(`faux serveur lancé sur ${WEB.apiPort} (PID ${state.api})`);
  }
  ensureWebBuild(rebuild);
  if (!(await answers(`${ORIGIN}/tentacle.svg`))) {
    const vite = path.join(WEB_ROOT, "node_modules/.bin/vite");
    const env = { ...process.env, TENTACLE_DEV_API: API };
    state.web = start("web-preview", vite, ["preview", "--port", String(WEB.webPort), "--strictPort", "--host", "127.0.0.1"], { cwd: path.join(WEB_ROOT, "apps/web"), env });
    console.log(`client web (production) lancé sur ${WEB.webPort} (PID ${state.web})`);
  }
  writeState(state);
  await waitFor(`${API}/__vitrine/journal`, "Le faux serveur");
  await waitFor(`${ORIGIN}/tentacle.svg`, "Le client web");
}

/** Règle le faux serveur : langue du catalogue, titre du héros. */
export async function setDemo({ lang, hero }) {
  if (lang) await fetch(`${API}/__vitrine/lang?set=${lang}`);
  if (hero) await fetch(`${API}/__vitrine/hero?set=${hero}`);
}

/** Arrête ce que la vitrine a lancé (par PID, groupe compris). */
export function downWeb() {
  const state = readState();
  for (const pid of [state.web, state.api].filter(Boolean)) {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      // déjà arrêté
    }
  }
  writeState({});
}
