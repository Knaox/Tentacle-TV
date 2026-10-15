/**
 * LA règle de placement des panneaux flottants (menus, cloche, popovers,
 * menus contextuels) : rien ne sort de la fenêtre, quelle que soit sa taille.
 * Pure — ni DOM ni React — : `useFloatingPlacement` lui donne les mesures.
 *
 *   1. Le côté demandé si le panneau y tient ; sinon le côté le plus spacieux
 *      (retournement) — jamais un côté où il tiendrait moins.
 *   2. Sur l'autre axe, l'alignement demandé, puis décalé pour rester dans la
 *      fenêtre (marge `margin` sur chaque bord).
 *   3. Ce qui ne tient toujours pas est borné (`maxHeight`, `maxWidth`) : le
 *      panneau défile À L'INTÉRIEUR, il n'est jamais rogné.
 *
 * Une ancre ponctuelle (clic droit) est un rectangle de taille nulle.
 */

export type FloatingSide = "top" | "bottom" | "left" | "right";
export type FloatingAlign = "start" | "end" | "center";

export interface AnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export interface FloatingRequest {
  anchor: AnchorRect;
  /** Taille NATURELLE du panneau (sans borne). */
  size: { width: number; height: number };
  viewport: { width: number; height: number };
  side?: FloatingSide;
  align?: FloatingAlign;
  /** Écart entre l'ancre et le panneau. */
  gap?: number;
  /** Écart minimal avec chaque bord de la fenêtre. */
  margin?: number;
}

export interface FloatingPlacement {
  top: number;
  left: number;
  maxWidth: number;
  maxHeight: number;
  side: FloatingSide;
  /** L'origine des animations d'entrée : le coin collé à l'ancre. */
  transformOrigin: string;
}

const OPPOSITE: Record<FloatingSide, FloatingSide> = { top: "bottom", bottom: "top", left: "right", right: "left" };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, Math.max(min, max)));
}

/** Position sur l'axe secondaire : alignée sur l'ancre, puis ramenée dans la fenêtre. */
function crossAxis(start: number, end: number, size: number, extent: number, align: FloatingAlign, margin: number): number {
  const wanted = align === "start" ? start : align === "end" ? end - size : (start + end) / 2 - size / 2;
  return clamp(wanted, margin, extent - margin - size);
}

function spaceOn(side: FloatingSide, r: FloatingRequest, gap: number, margin: number): number {
  const { anchor, viewport } = r;
  switch (side) {
    case "bottom": return viewport.height - margin - (anchor.bottom + gap);
    case "top": return anchor.top - gap - margin;
    case "right": return viewport.width - margin - (anchor.right + gap);
    case "left": return anchor.left - gap - margin;
  }
}

/** Le point de l'ancre vu depuis le panneau : l'animation part de là. */
function originOf(side: FloatingSide, top: number, left: number, width: number, height: number, anchor: AnchorRect): string {
  if (side === "bottom" || side === "top") {
    const x = clamp((anchor.left + anchor.right) / 2 - left, 0, width);
    return `${Math.round(x)}px ${side === "bottom" ? "0px" : "100%"}`;
  }
  const y = clamp((anchor.top + anchor.bottom) / 2 - top, 0, height);
  return `${side === "right" ? "0px" : "100%"} ${Math.round(y)}px`;
}

export function placeFloating(r: FloatingRequest): FloatingPlacement {
  const gap = r.gap ?? 8;
  const margin = r.margin ?? 8;
  const align = r.align ?? "end";
  const preferred = r.side ?? "bottom";
  const vertical = preferred === "top" || preferred === "bottom";
  const need = vertical ? r.size.height : r.size.width;
  const mine = spaceOn(preferred, r, gap, margin);
  const other = spaceOn(OPPOSITE[preferred], r, gap, margin);
  const side = need <= mine || mine >= other ? preferred : OPPOSITE[preferred];
  const room = Math.max(0, side === preferred ? mine : other);
  const { anchor, viewport } = r;

  if (vertical) {
    const maxWidth = Math.max(0, viewport.width - 2 * margin);
    const width = Math.min(r.size.width, maxWidth);
    const maxHeight = room;
    const height = Math.min(r.size.height, maxHeight);
    const left = crossAxis(anchor.left, anchor.right, width, viewport.width, align, margin);
    const top = side === "bottom" ? anchor.bottom + gap : anchor.top - gap - height;
    return { top, left, maxWidth, maxHeight, side, transformOrigin: originOf(side, top, left, width, height, anchor) };
  }
  const maxHeight = Math.max(0, viewport.height - 2 * margin);
  const height = Math.min(r.size.height, maxHeight);
  const maxWidth = room;
  const width = Math.min(r.size.width, maxWidth);
  const top = crossAxis(anchor.top, anchor.bottom, height, viewport.height, align, margin);
  const left = side === "right" ? anchor.right + gap : anchor.left - gap - width;
  return { top, left, maxWidth, maxHeight, side, transformOrigin: originOf(side, top, left, width, height, anchor) };
}

/** Deux placements identiques au pixel près : rien à redessiner. */
export function samePlacement(a: FloatingPlacement | null, b: FloatingPlacement | null): boolean {
  if (!a || !b) return a === b;
  return Math.round(a.top) === Math.round(b.top) && Math.round(a.left) === Math.round(b.left)
    && Math.round(a.maxHeight) === Math.round(b.maxHeight) && Math.round(a.maxWidth) === Math.round(b.maxWidth)
    && a.side === b.side && a.transformOrigin === b.transformOrigin;
}
