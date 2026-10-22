/**
 * Le TON d'une grande surface (régime `surface`, lot lg2) : mesuré UNE fois, à
 * l'ouverture, puis TENU — jamais de bascule, jamais de bandes (Apple).
 *
 * Pourquoi autour, et pas dessous : l'échantillonneur de la coquille capture
 * la PAGE telle qu'elle est peinte, la surface comprise. Un verre épais
 * (0,78 de remplissage) mesuré sur son propre rectangle se mesurerait
 * lui-même — le ton supposé s'y confirmerait toujours. On lit donc la page sur
 * une COURONNE autour de la surface (gauche, droite, haut, et le bas plus loin,
 * au-delà de son ombre portée), et l'on prend la médiane de ces bandes : la
 * barre d'où pend un menu ne décide pas seule. Pur : testé sans navigateur.
 */

import type { GlassMaterial } from "./accessibility";
import { nextTone, type BackdropTone, type ToneRect } from "./backdropTone";

/** Épaisseur d'une bande de la couronne, en px. */
export const PROBE_THICKNESS = 16;
/** Écart entre la surface et sa bande : au-delà du bord de l'ombre. */
export const PROBE_GAP = 20;
/** Sous la surface, l'ombre descend (décalage + flou de `--lg-surface-shadow`) : plus loin. */
export const PROBE_GAP_BELOW = 72;
/** Une bande coupée par la fenêtre plus mince que ceci ne compte pas. */
const MIN_SIDE = 4;

export interface Viewport {
  width: number;
  height: number;
}

function clip(rect: ToneRect, view: Viewport): ToneRect | null {
  const x0 = Math.max(0, rect.x);
  const y0 = Math.max(0, rect.y);
  const x1 = Math.min(view.width, rect.x + rect.width);
  const y1 = Math.min(view.height, rect.y + rect.height);
  return x1 - x0 >= MIN_SIDE && y1 - y0 >= MIN_SIDE ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
}

/** Les quatre côtés de la couronne, dans cet ordre. */
export const PROBE_SIDES = ["left", "right", "top", "bottom"] as const;
export type ProbeSide = (typeof PROBE_SIDES)[number];

/** La bande d'un côté de la couronne autour de `surface`, coupée à la fenêtre ; `null` si elle en sort. */
export function surfaceProbeRect(surface: ToneRect, side: ProbeSide, view: Viewport): ToneRect | null {
  const { x, y, width, height } = surface;
  const t = PROBE_THICKNESS;
  const rect: ToneRect =
    side === "left"
      ? { x: x - PROBE_GAP - t, y, width: t, height }
      : side === "right"
        ? { x: x + width + PROBE_GAP, y, width: t, height }
        : side === "top"
          ? { x, y: y - PROBE_GAP - t, width, height: t }
          : { x, y: y + height + PROBE_GAP_BELOW, width, height: t };
  return clip(rect, view);
}

/** La médiane des luminances mesurées ; `null` sans mesure. */
export function medianLuminance(values: readonly number[]): number | null {
  const finite = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (finite.length === 0) return null;
  const mid = finite.length >> 1;
  return finite.length % 2 === 1 ? finite[mid]! : (finite[mid - 1]! + finite[mid]!) / 2;
}

/**
 * Le ton tenu d'après les bandes : la règle des contrôles (`nextTone`), partie
 * du ton supposé — un dessous de luminance MOYENNE garde le ton du thème.
 */
export function heldSurfaceTone(assumed: BackdropTone, luminances: readonly number[]): BackdropTone {
  return nextTone(assumed, medianLuminance(luminances));
}

/**
 * Mesure-t-on ? Seulement sur le VERRE : sous « Réduire la transparence » ou
 * « Contraste accru », la surface est un aplat du thème (`physics.css`) — son
 * ton est celui du thème, quel que soit le dessous.
 */
export function surfaceToneMeasured(material: GlassMaterial): boolean {
  return material === "liquid";
}
