/**
 * Reflet spéculaire qui suit le pointeur — la règle, pure.
 *
 * Sur le verre d'Apple, la lumière glisse avec le doigt : un halo sur la face,
 * et le liseré qui s'allume du côté de la source. Ici : la position du halo en
 * fractions de la surface (u, v), l'angle de la source vu du centre (pour le
 * liseré en dégradé conique), et un lissage exponentiel indépendant de la
 * cadence de l'écran — à 60 comme à 120 Hz, le halo traîne autant.
 */

export interface SpecularPoint {
  /** Fraction horizontale, 0 = bord gauche, 1 = bord droit. */
  u: number;
  /** Fraction verticale, 0 = haut, 1 = bas. */
  v: number;
}

export interface SurfaceRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Le halo peut déborder un peu de la surface (le pointeur arrive par le bord :
 * la lumière doit déjà être là), jamais plus — sinon il disparaît en entier.
 */
export const SPECULAR_OVERSCAN = 0.15;

/** Constante de temps du lissage, en ms : ~63 % du chemin parcouru en 70 ms. */
export const SPECULAR_TAU_MS = 70;

/** Écart sous lequel le halo est posé et la boucle d'image s'arrête. */
export const SPECULAR_REST = 0.002;

/** Position de repos : la lumière d'Apple vient d'en haut, légèrement à gauche. */
export const SPECULAR_REST_POINT: SpecularPoint = { u: 0.3, v: 0.12 };

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** Le point visé par un pointeur en (x, y), coordonnées de la fenêtre. */
export function specularTarget(rect: SurfaceRect, x: number, y: number): SpecularPoint {
  if (rect.width <= 0 || rect.height <= 0) return SPECULAR_REST_POINT;
  const lo = -SPECULAR_OVERSCAN;
  const hi = 1 + SPECULAR_OVERSCAN;
  return {
    u: clamp((x - rect.left) / rect.width, lo, hi),
    v: clamp((y - rect.top) / rect.height, lo, hi),
  };
}

/**
 * Un pas de lissage de `dtMs`. `alpha = 1 − e^(−dt/τ)` : deux pas de 8 ms
 * mènent exactement où mène un pas de 16 ms — la cadence ne change rien.
 * Un `dt` aberrant (onglet réveillé après une minute) est borné : le halo
 * saute au but au lieu de faire un bond calculé sur une durée absurde.
 */
export function specularStep(
  current: SpecularPoint,
  target: SpecularPoint,
  dtMs: number,
  tauMs = SPECULAR_TAU_MS,
): SpecularPoint {
  const dt = clamp(dtMs, 0, 250);
  const alpha = 1 - Math.exp(-dt / tauMs);
  return {
    u: current.u + (target.u - current.u) * alpha,
    v: current.v + (target.v - current.v) * alpha,
  };
}

export function specularSettled(current: SpecularPoint, target: SpecularPoint): boolean {
  return Math.abs(current.u - target.u) < SPECULAR_REST && Math.abs(current.v - target.v) < SPECULAR_REST;
}

/**
 * Angle de la source vu du centre de la surface, en degrés, convention de
 * `conic-gradient` (0° en haut, sens horaire) : le liseré s'allume du côté du
 * pointeur. Mesuré sur la surface réelle (pas en fractions) : sur une capsule
 * large, un pointeur au bout s'éclaire bien sur le côté, pas en diagonale.
 */
export function specularAngle(p: SpecularPoint, width: number, height: number): number {
  const dx = (p.u - 0.5) * width;
  const dy = (p.v - 0.5) * height;
  if (dx === 0 && dy === 0) return 0;
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return Math.round(((deg + 360) % 360) * 10) / 10;
}

/**
 * Les variables CSS écrites sur la surface. Fractions SANS unité : la feuille
 * en tire un `translate` en pourcentage de la couche du halo (de la taille de
 * la surface), donc un déplacement composité — jamais une position de
 * dégradé, qui repeindrait la couche à chaque image.
 */
export function specularCssVars(p: SpecularPoint, width: number, height: number): Record<string, string> {
  return {
    "--lg-spec-u": String(Math.round(p.u * 1000) / 1000),
    "--lg-spec-v": String(Math.round(p.v * 1000) / 1000),
    "--lg-spec-angle": `${specularAngle(p, width, height)}deg`,
  };
}
