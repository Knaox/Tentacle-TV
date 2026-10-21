// Lancer l'Electron de dev pour le banc — profil JETABLE, CDP, verrou du lot.
//
// Profil : `--user-data-dir` est ignoré (index.ts force `userData` vers le
// dossier de l'app installée). `CFFIXED_USER_HOME` redirige le HOME vu par
// Foundation : `appData` et `userData` naissent vierges sous ce dossier, et le
// verrou d'instance unique le suit (aucun conflit avec l'app installée ni avec
// l'Electron d'une autre session).
//
// Verrou du lot (LOT.md) : deux Electron au plus sur la machine, `mkdir` d'un
// dossier `electron-slot-N`, `rmdir` à la fin. Arrêt par NOTRE pid seulement.
import { spawn } from "node:child_process";
import { mkdirSync, openSync, rmSync, rmdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Cdp, waitForTarget } from "./cdp.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DESKTOP_DIR = path.resolve(HERE, "../../..");
const ROOT = path.resolve(DESKTOP_DIR, "../..");
const ELECTRON = path.join(ROOT, "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron");
const LOCKS = "/Users/damienrouge/Desktop/Projet - local/.claude/locks/lg";

export const PORTS = { backend: 3107, page: 9307, main: 9407 };

function takeSlot() {
  for (const n of [1, 2]) {
    const dir = path.join(LOCKS, `electron-slot-${n}`);
    try {
      mkdirSync(dir);
      return dir;
    } catch {
      // Pris par une autre session.
    }
  }
  return null;
}

/** Attend un slot libre (les deux pris : on patiente, jamais on ne force). */
async function waitSlot(timeoutMs) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const slot = takeSlot();
    if (slot) return slot;
    if (Date.now() > end) throw new Error("aucun slot Electron libre (LOT.md : deux au plus)");
    await new Promise((r) => setTimeout(r, 5000));
  }
}

/**
 * Lance l'app. `env` s'ajoute à l'environnement (ex. `TENTACLE_LIQUID_GLASS:
 * "off"`). `home` : dossier du profil ; `fresh` l'efface d'abord.
 */
export async function launchApp({ home, fresh = false, env = {}, log, slotTimeoutMs = 30 * 60_000, command = null, startTimeoutMs = 60_000 }) {
  const slot = await waitSlot(slotTimeoutMs);
  if (fresh) rmSync(home, { recursive: true, force: true });
  mkdirSync(path.join(home, "Library/Application Support"), { recursive: true });
  const out = openSync(log, "a");
  const flags = [`--remote-debugging-port=${PORTS.page}`, `--inspect=${PORTS.main}`];
  // `command` : lancer AUTRE chose que le binaire (ex. `pnpm dev:electron` d'un
  // clone propre) — les drapeaux sont ajoutés en fin de commande.
  const [bin, binArgs, cwd] = command
    ? [command.bin, [...command.args, ...flags], command.cwd]
    : [ELECTRON, [".", ...flags], DESKTOP_DIR];
  const child = spawn(
    bin,
    binArgs,
    {
      cwd,
      detached: command !== null,
      env: { ...process.env, CFFIXED_USER_HOME: home, TENTACLE_SANS_DEVTOOLS: "1", ...env },
      stdio: ["ignore", out, out],
    },
  );
  const app = { child, pid: child.pid, slot, page: null, main: null };
  try {
    const target = await waitForTarget(PORTS.page, (url) => url.startsWith("tentacle://"), startTimeoutMs);
    app.page = await Cdp.connect(target.webSocketDebuggerUrl);
    await app.page.send("Runtime.enable");
    app.main = await connectMain();
  } catch (error) {
    await stopApp(app);
    throw error;
  }
  return app;
}

/** L'inspecteur Node du processus principal (`--inspect`). */
async function connectMain() {
  const end = Date.now() + 30_000;
  for (;;) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORTS.main}/json/list`)).json();
      if (list[0]) {
        const main = await Cdp.connect(list[0].webSocketDebuggerUrl);
        await main.send("Runtime.enable");
        return main;
      }
    } catch {
      // Pas encore prêt.
    }
    if (Date.now() > end) return null;
    await new Promise((r) => setTimeout(r, 300));
  }
}

/**
 * Évalue dans le processus PRINCIPAL. `require` n'existe pas dans la portée de
 * l'inspecteur : on passe par `process.mainModule.require`.
 */
export async function evalMain(app, body) {
  if (!app.main) throw new Error("inspecteur du principal indisponible");
  const result = await app.main.send("Runtime.evaluate", {
    expression: `(async () => { const require = process.mainModule.require; ${body} })()`,
    awaitPromise: true,
    returnByValue: true,
    includeCommandLineAPI: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result.value;
}

export async function stopApp(app) {
  app.page?.close();
  app.main?.close();
  if (app.child.exitCode === null) {
    // Commande détachée (pnpm → electron) : on tue SON groupe de processus,
    // et lui seul (pid négatif) — jamais un pkill -f.
    if (app.child.spawnargs[0] !== ELECTRON) {
      try { process.kill(-app.child.pid, "SIGTERM"); } catch { /* déjà parti */ }
    }
    app.child.kill("SIGTERM");
    const gone = await Promise.race([
      new Promise((r) => app.child.once("exit", () => r(true))),
      new Promise((r) => setTimeout(() => r(false), 8000)),
    ]);
    if (!gone) app.child.kill("SIGKILL");
  }
  try {
    rmdirSync(app.slot);
  } catch {
    // Déjà rendu.
  }
}
