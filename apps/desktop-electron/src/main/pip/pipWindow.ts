/**
 * La fenêtre PiP — ouverte PAR LA PAGE (`window.open`), fabriquée ici.
 *
 * # Pourquoi la page l'ouvre elle-même
 *
 * Ce qu'affiche le PiP (ses boutons, sa progression) est rendu par la page dans
 * cette fenêtre, par un portail React : même contexte JavaScript, mêmes
 * traductions, les gestes du lecteur appelés directement — aucun relais IPC,
 * aucune seconde page à tenir. La coquille ne fait que FABRIQUER la fenêtre :
 * transparente (mpv est dessous, collé par KWin), sans cadre, hors barre des
 * tâches, et sous le titre qui la désigne à la colle (`pipCaptions.ts`).
 *
 * # Armée, et à usage unique
 *
 * Le filtre `window.open` de la fenêtre principale refuse tout (`security.ts`).
 * Une seule exception : une fenêtre nommée `PIP_FRAME_NAME`, sur `about:blank`,
 * dans les secondes qui suivent la commande `pip_open` — que seule notre page
 * peut envoyer (émetteur vérifié par `ipc/registry.ts`). Le document d'un
 * greffon (autre origine, même webContents) ne peut donc pas ouvrir une
 * fenêtre que la colle prendrait pour le PiP.
 *
 * # La taille, le cadre, les gestes
 *
 * La page donne la taille de la VIDÉO ; la fenêtre la déborde du cadre
 * (`pipFrame.ts` : liseré et ombre), et la colle place mpv à l'intérieur.
 *
 * Electron 43 ne donne AUCUNE marge de redimensionnement à une fenêtre
 * transparente sans cadre sous Linux (`ElectronFrameViewLayoutLinux` : insets
 * nuls pour une fenêtre translucide), et `app-region: drag` prive la page de la
 * souris (banc du 09.10.2026). Glisser et redimensionner sont donc des GESTES
 * que la page annonce (`pip_gesture`) et que la colle exécute en suivant le
 * curseur — par le titre, la seule voie de la coquille vers la colle.
 * La molette, elle, change la taille par la page (`pip_resize`).
 */

import { BrowserWindow, type WebContents } from "electron";
import { windowIconPath } from "../appIcon";
import { lockNavigation } from "../security";
import { pipCaption, pipCommandCaption, type PipGesture, type PipMode, type PipPoint } from "./pipCaptions";
import { setPipWindow } from "./pipHost";
import { PIP_GROW_MS, PIP_RESIZE_MS, PIP_SHRINK_MS } from "./pipMotion";
import { PipShell, reducedMotion, shellDrivesPip } from "./pipShell";
import { PIP_INSET, PIP_MIN_HEIGHT, PIP_MIN_WIDTH, pipWindowSize } from "./pipFrame";

/** Le nom de cadre que la page donne à `window.open` — et qu'elle seule connaît. */
export const PIP_FRAME_NAME = "tentacle-pip";

const WINDOWS = process.platform === "win32";

/** Le délai dans lequel la page doit ouvrir la fenêtre annoncée. */
const ARM_DELAY_MS = 3000;

interface Armed {
  mode: PipMode;
  /** La taille de la VIDÉO. */
  width: number;
  height: number;
  until: number;
}

let armed: Armed | null = null;
let pip: BrowserWindow | null = null;
/** Hors Linux, la coquille place le PiP et suit ses gestes — `pipShell.ts`. */
let shell: PipShell | null = null;
/** Le mode de la fenêtre ouverte : le titre d'un geste le reprend. */
let pipMode: PipMode = "floating";
/** Le ratio de la vidéo annoncée : le PiP naît sur l'image du lecteur (`pipShell.ts`). */
let pipAspect = 16 / 9;

/** La page annonce l'ouverture (taille de la VIDÉO) : la prochaine fenêtre PiP sera acceptée. */
export function armPip(mode: PipMode, width: number, height: number): void {
  armed = { mode, width, height, until: Date.now() + ARM_DELAY_MS };
}

/**
 * La réponse du filtre `window.open` pour la fenêtre PiP, ou `null` quand la
 * demande ne la concerne pas (le filtre ordinaire s'applique alors).
 */
