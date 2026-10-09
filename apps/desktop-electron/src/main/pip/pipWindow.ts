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
 * # Ce que le banc du 09.10.2026 a mesuré
 *
 * Electron 43 ne donne AUCUNE marge de redimensionnement à une fenêtre
 * transparente sans cadre sous Linux (`ElectronFrameViewLayoutLinux` : insets
 * nuls pour une fenêtre translucide). La taille change donc par la page (la
 * molette, `pip_resize`), et la colle garde fixe le coin le plus proche du
 * bord. Le glisser, lui, passe par `app-region: drag` : il marche sous Wayland,
 * la fenêtre suit la souris d'un écran à l'autre.
 */

import type { BrowserWindow, WebContents } from "electron";
import { windowIconPath } from "../appIcon";
import { lockNavigation } from "../security";
import { PIP_CAPTIONS, type PipMode } from "./pipCaptions";

/** Le nom de cadre que la page donne à `window.open` — et qu'elle seule connaît. */
export const PIP_FRAME_NAME = "tentacle-pip";

/** Le délai dans lequel la page doit ouvrir la fenêtre annoncée. */
const ARM_DELAY_MS = 3000;

/** En deçà, les boutons du PiP ne tiennent plus. */
export const PIP_MIN_WIDTH = 256;
export const PIP_MIN_HEIGHT = 144;

interface Armed {
  mode: PipMode;
  width: number;
  height: number;
  until: number;
}

let armed: Armed | null = null;
let pip: BrowserWindow | null = null;

/** La page annonce l'ouverture : la prochaine fenêtre PiP sera acceptée. */
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
  return {
    action: "allow",
    overrideBrowserWindowOptions: {
      width: wanted.width,
      height: wanted.height,
      minWidth: PIP_MIN_WIDTH,
      minHeight: PIP_MIN_HEIGHT,
      title: PIP_CAPTIONS[wanted.mode],
      ...(icon === null ? {} : { icon }),
      // Transparente À LA CONSTRUCTION, comme la fenêtre principale
      // (`linux/window.ts`) : posée après, la page peindrait du noir sur mpv.
      transparent: true,
      backgroundColor: "#00000000",
      frame: false,
      hasShadow: false,
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

/** Bascule le mode : un autre titre (la colle suit), et la taille qui va avec. */
export function setPipMode(mode: PipMode, width?: number, height?: number): boolean {
  if (pip === null || pip.isDestroyed()) return false;
  pip.setTitle(PIP_CAPTIONS[mode]);
  pip.setAlwaysOnTop(mode === "floating");
  if (width !== undefined && height !== undefined) resizePip(width, height);
  return true;
}

/** La nouvelle taille ; la colle garde fixe le coin le plus proche du bord. */
export function resizePip(width: number, height: number): boolean {
  if (pip === null || pip.isDestroyed()) return false;
  pip.setSize(Math.max(PIP_MIN_WIDTH, Math.round(width)), Math.max(PIP_MIN_HEIGHT, Math.round(height)));
  return true;
}

/** La fenêtre principale se ferme : le PiP, qui vit de sa page, avec elle. */
export function closePip(): void {
  if (pip !== null && !pip.isDestroyed()) pip.close();
  pip = null;
  armed = null;
}
