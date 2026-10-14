import type { PreviewPlacement } from "./previewPlacement";

/**
 * La mini-carte ACCROCHÉE à sa carte pendant un défilement — règles pures.
 *
 *   • La PAGE défile : la mini-carte est posée en coordonnées du DOCUMENT
 *     (`position: absolute`, portail sur <body>) — elle défile avec la page,
 *     sur le compositeur, au pixel près, sans une ligne de JavaScript.
 *   • Une RANGÉE défile : la mini-carte n'est pas dans la rangée (elle y
 *     serait rognée) ; elle la suit d'un `translate`. La molette et le pavé
 *     tactile y sont pris EN MAIN (`horizontalWheelDelta`) : la rangée et la
 *     mini-carte bougent dans la même image — un défilement natif irait plus
 *     vite que le JavaScript, et la mini-carte traînerait d'une image.
 *
 * Elle ne sort jamais de sa place (`followOutOfPlace`) : jamais sous la barre
 * du haut, jamais hors de la fenêtre, jamais loin de sa carte sortie de la
 * rangée. Plutôt que d'y aller, elle se ferme — une image AVANT : le
 * défilement de la page va plus vite que l'écouteur qui la ferme.
 */

/** La place de la fenêtre, portée dans le document. */
export function inDocument(placement: PreviewPlacement, scroll: { x: number; y: number }): PreviewPlacement {
  return { ...placement, left: placement.left + scroll.x, top: placement.top + scroll.y };
}

export interface FollowFrame {
  /** La mini-carte, telle qu'elle est à l'écran (coordonnées de fenêtre). */
  box: { left: number; top: number; width: number; height: number };
  /** Sa carte, sur l'axe horizontal (coordonnées de fenêtre). */
  card: { left: number; right: number };
  /** Ce qu'on voit de la rangée qui défile, `null` hors d'une rangée qui défile. */
  view: { left: number; right: number } | null;
  viewport: { width: number; height: number; safeTop: number };
  /** Le dernier pas du défilement de la page (px, positif vers le bas). */
  step: number;
}

/** La mini-carte sortirait-elle de sa place à la prochaine image ? */
export function followOutOfPlace(frame: FollowFrame): boolean {
  const { box, card, view, viewport, step } = frame;
  // La page descend : la mini-carte monte vers la barre ; elle remonte : vers le bas.
  if (box.top - Math.max(0, step) < viewport.safeTop) return true;
  if (box.top + box.height + Math.max(0, -step) > viewport.height) return true;
  if (box.left < 0 || box.left + box.width > viewport.width) return true;
  if (view) {
    const center = (card.left + card.right) / 2;
    if (center < view.left || center > view.right) return true;
  }
  return false;
}

/** Un pas de molette exprimé en lignes vaut ~40 px dans Chromium ; une page, 90 % de la rangée. */
const LINE_PX = 40;
const PAGE_RATIO = 0.9;

export interface WheelLike {
  deltaX: number;
  deltaY: number;
  /** 0 : pixels, 1 : lignes, 2 : pages. */
  deltaMode: number;
  shiftKey: boolean;
}

/**
 * Le pas HORIZONTAL d'un évènement de molette (px), ou `null` s'il ne l'est
 * pas d'abord — la page défile alors normalement. Maj + molette verticale
 * (Windows, Linux) vaut un pas horizontal.
 */
export function horizontalWheelDelta(e: WheelLike, pageWidth: number): number | null {
  const unit = e.deltaMode === 1 ? LINE_PX : e.deltaMode === 2 ? pageWidth * PAGE_RATIO : 1;
  let dx = e.deltaX * unit;
  let dy = e.deltaY * unit;
  if (e.shiftKey && dx === 0) {
    dx = dy;
    dy = 0;
  }
  return Math.abs(dx) > Math.abs(dy) ? dx : null;
}
