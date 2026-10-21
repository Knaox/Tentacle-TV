/**
 * Contraste du texte sur le verre — WCAG 2.x, pur.
 *
 * Un verre n'a pas UNE couleur : sa teinte est composée sur ce qui passe
 * derrière. On mesure donc le PIRE cas — la teinte posée sur un fond blanc
 * (thème sombre) ou noir (thème clair), le flou ne faisant qu'en moyenner les
 * couleurs — puis le texte, lui-même éventuellement translucide, sur ce
 * résultat.
 */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** `#RGB`, `#RRGGBB`, `rgb(…)` ou `rgba(…)` ; null sinon (variable, mot-clé). */
export function parseColor(input: string): Rgba | null {
  const s = input.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  const fn = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(s);
  if (!fn) return null;
  const alpha = fn[4] === undefined ? 1 : fn[4].endsWith("%") ? parseFloat(fn[4]) / 100 : parseFloat(fn[4]);
  return { r: +fn[1], g: +fn[2], b: +fn[3], a: alpha };
}

/** `top` posé sur `bottom` (opaque), en sRGB comme le compositeur. */
export function compositeOver(top: Rgba, bottom: Rgba): Rgba {
  const mix = (t: number, b: number) => t * top.a + b * (1 - top.a);
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 };
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(c: Rgba): number {
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

export function contrastRatio(a: Rgba, b: Rgba): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };
export const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };

/**
 * Contraste du texte `text` sur le verre teinté `tint`, au pire des fonds
 * `backdrops` (par défaut blanc ET noir : le verre passe sur tout).
 */
export function worstGlassContrast(text: Rgba, tint: Rgba, backdrops: Rgba[] = [WHITE, BLACK]): number {
  let worst = Infinity;
  for (const backdrop of backdrops) {
    const surface = compositeOver(tint, backdrop);
    worst = Math.min(worst, contrastRatio(compositeOver(text, surface), surface));
  }
  return worst;
}

/** Seuils WCAG AA. */
export const WCAG_AA_TEXT = 4.5;
export const WCAG_AA_LARGE = 3;
