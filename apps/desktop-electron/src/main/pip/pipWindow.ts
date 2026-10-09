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

import type { BrowserWindow, WebContents } from "electron";
import { windowIconPath } from "../appIcon";
import { lockNavigation } from "../security";
import { pipCaption, type PipGesture, type PipMode, type PipPoint } from "./pipCaptions";
import { PIP_INSET, PIP_MIN_HEIGHT, PIP_MIN_WIDTH, pipWindowSize } from "./pipFrame";

/** Le nom de cadre que la page donne à `window.open` — et qu'elle seule connaît. */
export const PIP_FRAME_NAME = "tentacle-pip";

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
/** Le mode de la fenêtre ouverte : le titre d'un geste le reprend. */
let pipMode: PipMode = "floating";

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
  return {
    action: "allow",
    overrideBrowserWindowOptions: {
      width: size.width,
      height: size.height,
      minWidth: PIP_MIN_WIDTH + 2 * PIP_INSET,
      minHeight: PIP_MIN_HEIGHT + 2 * PIP_INSET,
      title: pipCaption(wanted.mode, null),
      ...(icon === null ? {} : { icon }),
      // Transparente À LA CONSTRUCTION, comme la fenêtre principale
      // (`linux/window.ts`) : posée après, la page peindrait du noir sur mpv.
      transparent: true,
      backgroundColor: "#00000000",
      frame: false,
      hasShadow: false,
      // La colle la redimensionne aux poignées : une fenêtre non redimensionnable
      // a, sous Linux, sa taille minimale ÉGALE à sa maximale, et KWin
      // refuserait. Aucun double-clic n'agrandit pour autant : faute de zone
      // `app-region: drag`, Chromium n'en reçoit aucun sur un « titre ».
      resizable: true,
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
    // Montrée sans prendre le focus : l'utilisateur continue dans l'application
    // (la colle rend de toute façon l'activation à l'hôte).
    let shown = false;
    const show = (): void => {
      if (shown || child.isDestroyed()) return;
      shown = true;
      child.showInactive();
    };
    child.once("ready-to-show", show);
    setTimeout(show, 500);
    child.on("closed", () => {
      if (pip === child) pip = null;
    });
  });
}

/** Bascule le mode : un autre titre (la colle suit), et la taille de vidéo qui va avec. */
export function setPipMode(mode: PipMode, width?: number, height?: number): boolean {
  if (pip === null || pip.isDestroyed()) return false;
  pipMode = mode;
  pip.setTitle(pipCaption(mode, null));
  pip.setAlwaysOnTop(mode === "floating");
  if (width !== undefined && height !== undefined) resizePip(width, height);
  return true;
}

/** La nouvelle taille de VIDÉO ; la colle garde fixe le coin le plus proche du bord. */
export function resizePip(width: number, height: number): boolean {
  if (pip === null || pip.isDestroyed()) return false;
  const size = pipWindowSize(width, height);
  pip.setSize(size.width, size.height);
  return true;
}

/**
 * Le geste que la page commence (ou finit, `null`) : la colle le lit dans le
 * titre et suit le curseur tant qu'il y est. `grab` : le point saisi, pour
 * glisser.
 */
export function setPipGesture(gesture: PipGesture | null, grab?: PipPoint): boolean {
  if (pip === null || pip.isDestroyed()) return false;
  pip.setTitle(pipCaption(pipMode, gesture, grab));
  return true;
}

/** La fenêtre principale se ferme : le PiP, qui vit de sa page, avec elle. */
export function closePip(): void {
  if (pip !== null && !pip.isDestroyed()) pip.close();
  pip = null;
  armed = null;
}
