/**
 * Le passage lecteur ↔ PiP — règles pures : d'où part la fenêtre PiP, où elle
 * arrive, et la courbe entre les deux.
 *
 * La vidéo ne change jamais d'instance : sur macOS c'est la MÊME fenêtre de
 * mpv, fille de la fenêtre PiP (`video/macosPipParent.ts`). Animer le cadre du
 * PiP, c'est donc animer l'image elle-même : elle part de là où le lecteur la
 * montrait — l'image, pas la zone et ses bandes noires — et rejoint son coin.
 * Au retour, l'inverse, puis le lecteur la reprend au même endroit.
 */

import { PIP_INSET } from "./pipFrame";
import type { Box } from "./pipPlacement";

/** Réduire : l'image entre dans son coin. */
export const PIP_SHRINK_MS = 280;
/** Agrandir : plus court — on attend le lecteur, pas le geste. */
export const PIP_GROW_MS = 220;
/** Un cran de molette : la taille y glisse, sans traîner derrière la main. */
export const PIP_RESIZE_MS = 120;

/** Décélération franche — l'image « se pose » (ease-out cubique). */
export function easeOutCubic(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return 1 - (1 - clamped) ** 3;
}

/** Le rectangle à l'avancement `t` (0 → 1), au point près. */
export function interpolateBox(from: Box, to: Box, t: number): Box {
  const at = (a: number, b: number): number => Math.round(a + (b - a) * t);
  return {
    x: at(from.x, to.x),
    y: at(from.y, to.y),
    width: at(from.width, to.width),
    height: at(from.height, to.height),
  };
}

/**
 * L'image dans la zone du lecteur, au ratio `aspect` : ce que mpv y montre,
 * bandes noires exclues (centrée, comme `keepaspect`).
 */
export function pictureIn(area: Box, aspect: number): Box {
  const ratio = Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9;
  const width = Math.min(area.width, area.height * ratio);
  const height = width / ratio;
  return {
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + (area.height - height) / 2),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/** La fenêtre PiP dont la vidéo occupe exactement `picture` : liseré et ombre autour. */
export function windowAround(picture: Box): Box {
  return {
    x: picture.x - PIP_INSET,
    y: picture.y - PIP_INSET,
    width: picture.width + 2 * PIP_INSET,
    height: picture.height + 2 * PIP_INSET,
  };
}
