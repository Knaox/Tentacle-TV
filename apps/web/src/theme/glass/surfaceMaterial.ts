/**
 * Le matériau du régime `surface` (lot lg2, règle 3 du brief) — pur, et la
 * PREUVE de son contraste.
 *
 * Un grand verre (menu, popover, feuille, barre latérale, palette) a UN ton,
 * tenu, et il passe sur n'importe quoi : une affiche blanche, un héros noir,
 * un dessous mixte. La lisibilité ne peut donc venir que de la DENSITÉ du
 * matériau — jamais d'un voile par rangée. On la prouve au pire cas : le
 * dessous traverse le givre (saturation, luminosité), le remplissage du ton
 * se pose dessus, le reflet par-dessus, puis le texte ; le flou et la
 * réfraction ne font que mélanger des couleurs du dessous, ils ne sortent
 * jamais de l'intervalle noir…blanc.
 *
 * Ces valeurs sont recopiées dans `surfaceTokens.css` ; un test tient les
 * deux identiques (`surfaceMaterial.test.ts`).
 */

import { WCAG_AA_TEXT, compositeOver, contrastRatio, type Rgba } from "./contrast";
import type { BackdropTone } from "./backdropTone";

export interface SurfaceToneMaterial {
  /** Le remplissage du verre (`--lg-surface-fill-on-*`). */
  fill: Rgba;
  /** Le reflet diffus du haut, au plus fort (`--lg-surface-sheen-on-*`). */
  sheen: Rgba;
  glyph: Rgba;
  glyphSecondary: Rgba;
  danger: Rgba;
  /** La pastille d'une rangée survolée ou active (`--lg-row-highlight-on-*`) :
   * NEUTRE et translucide, au ton du verre — le texte y garde sa couleur. */
  rowHighlight: Rgba;
}

export interface SurfaceMaterial {
  /** `--lg-surface-blur`, en px. */
  blur: number;
  /** `--lg-surface-saturate` : ≤ 1, le dessous n'est jamais avivé. */
  saturate: number;
  /** `--lg-surface-brightness`. */
  brightness: number;
  /** `--lg-refraction-surface` : la réfraction au biseau, plus douce. */
  refraction: number;
  dark: SurfaceToneMaterial;
  light: SurfaceToneMaterial;
}

const rgba = (r: number, g: number, b: number, a = 1): Rgba => ({ r, g, b, a });

export const SURFACE_MATERIAL: SurfaceMaterial = {
  blur: 30,
  saturate: 0.75,
  brightness: 1,
  refraction: 0.3,
  // Ton sombre : glyphes clairs. 0,78 d'un gris presque noir tient le blanc à
  // ≥ 4,5:1 même posé sur un blanc pur.
  dark: {
    fill: rgba(28, 28, 32, 0.78),
    sheen: rgba(255, 255, 255, 0.05),
    glyph: rgba(255, 255, 255, 0.96),
    glyphSecondary: rgba(255, 255, 255, 0.8),
    // Un corail plus clair que celui des contrôles (#FFB4AB) : sur le pire
    // dessous (blanc), le corail d'un contrôle tombait à 4,26:1.
    danger: rgba(255, 196, 188),
    // Le blanc à 0,14 : plus marqué que la page courante (0,1), et le texte
    // principal y tient ≥ 4,5:1 même sur un dessous blanc pur.
    rowHighlight: rgba(255, 255, 255, 0.14),
  },
  // Ton clair : glyphes sombres, tenus même posés sur un noir pur.
  light: {
    fill: rgba(246, 246, 248, 0.76),
    sheen: rgba(255, 255, 255, 0.3),
    glyph: rgba(12, 12, 18, 0.88),
    glyphSecondary: rgba(12, 12, 18, 0.72),
    danger: rgba(110, 11, 16),
    // Le noir à 0,09 : plus marqué que la page courante (0,07).
    rowHighlight: rgba(0, 0, 0, 0.09),
  },
};

/** `saturate(s)` de CSS (Filter Effects, matrice de luminance 0,2126 / 0,7152 / 0,0722). */
export function cssSaturate(c: Rgba, s: number): Rgba {
  const { r, g, b } = c;
  const clamp = (v: number) => Math.min(255, Math.max(0, v));
  return {
    r: clamp((0.213 + 0.787 * s) * r + (0.715 - 0.715 * s) * g + (0.072 - 0.072 * s) * b),
    g: clamp((0.213 - 0.213 * s) * r + (0.715 + 0.285 * s) * g + (0.072 - 0.072 * s) * b),
    b: clamp((0.213 - 0.213 * s) * r + (0.715 - 0.715 * s) * g + (0.072 + 0.928 * s) * b),
    a: c.a,
  };
}

