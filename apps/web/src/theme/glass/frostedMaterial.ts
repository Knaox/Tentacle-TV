/**
 * Le panneau GIVRÉ posé sur une IMAGE (`.lg-content-frosted` : les outils d'une bibliothèque au
 * bas de sa bannière, l'encadré de la fiche) — pur, et la PREUVE de sa lisibilité.
 *
 * Le verre de la maquette (`paneMaterial.ts`) est prouvé sur le FOND AMBIANT : une encre et nos
 * taches de marque. Posé sur une image quelconque, il ne tenait plus rien — mesuré sur l'instance
 * réelle le 11/11 : « 485 titres » à 3,0:1 et le tri à 4,4:1 sur un désert orange (thème sombre),
 * que sa saturation de 1,5 avivait encore. C'est le « texte illisible sur les filtres de
 * bibliothèque » de Damien.
 *
 * Ni dalle, ni mesure : une COURBE DE TONS dans le givre (`feComponentTransfer`, après le flou).
 *  - en sombre, elle PLAFONNE les hautes lumières : ce qui est déjà sombre dessous passe tel quel
 *    — le verre reste transparent —, un ciel blanc devient un brun fumé ;
 *  - en clair, elle RELÈVE les ombres : une image noire devient une nacre, une image claire passe.
 * Le verre ne se teinte donc que là où l'image l'exige, pixel par pixel, sans rien mesurer ni
 * attendre : c'est l'atténuation adaptative d'un verre d'Apple, tenue par le compositeur.
 *
 * Ces valeurs sont recopiées dans `paneTokens.css` et dans `GlassToneCurves.tsx` ; un test tient
 * le tout identique (`frostedMaterial.test.ts`).
 */

import { compositeOver, contrastRatio, type Rgba } from "./contrast";
import { backdropGrid, cssSaturate } from "./surfaceMaterial";

const rgb = (r: number, g: number, b: number, a = 1): Rgba => ({ r, g, b, a });

export const FROST_BLUR_PX = 24;
/** Sous 1,3 (règle du lot lg2) : à 1,5 une affiche laissait des taches vives sous le verre. */
export const FROST_SATURATE = 1.2;

/** Les identifiants des deux filtres (`GlassToneCurves`), référencés par `--lg-frost-curve`. */
export const FROST_CURVE_ID = { dark: "lg-frost-curve-dark", light: "lg-frost-curve-light" } as const;

/**
 * Les courbes, en `tableValues` d'un `feFunc` de type `table` : neuf points équidistants de 0 à 1,
 * interpolés linéairement, appliqués à chaque canal en sRVB.
 *  - sombre : l'identité dans les ombres, puis un plafond doux à 32 % ;
 *  - clair : un plancher à 72 %, puis la montée jusqu'au blanc.
 */
export const FROST_CURVE = {
  dark: [0, 0.115, 0.195, 0.25, 0.285, 0.305, 0.315, 0.32, 0.32],
  light: [0.72, 0.74, 0.77, 0.805, 0.84, 0.88, 0.92, 0.96, 1],
} as const;

export interface FrostedToneMaterial {
  curve: readonly number[];
  /** L'encre posée sur le dessous filtré (`--lg-frost-ink`). */
  ink: Rgba;
  /** L'opacité blanche cumulée du verre : au coin du reflet (le plus fort), puis au plus faible du corps. */
  whiteCorner: number;
  whiteBody: number;
  glyph: Rgba;
  /** Tout texte secondaire, tertiaire ou quaternaire du panneau (`--lg-frost-glyph-secondary`). */
  glyphSecondary: Rgba;
  /** La piste d'un segmenté posée DANS le panneau (`--lgp-track-on-*`) : le fond le plus pénalisant sous un libellé. */
  track: Rgba;
}

/** Le dégradé et les reflets sont ceux du panneau (`--lg-pane-fill`, `--lg-pane-sheen`) : 0,08 + 0,07 au coin sombre. */
export const FROSTED_DARK: FrostedToneMaterial = {
  curve: FROST_CURVE.dark,
  ink: rgb(7, 5, 12, 0.12),
  whiteCorner: 1 - (1 - 0.08) * (1 - 0.07),
  whiteBody: 0.02,
  glyph: rgb(255, 255, 255),
  glyphSecondary: rgb(255, 255, 255, 0.82),
  track: rgb(255, 255, 255, 0.06),
};

export const FROSTED_LIGHT: FrostedToneMaterial = {
  curve: FROST_CURVE.light,
  ink: rgb(255, 255, 255, 0),
  whiteCorner: 1 - (1 - 0.42) * (1 - 0.3),
  whiteBody: 0.18,
  glyph: rgb(12, 12, 18, 0.9),
  glyphSecondary: rgb(12, 12, 18, 0.72),
  track: rgb(0, 0, 0, 0.05),
};

/** Un canal (0..255) à travers une table de `feComponentTransfer` (type `table`). */
export function curveChannel(value: number, table: readonly number[]): number {
  const n = table.length - 1;
  const position = Math.min(1, Math.max(0, value / 255)) * n;
  const index = Math.min(n - 1, Math.floor(position));
  const t = position - index;
  return 255 * (table[index] + (table[index + 1] - table[index]) * t);
}

export function applyCurve(c: Rgba, table: readonly number[]): Rgba {
  return { r: curveChannel(c.r, table), g: curveChannel(c.g, table), b: curveChannel(c.b, table), a: c.a };
}

/** La couleur du verre au-dessus d'un dessous (après le givre), avec `white` d'opacité blanche cumulée. */
export function frostedColorOver(backdrop: Rgba, tone: FrostedToneMaterial, white: number): Rgba {
  const filtered = applyCurve(cssSaturate(backdrop, FROST_SATURATE), tone.curve);
  return compositeOver(rgb(255, 255, 255, white), compositeOver(tone.ink, filtered));
}

/** Le pire contraste d'un texte sur le verre, sur 216 dessous (blanc et noir purs compris) ; `over` : une piste posée dedans. */
export function worstFrostedContrast(text: Rgba, tone: FrostedToneMaterial, white: number, over?: Rgba): number {
  let worst = Infinity;
  for (const backdrop of backdropGrid()) {
    const glass = frostedColorOver(backdrop, tone, white);
    const surface = over ? compositeOver(over, glass) : glass;
    worst = Math.min(worst, contrastRatio(compositeOver(text, surface), surface));
  }
  return worst;
}
