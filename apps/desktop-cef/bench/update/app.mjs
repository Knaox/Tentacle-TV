// L'app « installée » du banc de mise à jour : la lancer (muette, sans voler le focus,
// DevTools 9315), la retrouver par son chemin exact, l'interroger par CDP, lire son état.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, openSync, readFileSync } from "node:fs";
import path from "node:path";
import { DIR } from "./feed.mjs";

export const INSTALL = path.join(DIR, "install", "Tentacle.app");
export const EXE = path.join(INSTALL, "Contents/MacOS/Tentacle");
export const STATE = path.join(DIR, "state");
export const PORT_DEVTOOLS = 9315;
export const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
let lastExit = null;  // fin du dernier processus lancé par launch()

export function launch({ feedUrl, publicKey, url, profile }) {
  // --mute d'abord (règle du lot), puis le reste ; TENTACLE_MUTE en plus.
  const args = ["--mute", `--devtools-port=${PORT_DEVTOOLS}`, `--profile=${profile}`, "--background",
    `--update-feed=${feedUrl}`, `--update-state-dir=${STATE}`, "--update-first-check-ms=1500", "--update-retry-ms=4000"];
  if (url) args.push(`--url=${url}`);
  const log = openSync(path.join(DIR, "app.log"), "a");
  const child = spawn(EXE, args, {
    env: { ...process.env, TENTACLE_MUTE: "1", TENTACLE_UPDATE_TEST_PUBKEY: publicKey },
    stdio: ["ignore", log, log], detached: true,
  });
  lastExit = null;
  child.on("exit", (code, sig) => { lastExit = { code, sig }; });
  child.unref();
  return child.pid;
}

// Les PID de NOS instances (chemin exact de l'exécutable du banc) — jamais un pkill -f.
export function pids() {
  const out = execFileSync("ps", ["-axo", "pid=,command="]).toString();
  return out.split("\n").filter((l) => l.trim().slice(l.trim().indexOf(" ") + 1).startsWith(EXE + " "))
    .map((l) => Number(l.trim().split(" ")[0]));
}

export async function killAll(signal = "SIGKILL") {
  for (const pid of pids()) try { process.kill(pid, signal); } catch { /* déjà parti */ }
  for (let i = 0; i < 40 && pids().length; i++) await sleep(250);
}

export function version() {
  return execFileSync("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleShortVersionString",
    path.join(INSTALL, "Contents/Info.plist")]).toString().trim();
}

export const readJson = (name) => {
  const f = path.join(STATE, name);
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
};

// Évalue une expression dans la page (promesses attendues). null si la page n'est pas là.
export async function evaluate(expr) {
  let targets;
  try { targets = await (await fetch(`http://127.0.0.1:${PORT_DEVTOOLS}/json`)).json(); } catch { return null; }
  const page = targets.find((t) => t.type === "page");
  if (!page) return null;
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  try {
    await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; ws.onclose = ko; });
    ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression: expr, awaitPromise: true, returnByValue: true } }));
    // L'app peut quitter pendant l'évaluation (shell.quit, redémarrage) : fermeture et délai
    // rendent null au lieu de suspendre le banc pour toujours.
    const msg = await new Promise((ok) => {
      const timer = setTimeout(() => ok({}), 15000);
      ws.onmessage = (m) => { clearTimeout(timer); ok(JSON.parse(m.data)); };
      ws.onclose = ws.onerror = () => { clearTimeout(timer); ok({}); };
    });
    const r = msg.result || {};
    return r.exceptionDetails ? null : r.result?.value ?? null;
  } catch { return null; } finally { ws.close(); }
}

export async function waitFor(what, fn, timeoutMs = 60000, everyMs = 250) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`délai dépassé : ${what}`);
    await sleep(everyMs);
  }
}

export const state = () => evaluate("__shell.invoke('update.state')");

// La page répond avec la mise à jour active. Si l'app lancée est morte entre-temps (dyld,
// plantage au démarrage), échouer tout de suite avec la fin de son journal plutôt qu'au délai.
export const waitForBoot = (timeoutMs = 60000) => waitFor("page de l'app", async () => {
  if (lastExit && !pids().length) {
    const tail = readFileSync(path.join(DIR, "app.log"), "utf8").trim().split("\n").slice(-3).join(" | ");
    throw new Error(`l'app s'est arrêtée au démarrage (${lastExit.sig || `code ${lastExit.code}`}) : ${tail}`);
  }
  return (await state())?.enabled === true;
}, timeoutMs);

// Ce que montre la surcouche : vue, type, texte, boutons (lus dans son Shadow DOM).
export const overlay = () => evaluate(`(() => {
  const host = document.querySelector('tentacle-update');
  if (!host) return { view: 'absent' };
  const r = host.shadowRoot, box = r.querySelector('.toast, .dialog');
  return { view: host.dataset.view || 'none', kind: box ? (box.dataset.kind || box.getAttribute('role')) : null,
    text: box ? box.innerText.replace(/\\s+/g, ' ').trim() : '',
    buttons: [...r.querySelectorAll('button')].map((b) => ({ action: b.dataset.action || 'close', label: b.textContent || b.getAttribute('aria-label'), disabled: b.disabled })),
    fill: r.querySelector('.fill') ? r.querySelector('.fill').style.width : null };
})()`);

// Clic sur un bouton de la surcouche par son action (restart, later, mute, retry, ack, notes) :
// indépendant de la langue de la page.
export const click = (action) => evaluate(`(() => {
  const r = document.querySelector('tentacle-update').shadowRoot;
  const b = r.querySelector('button[data-action=${JSON.stringify(action)}]');
  if (!b || b.disabled) return false;
  b.click();
  return true;
})()`);
