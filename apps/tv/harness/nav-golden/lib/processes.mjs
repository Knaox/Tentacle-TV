// Les processus de fond d'une place (faux backend, Metro, agent XCUITest,
// démon CDP) : lancés détachés, retenus par PID ET heure de départ dans l'état
// de la place, arrêtés par PID — jamais par motif (`pkill -f` tuerait les
// bancs identiques des autres sessions).
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { capture, sleep } from "./config.mjs";

export function loadState(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

export function saveState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
}

const startOf = (pid) => capture("ps", ["-o", "lstart=", "-p", String(pid)])?.trim() ?? "";

/** Lance `command` détaché (son groupe de processus), sortie dans `log`. */
export function spawnDetached(command, args, { cwd, env = {}, log }) {
  fs.mkdirSync(path.dirname(log), { recursive: true });
  const fd = fs.openSync(log, "w");
  const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, detached: true, stdio: ["ignore", fd, fd] });
  fs.closeSync(fd);
  child.unref();
  return { pid: child.pid, started: startOf(child.pid), cwd, log };
}

/** Le processus retenu tourne-t-il encore — lui, pas un PID recyclé ? */
export const isAlive = (record) => Boolean(record?.pid) && startOf(record.pid) === record.started;

function groupOf(pgid) {
  const table = capture("ps", ["-A", "-o", "pid=,pgid="]) ?? "";
  return table.split("\n").flatMap((line) => {
    const match = line.match(/^\s*(\d+)\s+(\d+)/);
    return match && Number(match[2]) === pgid ? [Number(match[1])] : [];
  });
}

/** Arrête un processus lancé par nous (et son groupe) : TERM, puis KILL après 8 s. */
export async function stopProcess(record) {
  if (!isAlive(record)) return false;
  const pids = groupOf(record.pid);
  const signal = (name) => pids.forEach((pid) => {
    try {
      process.kill(pid, name);
    } catch {
      // déjà parti
    }
  });
  signal("SIGTERM");
  for (let i = 0; i < 32 && groupOf(record.pid).length; i++) await sleep(250);
  if (groupOf(record.pid).length) signal("SIGKILL");
  return true;
}

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

export async function portInUse(port) {
  const [v4, v6] = await Promise.all([answers(port, "127.0.0.1"), answers(port, "::1")]);
  return v4 || v6;
}

/** Le PID qui écoute sur ce port (`null` sinon). */
export const listenerOf = (port) => Number(capture("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"])?.trim().split("\n")[0]) || null;

export async function httpJson(url, { method = "GET", body, timeoutMs = 5000 } = {}) {
  try {
    const res = await fetch(url, {
      method,
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { status: res.status, text, json, headers: res.headers };
  } catch {
    return null;
  }
}

/** Répète `check` jusqu'à une valeur vraie ; `null` passé le délai. */
export async function waitFor(check, { timeoutMs, everyMs = 400 }) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await check();
    if (value) return value;
    await sleep(everyMs);
  }
  return null;
}
