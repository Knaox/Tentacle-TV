/**
 * La page qui SUIT le focus : où elle va pour montrer la section qui le
 * porte — la règle, pour toutes les plateformes.
 *
 * Une vue décrit ses sections (`FocusSection reveal`) : `nearest` — le moins
 * de défilement possible pour la voir entière, à une marge des bords ;
 * `anchor` — son haut à une distance fixe du haut de l'écran ; `start` — la
 * page tout en haut ; `none` — rien. Quand le focus entre dans une section,
 * la page va à la cible de la section la plus proche de l'élément focalisé,
 * dans la même page.
 *
 * Sur Apple TV, l'APPLICATION est native et le reste
 * (`apps/tv/ios/TentacleTV/TentacleRevealScroller.m`, `targetFor:from:`,
 * `clamp:`, `keepShownInPlace`) : la géométrie n'est juste qu'au moment même
 * du geste. Elle suit ce module pas à pas ; ses tests sont le cahier des
 * charges des deux. Le mouvement (rafale, ressort) : `revealMotion.ts`.
 *
 * Module pur : des nombres, dans le repère du contenu de la page.
 */

export type RevealMode = "none" | "nearest" | "anchor" | "start";

/** La marge aux bords de `nearest` : la légende et l'indication de l'appui long restent hors de la marge de sécurité. */
export const REVEAL_NEAREST_MARGIN = 56;
/** Le haut d'une section ancrée, par défaut (la fiche : sous la marge de sécurité). */
export const REVEAL_ANCHOR_TOP = 72;

export interface RevealSpec {
  mode: RevealMode;
  /** `nearest` : la marge aux bords. */
  margin?: number;
  /** `anchor` : le haut de la section, depuis le haut de l'écran. */
  top?: number;
}

/** Une section, dans le repère du contenu de la page. */
export interface RevealBox {
  top: number;
  height: number;
}

export interface RevealPage {
  /** La hauteur de la page à l'écran. */
  viewport: number;
  /** La hauteur de son contenu. */
  content: number;
  /** Les retraits du contenu (iOS : `adjustedContentInset`). */
  insetTop: number;
  insetBottom: number;
}

/** La position bornée à ce que la page peut montrer. */
export function clampRevealOffset(y: number, page: RevealPage): number {
  const min = 0 - page.insetTop; // jamais « -0 »
  const max = Math.max(min, page.content + page.insetBottom - page.viewport);
  return Math.min(Math.max(y, min), max);
}

/**
 * Où la page doit être pour montrer `box`, depuis `base` — là où elle va déjà
 * (la cible d'un mouvement en cours, sinon sa position). `nearest` : descendre
 * jusqu'à son bas, sinon remonter jusqu'à son haut — jamais au-delà de son
 * haut (une section plus haute que l'écran), et rien si elle est déjà
 * entière dans la marge.
 */
export function revealOffset(spec: RevealSpec, box: RevealBox, page: RevealPage, base: number): number {
  if (spec.mode === "start") return clampRevealOffset(0, page);
  if (spec.mode === "anchor") return clampRevealOffset(box.top - (spec.top ?? REVEAL_ANCHOR_TOP), page);
  const margin = spec.margin ?? REVEAL_NEAREST_MARGIN;
  const top = box.top - margin;
  const bottom = box.top + box.height + margin - page.viewport;
  const target = bottom > base ? Math.min(bottom, top) : top < base ? top : base;
  return clampRevealOffset(target, page);
}

/**
 * Un montage a déplacé la section montrée dans la page (une rangée arrivée
 * au-dessus, un logo lu) : de combien la page la suit, dans le même montage —
 * puis elle la montre de nouveau, depuis là. `null` : rien à faire — une AUTRE
 * section est montrée depuis (sa position d'avant n'a pas été lue), ou une
 * position manque. Un écart sous le demi-point ne déplace rien.
 */
export function layoutShift(sameSection: boolean, topBefore: number | null, topAfter: number | null): number | null {
  if (!sameSection || topBefore === null || topAfter === null) return null;
  const delta = topAfter - topBefore;
  return Math.abs(delta) >= 0.5 ? delta : 0;
}

/**
 * Le banc d'images, focus FIGÉ (aucun focus natif ne bouge) : la section
 * montrée d'un coup, entière à `margin` des bords, au plus près du haut.
 */
export function benchRevealOffset(box: RevealBox, viewport: number, margin = REVEAL_NEAREST_MARGIN): number {
  const bottom = box.top + box.height;
  const y = bottom > viewport - margin ? bottom - viewport + margin : 0;
  return Math.max(0, Math.min(y, box.top - margin));
}