export function pipWindowOpen(details: Electron.HandlerDetails): Electron.WindowOpenHandlerResponse | null {
  if (details.frameName !== PIP_FRAME_NAME) return null;
  const wanted = armed;
  armed = null;
  if (details.url !== "about:blank" || wanted === null || Date.now() > wanted.until || pip !== null) {
    return { action: "deny" };
  }
  const icon = windowIconPath();
  const size = pipWindowSize(wanted.width, wanted.height);
  pipMode = wanted.mode;
  pipAspect = wanted.width / wanted.height;
  return {
    action: "allow",
    overrideBrowserWindowOptions: {
      width: size.width,
      height: size.height,
      minWidth: PIP_MIN_WIDTH + 2 * PIP_INSET,
      minHeight: PIP_MIN_HEIGHT + 2 * PIP_INSET,
      // Sous Linux, le titre de naissance demande aussi à la colle l'entrée
      // animée : l'image glisse du lecteur à son coin (`pipMotionQml.ts`).
      title: shellDrivesPip() || reducedMotion()
        ? pipCaption(wanted.mode, null)
        : pipCommandCaption(wanted.mode, { kind: "enter", ms: PIP_SHRINK_MS }),
      ...(icon === null ? {} : { icon }),
      // Transparente À LA CONSTRUCTION, comme la fenêtre principale
      // (`linux/window.ts`) : posée après, la page peindrait du noir sur mpv.
      // Sauf sous Windows, comme la fenêtre principale là aussi : le drapeau y
      // retire les bords et le redimensionnement ; la surface de Chromium y
      // devient transparente par `setBackgroundColor`, À L'EXÉCUTION
      // (`installPipWindow`), et la vidéo — fenêtre FILLE — se voit dessous.
      transparent: !WINDOWS,
      backgroundColor: WINDOWS ? "#000000" : "#00000000",
      frame: false,
      // L'ombre d'une fenêtre transparente coûte le GPU sur macOS (CLAUDE.md,
      // « Coût GPU ») ; sous Windows, c'est celle du système, avec ses coins.
      hasShadow: WINDOWS,
      // La colle la redimensionne aux poignées : une fenêtre non redimensionnable
      // a, sous Linux, sa taille minimale ÉGALE à sa maximale, et KWin
      // refuserait. Aucun double-clic n'agrandit pour autant : faute de zone
      // `app-region: drag`, Chromium n'en reçoit aucun sur un « titre ».
      // Ailleurs, le système la redimensionne, ratio et bornes tenus par la
      // coquille (`pipResizeGuard.ts`) : son curseur paraît sans clic.
      resizable: true,
      // macOS : le premier clic sur le PiP, application inactive, va au bouton
      // visé — sans cela il ne ferait qu'activer la fenêtre.
      acceptFirstMouse: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      // Inerte sous Wayland — la colle pose `keepAbove` — mais vrai sous X11.
      alwaysOnTop: wanted.mode === "floating",
      skipTaskbar: true,
      show: false,
      webPreferences: { backgroundThrottling: false },
    },
  };
}

/**
 * macOS : un clic dans le PiP lui donne le focus — et le premier clic suivant
 * dans la fenêtre principale ne servait plus qu'à la réactiver, sans rien
 * faire (retour de Damien). Le focus revient donc aussitôt à la fenêtre
 * principale : le PiP reçoit ses clics, glissers et bords sans l'avoir
 * (`acceptFirstMouse`), et l'application répond du premier coup. Jamais si
 * elle est réduite, cachée ou sur un autre bureau — la ramener changerait de
 * bureau. Windows et Linux livrent le premier clic d'une fenêtre inactive :
 * rien à faire.
 */
function returnFocus(host: BrowserWindow): void {
  if (host.isDestroyed() || host.isMinimized() || !host.isVisible() || host.isFocused()) return;
  // Import paresseux : `macosSpace.ts` charge le runtime Objective-C.
  void import("../video/macosSpace").then(({ onActiveSpace }) => {
    if (!host.isDestroyed() && !host.isFocused() && onActiveSpace(host)) host.focus();
  });
}

