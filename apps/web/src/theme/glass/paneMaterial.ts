/**
 * Le verre de la MAQUETTE (« Octave · Playlist — Liquid Glass », 26/10) — pur,
 * et la PREUVE de sa lisibilité.
 *
 * Deux pièces vont ensemble :
 *  - le FOND AMBIANT (`GlassAmbient`) : de grandes taches de nos couleurs sur
 *    l'encre — ce qui donne au verre quelque chose à réfracter ;
 *  - le VERRE (`.lg-pane`, `.lg-bead`) : un dégradé blanc léger, un flou qui
 *    AVIVE (saturation 190 %), un liseré en dégradé, des reflets.
 *
 * Écarts assumés à la maquette, pour l'AA : ses taches allaient jusqu'à 0,55 et
 * ses reflets à 0,22 sans rien dessous — mesurée, elle tombait à 2,3:1 sous un
 * texte blanc là où deux taches vives se croisent. Ici : taches à 0,5 au plus,
 * une ENCRE légère dans le verre (0,26), un reflet de 0,14, des teintes d'image
 * bornées à la luminance de nos roses. Le corps du verre tient ≥ 4,5:1 sous un
 * texte blanc sur le PIRE croisement de deux taches ; le coin du reflet, ≥ 3:1
 * (grand texte, icônes).
 *
 * Ces valeurs sont recopiées dans `paneTokens.css` ; un test tient les deux
 * identiques (`paneMaterial.test.ts`).
 */

import { compositeOver, contrastRatio, relativeLuminance, type Rgba } from "./contrast";
import { cssBrightness, cssSaturate } from "./surfaceMaterial";

const rgb = (r: number, g: number, b: number, a = 1): Rgba => ({ r, g, b, a });

/** L'encre sous le fond ambiant (celle de la maquette, nos prunes). */
export const AMBIENT_INK = rgb(7, 5, 12);

export interface AmbientBlob {
  /** Le jeton de la couleur (`--brand-*` du thème), ou une teinte d'image. */
  token: string;
  color: Rgba;
  /** L'opacité au CŒUR de la tache. */
  alpha: number;
}

/** Les taches du fond sombre : violet → rose, nos couleurs (jamais le cyan ni l'orange de la maquette). */
export const AMBIENT_DARK: readonly AmbientBlob[] = [
  { token: "--brand-accent", color: rgb(236, 72, 153), alpha: 0.5 },
  { token: "--brand", color: rgb(139, 92, 246), alpha: 0.42 },
  { token: "--brand-accent-dark", color: rgb(219, 39, 119), alpha: 0.36 },
  { token: "--brand-dark", color: rgb(124, 58, 237), alpha: 0.5 },
  { token: "--brand-mid", color: rgb(168, 85, 247), alpha: 0.36 },
];

/** Les taches du fond clair : les mêmes, en pastel sur la nacre. */
export const AMBIENT_LIGHT: readonly AmbientBlob[] = [
  { token: "--brand-accent", color: rgb(219, 39, 119), alpha: 0.2 },
  { token: "--brand", color: rgb(124, 58, 237), alpha: 0.16 },
  { token: "--brand-accent-dark", color: rgb(219, 39, 119), alpha: 0.14 },
  { token: "--brand-dark", color: rgb(124, 58, 237), alpha: 0.18 },
  { token: "--brand-mid", color: rgb(168, 85, 247), alpha: 0.14 },
];

/** Une teinte d'image (affiche, pochette) prend la place des taches 2 et 3, à cette opacité. */
export const AMBIENT_TINT_ALPHA = { dark: 0.45, light: 0.18 } as const;
/** La luminance relative au plus d'une teinte d'image : celle de nos roses (le rose de marque : 0,25). */
export const AMBIENT_TINT_MAX_LUMINANCE = 0.2;

export interface PaneToneMaterial {
  /** `--lg-pane-saturate`, en facteur (1,9 = 190 %). */
  saturate: number;
  brightness: number;
  /** L'encre posée sur le dessous filtré (`--lg-pane-ink`). */
  ink: Rgba;
  /** Le dégradé blanc : au plus fort (0 %, le coin haut-gauche), au creux (45 %), au bout (100 %). */
  fillPeak: number;
  fillBody: number;
  fillEnd: number;
  /** Les reflets radiaux, au plus fort : en haut à gauche, puis en bas à droite. */
  sheen: number;
  sheenFar: number;
  glyph: Rgba;
  glyphSecondary: Rgba;
}

