/**
 * Fenêtre principale et plein écran.
 *
 * Les dimensions reprennent EXACTEMENT celles de l'app Tauri
 * (`tauri.windows.conf.json`) : 1280x800, minimum 900x600, décorée, fond noir.
 * La parité visuelle se joue aussi là.
 */

import { app, BrowserWindow, screen } from "electron";
import path from "node:path";
import { lockNavigation } from "./security";

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;
const MIN_WIDTH = 900;
const MIN_HEIGHT = 600;

let mainWindow: BrowserWindow | null = null;

/**
 * Mémoire du plein écran À L'ENTRÉE du lecteur.
 *
 * Le lecteur ne rend la fenêtre à l'état fenêtré que s'il l'a lui-même mise en
 * plein écran. Si l'utilisateur y était DÉJÀ avant de lancer la vidéo, quitter
 * le lecteur ne doit rien défaire : ce plein écran est le sien.
 *
 * L'état vit ici et non dans un ref React : le lecteur est démonté puis
 * remonté à chaque épisode (`key={itemId}`), et un ref repartirait à zéro
 * alors que la fenêtre, elle, est toujours en plein écran.
 */
let fullscreenOnEntry: boolean | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/**
 * @param commands Commandes réellement branchées, annoncées à la page.
 *   L'interface s'en sert pour masquer ce que ce shell ne sait pas encore
 *   faire, au lieu d'afficher un bouton qui rejette. Passées par argument de
 *   fabrication plutôt que par un canal : c'est disponible dès le preload,
 *   sans IPC synchrone et sans course au démarrage.
 */
export function createMainWindow(commands: readonly string[]): BrowserWindow {
  const win = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: "Tentacle",
    backgroundColor: "#000000",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      // Le lecteur doit continuer à rendre quand la fenêtre passe derrière :
      // sans ça, la barre de progression se fige pendant une lecture.
      backgroundThrottling: false,
      additionalArguments: [
        `--tentacle-version=${app.getVersion()}`,
        `--tentacle-platform=${process.platform}`,
        `--tentacle-commands=${commands.join(",")}`,
      ],
    },
  });

  lockNavigation(win.webContents);

  // Hors build empaqueté, on relaie la console du rendu et les échecs de
  // chargement dans le terminal. Sans ça, une violation de CSP ou un module
  // introuvable ne laisse qu'un écran noir, sans le moindre indice.
  //
  // Ce relais ne suffit PAS à lui seul : le build de production de `apps/web`
  // supprime `console.log`, `console.debug` et `console.info` (`pure` dans
  // `vite.config.ts`), et un échec au niveau du réseau n'écrit rien dans la
  // console du rendu. D'où les outils de développement, ouverts d'office.
  if (!app.isPackaged) {
    win.webContents.on("console-message", (event) => {
      console.log(`[rendu:${event.level}] ${event.message} (${event.lineNumber})`);
    });
    win.webContents.on("did-fail-load", (_e, code, description, url) => {
      console.error(`[rendu] chargement echoue ${code} ${description} — ${url}`);
    });
    win.webContents.on("did-finish-load", () => {
      console.log("[rendu] chargement termine");
    });
    win.webContents.on("render-process-gone", (_e, details) => {
      console.error(`[rendu] processus perdu: ${JSON.stringify(details)}`);
    });
    win.webContents.openDevTools({ mode: "detach" });
  }

  // Fenêtre révélée seulement quand la page est prête : sinon on montre un
  // rectangle vide le temps du premier rendu.
  win.once("ready-to-show", () => win.show());

  // Diffuse tout changement de plein écran, QUELLE QUE SOIT SA SOURCE —
  // bouton de la fenêtre, raccourci système, ou notre propre bascule. Sans
  // cette diffusion, l'icône du bouton et la touche Échap partaient en
  // désaccord avec la fenêtre réelle.
  const broadcast = (value: boolean): void => {
    if (!win.isDestroyed()) win.webContents.send("tentacle:window://fullscreen", value);
  };
  win.on("enter-full-screen", () => broadcast(true));
  win.on("leave-full-screen", () => broadcast(false));

  win.on("closed", () => {
    mainWindow = null;
  });

  mainWindow = win;
  return win;
}

/** Bascule le plein écran et renvoie le nouvel état. */
export function toggleFullscreen(): boolean {
  const win = mainWindow;
  if (!win) return false;
  const next = !win.isFullScreen();
  win.setFullScreen(next);
  return next;
}

/**
 * Ouvre la session plein écran du lecteur et renvoie l'état COURANT.
 * Idempotente : un changement d'épisode remonte le lecteur sans fermer la
 * session, la mémoire d'entrée n'est donc pas réécrite.
 */
export function enterPlayerFullscreenScope(): boolean {
  const win = mainWindow;
  if (!win) return false;
  const now = win.isFullScreen();
  if (fullscreenOnEntry === null) fullscreenOnEntry = now;
  return now;
}

/**
 * Ferme la session : ne sort du plein écran QUE si c'est le lecteur qui l'a
 * activé. Ne le ré-active jamais — si l'utilisateur en est sorti pendant la
 * lecture, on respecte son geste.
 */
export function leavePlayerFullscreenScope(): void {
  const win = mainWindow;
  const entry = fullscreenOnEntry;
  fullscreenOnEntry = null;
  if (win && entry === false && win.isFullScreen()) win.setFullScreen(false);
}

/**
 * Fréquence de rafraîchissement de l'écran qui porte la fenêtre.
 *
 * Sert à cadencer le rendu hors écran de l'interface. Mesuré en phase 0 :
 * figer ce plafond à 60 braderait les écrans 120, 144 ou 240 Hz, alors que le
 * rendu hors écran suit fidèlement la cadence demandée sans surcoût.
 */
export function displayRefreshRate(): number {
  const win = mainWindow;
  const point = win ? win.getBounds() : { x: 0, y: 0 };
  const display = screen.getDisplayNearestPoint({ x: point.x, y: point.y });
  const rate = display.displayFrequency;
  return Number.isFinite(rate) && rate >= 30 ? Math.round(rate) : 60;
}