/** Branche la fabrication sur la fenêtre principale. */
export function installPipWindow(contents: WebContents): void {
  contents.on("did-create-window", (child, details) => {
    if (details.frameName !== PIP_FRAME_NAME) return;
    pip = child;
    const caption = child.getTitle();
    // Le titre est l'identifiant de la colle : jamais celui de la page.
    child.on("page-title-updated", (event) => event.preventDefault());
    child.setTitle(caption);
    lockNavigation(child.webContents);
    if (WINDOWS) child.setBackgroundColor("#00000000");
    const host = BrowserWindow.fromWebContents(contents);
    // Placé AVANT d'être montré, et avant que la vidéo n'y passe : jamais un
    // PiP — ni une image — qui saute de place.
    if (shellDrivesPip() && host !== null) shell = new PipShell(child, host, pipMode, pipAspect);
    if (process.platform === "darwin" && host !== null) child.on("focus", () => setImmediate(() => returnFocus(host)));
    setPipWindow(child);
    // Montrée sans prendre le focus : l'utilisateur continue dans l'application
    // (la colle rend de toute façon l'activation à l'hôte).
    let shown = false;
    const show = (): void => {
      if (shown || child.isDestroyed()) return;
      shown = true;
      child.showInactive();
      shell?.enter();
    };
    child.once("ready-to-show", show);
    setTimeout(show, 500);
    // À `close` et non `closed` : la fenêtre de mpv doit rejoindre la nôtre
    // tant que la `NSWindow` du PiP existe encore (macOS).
    child.once("close", () => {
      // Le PiP avait le focus (un clic dessus, « revenir au lecteur ») : il
      // revient à la fenêtre principale. Sans cela, macOS ne le rend à
      // personne — la page du lecteur ne recevait plus qu'UN mouvement de
      // souris, et ses contrôles ne répondaient qu'après un clic (banc du
      // 10.10.2026). Jamais si l'application est en arrière-plan : on ne vole
      // pas le premier plan. Sous Linux, la colle rend l'activation elle-même.
      if (shell !== null && host !== null && !host.isDestroyed() && child.isFocused()) host.focus();
      shell?.dispose();
      shell = null;
      setPipWindow(null);
    });
    child.on("closed", () => {
      if (pip === child) pip = null;
      setPipWindow(null);
    });
  });
}

/** Bascule le mode : un autre titre (la colle suit), et la taille de vidéo qui va avec. */
export function setPipMode(mode: PipMode, width?: number, height?: number): boolean {
  if (pip === null || pip.isDestroyed()) return false;
  pipMode = mode;
  pip.setTitle(pipCaption(mode, null));
  if (shell !== null) {
    shell.setMode(mode, width, height);
    return true;
  }
  pip.setAlwaysOnTop(mode === "floating");
  if (width !== undefined && height !== undefined) resizePip(width, height);
  return true;
}

/** La nouvelle taille de VIDÉO ; la colle garde fixe le coin le plus proche du bord. */
export function resizePip(width: number, height: number): boolean {
  if (pip === null || pip.isDestroyed()) return false;
  if (shell !== null) {
    shell.resize(width, height);
    return true;
  }
  // La colle glisse jusqu'à la nouvelle taille, comme la coquille ailleurs.
  const size = pipWindowSize(width, height);
  const ms = reducedMotion() ? 0 : PIP_RESIZE_MS;
  pip.setTitle(pipCommandCaption(pipMode, { kind: "size", width: size.width, height: size.height, ms }));
  return true;
}

/**
 * Le geste que la page commence (ou finit, `null`) : la colle le lit dans le
 * titre et suit le curseur tant qu'il y est. `grab` : le point saisi, pour
 * glisser.
 */
export function setPipGesture(gesture: PipGesture | null, grab?: PipPoint): boolean {
  if (pip === null || pip.isDestroyed()) return false;
  if (shell !== null) {
    shell.setGesture(gesture, grab);
    return true;
  }
  pip.setTitle(pipCaption(pipMode, gesture, grab));
  return true;
}

/**
 * La page ferme le PiP — par la coquille, jamais par `window.close()`.
 *
 * ⚠️ Fermée depuis la page qui l'a ouverte, la fenêtre n'émet PAS `close`,
 * seulement `closed` (mesuré) : la vidéo ne regagnait la fenêtre principale
 * qu'une fois la fenêtre native du PiP détruite, et le focus n'était rendu à
 * personne. Fermée ici, elle émet `close` d'abord (`installPipWindow`).
 */
export function closePipWindow(): boolean {
  if (pip === null || pip.isDestroyed()) return false;
  pip.close();
  return true;
}

/** Le temps laissé à la colle, après la course, pour poser la dernière image. */
const RESTORE_SETTLE_MS = 40;

/**
 * Le retour au lecteur : l'image regagne sa place dans le lecteur avant que la
 * page ne ferme le PiP — menée par la coquille, ou sous Linux par la colle,
 * qui lit la demande dans le titre ; la course a une durée fixe, attendue ici.
 */
export async function restorePip(): Promise<boolean> {
  if (shell !== null) {
    await shell.restore();
    return true;
  }
  if (pip === null || pip.isDestroyed() || reducedMotion()) return false;
  pip.setTitle(pipCommandCaption(pipMode, { kind: "restore", ms: PIP_GROW_MS }));
  await new Promise((done) => setTimeout(done, PIP_GROW_MS + RESTORE_SETTLE_MS));
  return true;
}

/** La fenêtre principale se ferme : le PiP, qui vit de sa page, avec elle. */
export function closePip(): void {
  if (pip !== null && !pip.isDestroyed()) pip.close();
  shell?.dispose();
  shell = null;
  pip = null;
  armed = null;
}