/** `brightness(k)` de CSS : chaque canal multiplié, borné. */
export function cssBrightness(c: Rgba, k: number): Rgba {
  const clamp = (v: number) => Math.min(255, Math.max(0, v * k));
  return { r: clamp(c.r), g: clamp(c.g), b: clamp(c.b), a: c.a };
}

/**
 * La couleur de la surface en un point, posée sur `backdrop` : givre, puis
 * remplissage, puis le reflet à la force `sheenAt` (0 : hors du reflet, 1 :
 * au plus fort).
 */
export function surfaceColorOver(
  backdrop: Rgba,
  tone: BackdropTone,
  material: SurfaceMaterial = SURFACE_MATERIAL,
  sheenAt = 1,
): Rgba {
  const frosted = cssBrightness(cssSaturate(backdrop, material.saturate), material.brightness);
  const toneMaterial = material[tone];
  const filled = compositeOver(toneMaterial.fill, frosted);
  return compositeOver({ ...toneMaterial.sheen, a: toneMaterial.sheen.a * sheenAt }, filled);
}

/**
 * Des dessous de toute sorte : le cube RGB par pas de 51 (216 couleurs, blanc,
 * noir et primaires saturées compris).
 */
export function backdropGrid(step = 51): Rgba[] {
  const grid: Rgba[] = [];
  for (let r = 0; r <= 255; r += step)
    for (let g = 0; g <= 255; g += step) for (let b = 0; b <= 255; b += step) grid.push(rgba(r, g, b));
  return grid;
}

/**
 * Le PIRE contraste d'un texte sur la surface du ton `tone`, sur tous les
 * dessous de `backdrops`, au plus fort du reflet comme hors de lui.
 */
export function worstSurfaceContrast(
  text: Rgba,
  tone: BackdropTone,
  material: SurfaceMaterial = SURFACE_MATERIAL,
  backdrops: Rgba[] = backdropGrid(),
): number {
  let worst = Infinity;
  for (const backdrop of backdrops) {
    for (const sheenAt of [0, 1]) {
      const surface = surfaceColorOver(backdrop, tone, material, sheenAt);
      worst = Math.min(worst, contrastRatio(compositeOver(text, surface), surface));
    }
  }
  return worst;
}

/** Tous les textes du ton tiennent l'AA, sur tout dessous. */
export function surfaceToneIsLegible(tone: BackdropTone, material: SurfaceMaterial = SURFACE_MATERIAL): boolean {
  const m = material[tone];
  return [m.glyph, m.glyphSecondary, m.danger].every(
    (text) => worstSurfaceContrast(text, tone, material) >= WCAG_AA_TEXT,
  );
}

/**
 * La couleur du dessous qui traverse la surface : l'écart maximal entre deux
 * canaux du résultat, rapporté à celui du dessous (0 : gris pur, 1 : la
 * couleur passe entière). Les « taches » violettes, orange ou vertes sous un
 * menu étaient un report de plus de 1 (saturation 1,5 sous un voile de 0,07).
 */
export function chromaTransfer(backdrop: Rgba, tone: BackdropTone, material: SurfaceMaterial = SURFACE_MATERIAL): number {
  const spread = (c: Rgba) => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
  const before = spread(backdrop);
  if (before === 0) return 0;
  return spread(surfaceColorOver(backdrop, tone, material, 0)) / before;
}

/**
 * Le PIRE contraste d'un texte posé sur la pastille d'une rangée (surface du
 * ton, puis `rowHighlight` par-dessus), sur tous les dessous.
 */
export function worstRowHighlightContrast(
  text: Rgba,
  tone: BackdropTone,
  material: SurfaceMaterial = SURFACE_MATERIAL,
  backdrops: Rgba[] = backdropGrid(),
): number {
  let worst = Infinity;
  for (const backdrop of backdrops) {
    for (const sheenAt of [0, 1]) {
      const pill = compositeOver(material[tone].rowHighlight, surfaceColorOver(backdrop, tone, material, sheenAt));
      worst = Math.min(worst, contrastRatio(compositeOver(text, pill), pill));
    }
  }
  return worst;
}
