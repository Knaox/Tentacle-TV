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
import { mkdirSync, openSync, rmSync, rmdirSync, writeSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Cdp, waitForTarget } from "./cdp.mjs";
import { waitHidIdle } from "./macos.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DESKTOP_DIR = path.resolve(HERE, "../../..");
const ROOT = path.resolve(DESKTOP_DIR, "../..");
const ELECTRON = path.join(ROOT, "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron");
const LOCKS = "/Users/damienrouge/Desktop/Projet - local/.claude/locks/lg";

// Ports surchargeables : deux bancs du même lot tournent côte à côte (lg2 : 3115 / 9335 / 9435).
export const PORTS = {
  backend: Number(process.env.BANC_PORT_BACKEND ?? 3107),
  page: Number(process.env.BANC_PORT_CDP ?? 9307),
  main: Number(process.env.BANC_PORT_MAIN ?? 9407),
};

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
export async function launchApp({ home, fresh = false, env = {}, log, slotTimeoutMs = 30 * 60_000, command = null, startTimeoutMs = 60_000, fullWindow = false }) {
  // LOT.md : jamais une fenêtre sous les doigts de Damien. Mode « coin »
  // (BANC_COIN=1, défaut) : chaque fenêtre naît dans le coin bas-droit, 60 px
  // visibles seulement, sans focus — jamais occultée (Chromium et mpv
  // cessent de peindre une fenêtre cachée), jamais devant lui. Sinon : attendre
  // 120 s d'inactivité.
  // `fullWindow` : la cellule mesure ce que l'écran MONTRE (ton échantillonné
  // sous la vidéo) — au coin, la vidéo hors écran n'est pas peinte.
  const corner = process.env.BANC_COIN !== "0" && !fullWindow;
  if (!corner && !(await waitHidIdle(120))) throw new Error("Damien actif depuis plus d'une heure : lancement reporté");
  const slot = await waitSlot(slotTimeoutMs);
  if (fresh) rmSync(home, { recursive: true, force: true });
  mkdirSync(path.join(home, "Library/Application Support"), { recursive: true });
  const out = openSync(log, "a");
  writeSync(out, `[banc] slot ${path.basename(slot)} pris à ${new Date().toISOString()}\n`);
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
      env: { ...process.env, CFFIXED_USER_HOME: home, TENTACLE_SANS_DEVTOOLS: "1", TENTACLE_BENCH_INACTIVE: "1", ...env },
      stdio: ["ignore", out, out],
    },
  );
  const app = { child, pid: child.pid, slot, page: null, main: null };
  try {
    if (corner) await placeInCorner(startTimeoutMs);
    const target = await waitForTarget(PORTS.page, (url) => url.startsWith("tentacle://"), startTimeoutMs);
    app.page = await Cdp.connect(target.webSocketDebuggerUrl);
    await app.page.send("Runtime.enable");
    app.main = await connectMain();
    await watchFocus(app);
  } catch (error) {
    await stopApp(app);
    throw error;
  }
  return app;
}

/**
 * Mode « coin » : l'inspecteur du principal répond dès le démarrage, bien avant
 * la fenêtre. On y pose, par `process.mainModule.require`, l'écouteur qui place
 * chaque fenêtre au coin bas-droit (60 px visibles) dès sa création — rien
 * n'est injecté dans l'app (un préchargement `--require` cassait son
 * `require("electron")`, 22/10).
 */
async function placeInCorner(timeoutMs) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORTS.main}/json/list`)).json();
      if (list[0]) {
        const main = await Cdp.connect(list[0].webSocketDebuggerUrl);
        try {
          const r = await main.send("Runtime.evaluate", {
            returnByValue: true,
            expression: `(() => {
              const req = process.mainModule?.require;
              if (!req) return "pas-encore";
              const { app, screen } = req("electron");
              const corner = (w) => {
                if (w.isDestroyed() || w.isFullScreen()) return;
                const a = screen.getPrimaryDisplay().workArea;
                w.setPosition(a.x + a.width - 60, a.y + a.height - 60);
              };
              app.on("browser-window-created", (_e, w) => {
                corner(w);
                w.once("ready-to-show", () => corner(w));
                w.on("show", () => corner(w));
              });
              return "pose";
            })()`,
          });
          if (r.result?.value === "pose") return;
        } finally {
          main.close();
        }
      }
    } catch {
      // Pas encore prêt.
    }
    if (Date.now() > end) throw new Error("placement au coin impossible (inspecteur du principal)");
    await new Promise((r) => setTimeout(r, 50));
  }
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

/**
 * Mouchard du focus (22/10) : qui donne le focus à une fenêtre du banc ? Chaque
 * `browser-window-focus` est noté avec son heure et la pile JS du moment — un
 * `win.focus()` de l'app y paraît ; un clic ou une activation de macOS, non.
 */
async function watchFocus(app) {
  await evalMain(app, `
    globalThis.__bancFocus = [];
    require("electron").app.on("browser-window-focus", (_e, w) => {
      globalThis.__bancFocus.push({ at: new Date().toISOString(), title: w.getTitle(), stack: new Error().stack.split("\n").slice(2, 9).join(" | ") });
    });
    return true;
  `).catch(() => {});
}

/** Les prises de focus notées depuis le lancement. */
export async function focusEvents(app) {
  return evalMain(app, "return globalThis.__bancFocus ?? [];").catch(() => []);
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
