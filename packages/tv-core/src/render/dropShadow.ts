/**
 * L'ombre portée d'une vue, lue dans ses styles iOS (`shadowColor`,
 * `shadowOpacity`, `shadowRadius`, `shadowOffset`) — la SEULE source : une
 * plateforme qui ne sait pas les dessiner (Android, ancienne architecture)
 * en tire la description de son masque, sans recopier une valeur.
 *
 * Les défauts sont ceux de `CALayer`, que l'Apple TV applique quand un style
 * en tait un : noir, rayon 3, décalage (0, −3). Le rayon d'une ombre de
 * `CALayer` vaut, à l'œil, l'écart-type de son flou gaussien : le masque
 * Android le prend tel quel.
 */

export interface ShadowStyleInput {
  shadowColor?: unknown;
  shadowOpacity?: number | null;
  shadowRadius?: number | null;
  shadowOffset?: { width?: number | null; height?: number | null } | null;
}

export interface DropShadowSpec {
  /** La couleur, telle qu'écrite dans le style. */
  color: string;
  /** L'opacité de l'ombre, 0 à 1 (celle de la couleur s'y multiplie au dessin). */
  opacity: number;
  /** L'écart-type du flou, en points. */
  blur: number;
  offsetX: number;
  offsetY: number;
}

const LAYER_DEFAULTS = { color: "#000", radius: 3, offsetX: 0, offsetY: -3 } as const;

const finite = (value: number | null | undefined, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

/**
 * L'ombre que dessine `CALayer` pour ces styles, ou `null` s'il n'en dessine
 * aucune (opacité nulle ou absente — son défaut). `coverage` (0 à 1) :
 * l'opacité de ce qui projette l'ombre — `CALayer` la tire de l'alpha de la
 * vue, et un fond translucide en projette d'autant moins.
 */
export function dropShadowOf(style: ShadowStyleInput | null | undefined, coverage = 1): DropShadowSpec | null {
  if (!style) return null;
  const opacity = Math.min(1, Math.max(0, finite(style.shadowOpacity, 0))) * Math.min(1, Math.max(0, coverage));
  if (opacity <= 0) return null;
  const color = typeof style.shadowColor === "string" && style.shadowColor.length > 0 ? style.shadowColor : LAYER_DEFAULTS.color;
  return {
    color,
    opacity,
    blur: Math.max(0, finite(style.shadowRadius, LAYER_DEFAULTS.radius)),
    // Un décalage écrit, même partiel, remplace celui de `CALayer` entier.
    offsetX: style.shadowOffset ? finite(style.shadowOffset.width, 0) : LAYER_DEFAULTS.offsetX,
    offsetY: style.shadowOffset ? finite(style.shadowOffset.height, 0) : LAYER_DEFAULTS.offsetY,
  };
}

/**
 * La géométrie du masque flouté d'une boîte `width × height` : sa marge (trois
 * écarts-types : au-delà, le flou ne laisse rien de visible) et l'échelle à
 * laquelle il se calcule — un flou agrandi reste un flou ; l'écart-type
 * dessiné ne descend pas sous 4 pixels (MASK_MIN_SIGMA), pour que
 * l'agrandissement ne marche pas d'escalier. Le pendant natif
 * (`TentacleShadowView.kt`) suit la même règle.
 */
export const MASK_MIN_SIGMA = 4;

export function shadowMaskGeometry(blur: number): { margin: number; scale: number } {
  const sigma = Math.max(0, blur);
  const scale = sigma <= MASK_MIN_SIGMA ? 1 : Math.max(0.125, MASK_MIN_SIGMA / sigma);
  return { margin: Math.ceil(sigma * 3), scale };
}
