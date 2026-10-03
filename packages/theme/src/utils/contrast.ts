import { hexToRgb, mixHex } from "./color";

/**
 * Le contraste WCAG 2.x entre deux couleurs hex — de 1 (aucun) à 21 (noir
 * sur blanc). AA : 4,5 pour un texte courant, 3 pour un grand texte ou une
 * icône. Sert aux garde-fous des dégradés posés sous un libellé.
 */

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Le pire contraste d'un texte posé sur un dégradé à deux arrêts, mesuré tous
 * les `steps`-ièmes du trajet (interpolation sRGB, celle des navigateurs et
 * de `LinearGradient`).
 */
export function minContrastOnGradient(text: string, from: string, to: string, steps = 40): number | null {
  let min = Infinity;
  for (let i = 0; i <= steps; i += 1) {
    const ratio = contrastRatio(text, mixHex(from, to, i / steps, from));
    if (ratio === null) return null;
    min = Math.min(min, ratio);
  }
  return min;
}
