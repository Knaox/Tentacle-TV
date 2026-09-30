// Provisoire — à retirer quand la refonte remplace l'UI TV (fusion dans main).
//
// Le socle du lanceur : chemins, état, sortie, processus et ports. L'état vit
// HORS du dépôt : les simulateurs dédiés sont uniques sur la machine, quel que
// soit le dossier d'où l'on lance.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, "../../../..");
export const APP_DIR = path.join(REPO, "apps/tv");
export const STATE_DIR = path.join(os.homedir(), "Library/Caches/tentacle-tv-lanceur");
const STATE_FILE = path.join(STATE_DIR, "state.json");

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Une erreur qu'on explique à l'utilisateur, sans pile. */
export class LauncherError extends Error {}

// ─── Sortie ──────────────────────────────────────────────────────────────────

export const say = (text = "") => console.log(text);
export const step = (label, text) => console.log(`▸ ${label} : ${text}`);
export const note = (text) => console.log(`    ${text}`);
export const warn = (text) => console.log(`  ⚠ ${text}`);

/** Chemin lisible : relatif au dépôt, sinon `~/…`. */
export function shortPath(target) {
  const inRepo = path.relative(REPO, target);
  if (!inRepo.startsWith("..") && !path.isAbsolute(inRepo)) return inRepo || ".";
  return target.startsWith(os.homedir()) ? `~${target.slice(os.homedir().length)}` : target;
}

export function minutes(ms) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
}

// ─── Commandes ───────────────────────────────────────────────────────────────

/** Sortie d'une commande courte ; `null` si elle échoue. */
export function capture(command, args, options = {}) {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
  } catch {
    return null;
  }
}

/** Une commande longue, sa sortie dans un journal ; rejette avec le code de sortie. */
export function runLogged(command, args, { cwd, env, log }) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(log), { recursive: true });
    const fd = fs.openSync(log, "w");
    const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", fd, fd] });
    fs.closeSync(fd);
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} a échoué (code ${code})`))));
  });
}

// ─── État ────────────────────────────────────────────────────────────────────

export function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

/** Relit l'état juste avant d'écrire : deux commandes du lanceur peuvent
 *  tourner en même temps (la refonte et le banc). */
export function updateState(change) {
  const state = loadState();
  change(state);
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
  return state;
}

// ─── Processus ───────────────────────────────────────────────────────────────

const startOf = (pid) => capture("ps", ["-o", "lstart=", "-p", String(pid)])?.trim() ?? "";

/**
 * Lance un service détaché (son propre groupe de processus), sortie dans
 * `<STATE_DIR>/<name>.log`. On retient son PID ET son heure de départ : un
 * PID recyclé par un autre programme ne sera jamais pris pour le nôtre.
 */
export function spawnDetached(name, command, args, { cwd, env = {} }) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const log = path.join(STATE_DIR, `${name}.log`);
  const fd = fs.openSync(log, "w");
  const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, detached: true, stdio: ["ignore", fd, fd] });
  fs.closeSync(fd);
  child.unref();
  return { pid: child.pid, started: startOf(child.pid), cwd, log };
}

/** Le processus retenu tourne-t-il encore — lui, pas un homonyme ? */
export const isAlive = (record) => Boolean(record?.pid) && startOf(record.pid) === record.started;

/** Les processus du groupe `pgid` (le groupe du chef qu'on a lancé détaché). */
function groupOf(pgid) {
  const table = capture("ps", ["-A", "-o", "pid=,pgid=,command="]) ?? "";
  return table.split("\n").flatMap((line) => {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/);
    return match && Number(match[2]) === pgid ? [{ pid: Number(match[1]), command: match[3] }] : [];
  });
}

const signal = (pids, name) => pids.forEach((pid) => {
  try {
    process.kill(pid, name);
  } catch {
    // déjà parti
  }
});

/**
 * Arrête un service lancé par nous : TERM, puis KILL après 10 s. Tant que son
 * chef tourne (reconnu à son heure de départ), tout son groupe est à nous ;
 * chef disparu, seuls les restes dont la ligne de commande pointe dans le
 * dossier d'où on les a lancés. Jamais de motif large : d'autres sessions
 * font tourner les mêmes Metro, relais et backends.
 */
export async function stopProcess(record) {
  if (!record?.pid) return false;
  const leaderAlive = isAlive(record);
  const ours = groupOf(record.pid).filter((member) => leaderAlive || member.command.includes(record.cwd)).map((member) => member.pid);
  if (ours.length === 0) return false;
  const remaining = () => {
    const now = new Set(groupOf(record.pid).map((member) => member.pid));
    return ours.filter((pid) => now.has(pid));
  };
  signal(ours, "SIGTERM");
  let left = remaining();
  for (let i = 0; i < 40 && left.length; i++) {
    await sleep(250);
    left = remaining();
  }
  if (left.length) signal(left, "SIGKILL");
  return true;
}

// ─── Ports et sondes ─────────────────────────────────────────────────────────

function answers(port, host) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(600, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

/** Quelqu'un écoute-t-il sur ce port (IPv4 ou IPv6) ? */
export async function portInUse(port) {
  const [v4, v6] = await Promise.all([answers(port, "127.0.0.1"), answers(port, "::1")]);
  return v4 || v6;
}

/** Le premier port libre à partir de `from`, hors de `avoid`. */
export async function freePort(from, avoid = []) {
  for (let port = from; port < from + 300; port++) {
    if (!avoid.includes(port) && !(await portInUse(port))) return port;
  }
  throw new LauncherError(`aucun port libre entre ${from} et ${from + 300}`);
}

export async function httpGet(url, timeoutMs = 2000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return { status: res.status, headers: res.headers, text: await res.text() };
  } catch {
    return null;
  }
}

/** Répète `check` jusqu'à une valeur vraie, ou `null` passé le délai. */
export async function waitFor(check, { timeoutMs, everyMs = 500 }) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await check();
    if (value) return value;
    await sleep(everyMs);
  }
  return null;
}

/** Même dossier, quels que soient les liens symboliques du chemin. */
export function sameDir(a, b) {
  if (!a || !b) return false;
  try {
    return fs.realpathSync(a) === fs.realpathSync(b);
  } catch {
    return path.resolve(a) === path.resolve(b);
  }
}