export const PANE_BLUR_PX = 28;
export const BEAD_BLUR_PX = 12;

export const PANE_DARK: PaneToneMaterial = {
  saturate: 1.9,
  brightness: 1.08,
  ink: rgb(7, 5, 12, 0.26),
  fillPeak: 0.16,
  fillBody: 0.05,
  fillEnd: 0.09,
  sheen: 0.14,
  sheenFar: 0.08,
  glyph: rgb(255, 255, 255),
  glyphSecondary: rgb(255, 255, 255, 0.72),
};

export const PANE_LIGHT: PaneToneMaterial = {
  saturate: 1.8,
  brightness: 1.02,
  ink: rgb(255, 255, 255, 0),
  fillPeak: 0.62,
  fillBody: 0.32,
  fillEnd: 0.45,
  sheen: 0.42,
  sheenFar: 0.22,
  glyph: rgb(12, 12, 18, 0.9),
  glyphSecondary: rgb(12, 12, 18, 0.68),
};

/** L'action principale (`--lg-pane-prominent-fill`) : la marque, presque opaque, le rose un cran profond. */
export const PANE_PROMINENT = { from: rgb(190, 24, 93, 0.96), to: rgb(109, 40, 217, 0.9) } as const;

/** La pastille (`.lg-bead`) : plus fine, même encre. */
export const BEAD_DARK = { saturate: 1.8, fill: 0.08, ink: rgb(7, 5, 12, 0.26) } as const;
export const BEAD_LIGHT = { saturate: 1.8, fill: 0.55, ink: rgb(255, 255, 255, 0) } as const;

const WHITE_AT = (a: number): Rgba => rgb(255, 255, 255, a);

/** La couleur du verre au-dessus d'un dessous (après le givre), avec `white` d'opacité blanche cumulée. */
export function paneColorOver(backdrop: Rgba, tone: PaneToneMaterial, white: number): Rgba {
  const filtered = cssBrightness(cssSaturate(backdrop, tone.saturate), tone.brightness);
  return compositeOver(WHITE_AT(white), compositeOver(tone.ink, filtered));
}

/** Deux taches qui se croisent à leur cœur, la seconde au-dessus. */
function crossing(base: Rgba, under: AmbientBlob, over: AmbientBlob): Rgba {
  return compositeOver({ ...over.color, a: over.alpha }, compositeOver({ ...under.color, a: under.alpha }, base));
}

/** Le pire contraste `text` / verre sur tous les croisements de deux taches (et le fond nu). */
export function worstPaneContrast(text: Rgba, tone: PaneToneMaterial, blobs: readonly AmbientBlob[], base: Rgba, white: number): number {
  const backdrops: Rgba[] = [base];
  for (const a of blobs) for (const b of blobs) if (a !== b) backdrops.push(crossing(base, a, b));
  let worst = Infinity;
  for (const backdrop of backdrops) {
    const surface = paneColorOver(backdrop, tone, white);
    worst = Math.min(worst, contrastRatio(compositeOver(text, surface), surface));
  }
  return worst;
}

/** L'opacité blanche cumulée du coin du reflet (dégradé au plus fort + reflet). */
export const sheenCorner = (tone: PaneToneMaterial): number => 1 - (1 - tone.fillPeak) * (1 - tone.sheen);

/** Hors du coin du reflet, le plus blanc du verre : le bout du dégradé sous le second reflet. */
export const paneBody = (tone: PaneToneMaterial): number => 1 - (1 - tone.fillEnd) * (1 - tone.sheenFar);

/** Une teinte d'image ramenée sous la luminance de nos roses (même teinte, plus sombre). */
export function capTintLuminance(color: Rgba, max = AMBIENT_TINT_MAX_LUMINANCE): Rgba {
  if (relativeLuminance(color) <= max) return color;
  let low = 0;
  let high = 1;
  for (let i = 0; i < 16; i++) {
    const k = (low + high) / 2;
    if (relativeLuminance(rgb(color.r * k, color.g * k, color.b * k)) > max) high = k;
    else low = k;
  }
  return rgb(Math.round(color.r * low), Math.round(color.g * low), Math.round(color.b * low));
}
