// Le moteur de capture du client web : Electron hors écran (electronHost.cjs)
// à la taille et à la densité d'un appareil, piloté par CDP. Profil JETABLE,
// ports à soi, arrêt par PID. Node fournit WebSocket : aucune dépendance.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HOME } from "../lib/paths.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CDP_PORT = Number(process.env.VITRINE_CDP_PORT ?? 9361);
const CONTROL_PORT = Number(process.env.VITRINE_CONTROL_PORT ?? 9362);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Le binaire Electron du dépôt (le paquet `electron` rend son chemin). */
const electronBinary = () => createRequire(import.meta.url)("electron");

/**
 * Lance l'hôte hors écran pour `{ width, height, scale }` (px CSS, densité)
 * et rend l'onglet piloté : { send, on, evaluate, capture, close }.
 */
export async function launchEngine({ width, height, scale }) {
  const child = spawn(electronBinary(), [path.join(HERE, "electronHost.cjs")], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      VITRINE_WIDTH: String(width), VITRINE_HEIGHT: String(height), VITRINE_SCALE: String(scale),
      VITRINE_CDP_PORT: String(CDP_PORT), VITRINE_CONTROL_PORT: String(CONTROL_PORT),
      VITRINE_PROFILE: path.join(HOME, ".state/electron-web"),
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
    },
  });
  const kill = () => {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      // déjà arrêté
    }
  };
  let target = null;
  for (let i = 0; i < 150 && !target; i++) {
    await sleep(100);
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
      target = list.find((t) => t.type === "page");
    } catch {
      // Electron démarre encore
    }
  }
  if (!target) {
    kill();
    throw new Error("l'hôte Electron n'a pas ouvert sa fenêtre hors écran");
  }
  const page = await connect(target.webSocketDebuggerUrl);
  /** L'image de la fenêtre hors écran, en PNG, à la densité de l'appareil. */
  const capture = async () => {
    const res = await fetch(`http://127.0.0.1:${CONTROL_PORT}/capture`);
    if (!res.ok) throw new Error(`capture refusée par l'hôte (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  };
  const close = () => {
    page.socket.close();
    kill();
  };
  return { ...page, capture, close, pid: child.pid };
}

async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = () => reject(new Error("CDP injoignable"));
  });
  let seq = 0;
  const pending = new Map();
  const listeners = new Map();
  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const fn of listeners.get(msg.method) ?? []) fn(msg.params);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const on = (method, fn) => {
    if (!listeners.has(method)) listeners.set(method, new Set());
    listeners.get(method).add(fn);
    return () => listeners.get(method).delete(fn);
  };
  /** Évalue une expression dans la page (IIFE conseillée) et rend sa valeur. */
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(`page : ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`);
    return result.result.value;
  };
  return { socket, send, on, evaluate };
}
