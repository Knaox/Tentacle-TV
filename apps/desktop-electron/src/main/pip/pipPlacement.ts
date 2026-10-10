/**
 * Où poser la fenêtre PiP, et comment elle suit un geste — règles pures.
 *
 * Sous Linux, la colle KWin place le PiP et exécute les gestes
 * (`linux/glueQml/pipQml.ts`, `pipGestureQml.ts`). Ailleurs — macOS, Windows —
 * la coquille sait placer ses fenêtres elle-même (`pipShell.ts`) : ces règles
 * sont celles de la colle, à l'identique, pour que le PiP se comporte de la
 * même façon partout.
 *
 * Tout est en points logiques d'Electron, origine en haut à gauche, et porte
 * sur la FENÊTRE PiP — vidéo, liseré et ombre (`pipFrame.ts`). Les marges se
 * comptent au cadre VISIBLE : l'ombre, elle, peut déborder.
 */

import type { PipGesture } from "./pipCaptions";
import { PIP_MARGIN } from "./pipCaptions";
import { PIP_FRAME, PIP_INSET, PIP_MIN_HEIGHT, PIP_MIN_WIDTH } from "./pipFrame";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export type PipCorner = Exclude<PipGesture, "move">;

const SHADOW = PIP_FRAME.shadow;

/** Le coin bas-droit de `area`, le cadre visible à la marge du bord. */
export function cornerPlacement(size: { width: number; height: number }, area: Box): Box {
  const margin = PIP_MARGIN - SHADOW;
  return {
    x: Math.round(area.x + area.width - size.width - margin),
    y: Math.round(area.y + area.height - size.height - margin),
    width: size.width,
    height: size.height,
  };
}

/** Le cadre visible gardé dans `area` — l'ombre peut en déborder. */
export function clampVisible(box: Box, area: Box): Box {
  const x = Math.max(area.x - SHADOW, Math.min(box.x, area.x + area.width - box.width + SHADOW));
  const y = Math.max(area.y - SHADOW, Math.min(box.y, area.y + area.height - box.height + SHADOW));
  return { ...box, x: Math.round(x), y: Math.round(y) };
}

/**
 * Une nouvelle taille (molette, bascule de mode) : le coin le plus proche du
 * bord de `area` reste fixe — le PiP rangé en bas à droite grandit vers le
 * haut et la gauche.
 */
export function resizeInPlace(before: Box, size: { width: number; height: number }, area: Box): Box {
  const right = before.x + before.width / 2 > area.x + area.width / 2;
  const bottom = before.y + before.height / 2 > area.y + area.height / 2;
  const x = right ? before.x + before.width - size.width : before.x;
  const y = bottom ? before.y + before.height - size.height : before.y;
  return clampVisible({ x, y, width: size.width, height: size.height }, area);
}

/** Glisser : le point saisi (`grab`, dans la fenêtre) reste sous le curseur. */
export function dragTo(start: Box, grab: Point, cursor: Point, area: Box): Box {
  return clampVisible({ ...start, x: cursor.x - grab.x, y: cursor.y - grab.y }, area);
}

/**
 * Tirer un coin : le coin opposé reste fixe, le ratio de l'image est gardé. La
 * taille suit la projection du déplacement sur la diagonale du PiP : un geste
 * seulement horizontal (ou vertical) agit aussi, à mi-course. `maxVideoWidth` :
 * la plus grande largeur de VIDÉO permise (`PIP_MAX_SHARE`).
 */
export function stretchFrom(start: Box, corner: PipCorner, dx: number, dy: number, maxVideoWidth: number): Box {
  const left = corner.endsWith("left");
  const top = corner.startsWith("top");
  const w0 = start.width - 2 * PIP_INSET;
  const h0 = start.height - 2 * PIP_INSET;
  const w1 = w0 + (left ? -dx : dx);
  const h1 = h0 + (top ? -dy : dy);
  const aspect = w0 / h0;
  let w = (w0 * (w1 * w0 + h1 * h0)) / (w0 * w0 + h0 * h0);
  w = Math.min(w, Math.max(maxVideoWidth, PIP_MIN_WIDTH));
  w = Math.max(w, PIP_MIN_WIDTH, PIP_MIN_HEIGHT * aspect);
  const height = Math.round(w / aspect) + 2 * PIP_INSET;
  const width = Math.round(w) + 2 * PIP_INSET;
  return {
    x: left ? start.x + start.width - width : start.x,
    y: top ? start.y + start.height - height : start.y,
    width,
    height,
  };
}
