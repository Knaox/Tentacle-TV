/**
 * Le redimensionnement NATIF du PiP (macOS, Windows) : ratio verrouillé, taille
 * bornée, coin d'ancrage gardé.
 *
 * # Pourquoi natif
 *
 * Les poignées de la page ne montrent leur curseur que dans la fenêtre ACTIVE
 * (« key ») : le PiP, montré sans focus, gardait la flèche au survol d'un coin,
 * et rien ne disait qu'on pouvait le tirer (retour de Damien, 10.10.2026). Une
 * fenêtre redimensionnable, elle, reçoit du système le curseur diagonal au
 * survol de ses coins sans clic préalable quand l'application est active — et
 * se laisse tirer d'emblée quand elle ne l'est pas (le curseur reste alors la
 * flèche : macOS ne laisse pas une application en arrière-plan le changer).
 * Mesuré : la zone vaut ~8 points au coin et ~4 au bord, comptés depuis le
 * bord de la fenêtre — d'où la marge étroite hors Linux (`pipFrame.ts`), qui la
 * fait chevaucher le cadre visible. Les poignées de la page restent, plus loin
 * vers l'intérieur.
 *
 * # Ce que la coquille y ajoute
 *
 * - le ratio de l'image, cadre en plus (`setAspectRatio`, taille d'appoint) ;
 * - les bornes du PiP : la taille minimale des boutons, la part d'écran ou
 *   d'application (`PIP_MAX_SHARE`) ;
 * - ancré, le coin bas-droit reste collé à celui de l'application, quel que
 *   soit le coin tiré.
 */

import type { BrowserWindow } from "electron";
import { PIP_INSET, PIP_MIN_HEIGHT, PIP_MIN_WIDTH, pipWindowSize } from "./pipFrame";
import type { PipMode } from "./pipCaptions";
import { cornerPlacement, type Box } from "./pipPlacement";

export interface ResizeRules {
  mode(): PipMode;
  /** Le coin d'ancrage : la zone de contenu de l'application. */
  dockArea(): Box;
  /** La plus grande largeur de VIDÉO permise. */
  maxVideoWidth(): number;
}

/** La taille de fenêtre permise la plus proche, au ratio `aspect` de la vidéo. */
export function boundedSize(width: number, aspect: number, maxVideoWidth: number): { width: number; height: number } {
  let video = Math.min(width - 2 * PIP_INSET, Math.max(maxVideoWidth, PIP_MIN_WIDTH));
  video = Math.max(video, PIP_MIN_WIDTH, PIP_MIN_HEIGHT * aspect);
  return pipWindowSize(video, video / aspect);
}

/** Flottant, une taille bornée : le bord que la main ne tire pas reste en place. */
function anchored(current: Box, next: Box, size: { width: number; height: number }): Box {
  const x = next.x !== current.x ? current.x + current.width - size.width : current.x;
  const y = next.y !== current.y ? current.y + current.height - size.height : current.y;
  return { x, y, ...size };
}

/** Pose les règles sur la fenêtre PiP ; rend de quoi les retirer. */
export function installResizeGuard(pip: BrowserWindow, aspect: number, rules: ResizeRules): () => void {
  pip.setAspectRatio(aspect, { width: 2 * PIP_INSET, height: 2 * PIP_INSET });
  const guard = (event: Electron.Event, next: Electron.Rectangle): void => {
    const size = boundedSize(next.width, aspect, rules.maxVideoWidth());
    const target: Box =
      rules.mode() === "docked" ? cornerPlacement(size, rules.dockArea()) : anchored(pip.getBounds(), next, size);
    const same =
      target.x === next.x && target.y === next.y && target.width === next.width && target.height === next.height;
    if (same) return;
    event.preventDefault();
    pip.setBounds(target);
  };
  pip.on("will-resize", guard);
  return () => {
    if (!pip.isDestroyed()) pip.off("will-resize", guard);
  };
}
