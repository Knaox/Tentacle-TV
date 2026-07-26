/**
 * Fenêtre principale et plein écran.
 *
 * Les dimensions reprennent EXACTEMENT celles de l'app Tauri
 * (`tauri.windows.conf.json`) : 1280x800, minimum 900x600, décorée, fond noir.
 * La parité visuelle se joue aussi là.
 */

import { app, BrowserWindow } from "electron";
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
    // Fenêtre ORDINAIRE : cadre natif, redimensionnable, plein écran.
    //
    // ⚠️ NE PAS y remettre `transparent: true`. Sous Windows, ce drapeau retire
    // le cadre, empêche le redimensionnement ET casse `setFullScreen` — on s'y
    // retrouve enfermé en plein écran, constaté. Il n'est de toute façon PAS
    // nécessaire : `setBackgroundColor` avec un alpha nul, appliqué à
    // l'EXÉCUTION, rend la surface de Chromium transparente et laisse voir la
    // fenêtre vidéo de mpv placée dessous. Mesuré sur maquette : cadre présent,
    // redimensionnement et agrandissement disponibles, vidéo visible.
    //
    // C'est le même partage que l'app Tauri, qui a abandonné `transparent`
    // pour la même raison : il fait deux choses, et une seule sert. Voir
    // `apps/desktop/src-tauri/src/mpv_window.rs:78` — la fenêtre transparente
    // en permanence sort Windows du chemin de présentation opaque et fait
    // scintiller chaque transition.
    //
    // La bascule se fait par `player_surface_transparent`, à l'entrée et à la
    // sortie du lecteur.
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

  // F11 sort du plein écran, quoi qu'il arrive.
  //
  // C'est le raccourci que tout le monde connaît sous Windows, et le menu
  // applicatif — retiré parce qu'il se voyait pendant la lecture — était le
  // seul à le fournir. Sans lui, un plein écran dont les contrôles ne se
  // révèlent pas devient une souricière. Traité AVANT la page, pour rester
  // valable même si l'interface est occupée.
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown" || input.key !== "F11") return;
    event.preventDefault();

    // DEUX plein-écrans coexistent et ne se recouvrent pas toujours : celui de
    // la FENÊTRE (`setFullScreen`, ce que déclenche notre commande
    // `toggle_fullscreen`) et celui du DOCUMENT (`requestFullscreen`, posé par
    // la page). N'en quitter qu'un donne exactement le symptôme observé : une
    // fenêtre dont on ne sort plus. F11 sort donc des DEUX, et n'entre que si
    // aucun des deux n'est actif — sans quoi la touche cesserait de basculer.
    const fenetre = win.isFullScreen();
    void win.webContents
      .executeJavaScript(
        "(() => { const e = !!document.fullscreenElement; if (e) document.exitFullscreen(); return e; })()",
        true,
      )
      .catch(() => false)
      .then((document: unknown) => {
        const etait = fenetre || document === true;
        win.setFullScreen(!etait);
        if (app.isPackaged) return;
        console.log(
          `[fenetre] F11 — avant : fenetre=${fenetre} document=${String(document)}` +
            ` → fenetre=${win.isFullScreen()}`,
        );
      });
  });

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
