/**
 * Octave — la teinte d'une pochette, PURE : ce qui teinte l'eau du lecteur
 * plein écran. Une moyenne PONDÉRÉE par la saturation (une pochette noire et
 * rouge donne du rouge, pas du gris), puis ramenée dans une plage sûre —
 * jamais trop sombre pour se voir sur l'encre, jamais criarde. Une pochette
 * sans couleur (noir et blanc) n'a pas de teinte : l'eau garde le rose d'Octave.
 */

export type Rgb = readonly [number, number, number];

/** Sous ce poids total (pixels presque gris), pas de teinte. */
const MIN_WEIGHT = 0.02;
const TARGET_LIGHTNESS = 0.62;
const MIN_SATURATION = 0.45;
const MAX_SATURATION = 0.85;

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hueToRgb(p: number, q: number, t: number): number {
  const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
  if (u < 1 / 6) return p + (q - p) * 6 * u;
  if (u < 1 / 2) return q;
  if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number): number => Math.round(hueToRgb(p, q, t) * 255);
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)];
}

/** La teinte de pixels RGBA (une vignette réduite), ou `null` si la pochette n'a pas de couleur. */
export function tintFromPixels(data: ArrayLike<number>): Rgb | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let total = 0;
  let count = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if ((data[i + 3] as number) < 200) continue;
    count += 1;
    const pr = (data[i] as number) / 255;
    const pg = (data[i + 1] as number) / 255;
    const pb = (data[i + 2] as number) / 255;
    const max = Math.max(pr, pg, pb);
    const min = Math.min(pr, pg, pb);
    if (max < 0.08) continue;
    const saturation = (max - min) / max;
    // La couleur compte au carré de sa saturation : quelques pixels vifs l'emportent sur un fond terne.
    const weight = saturation * saturation;
    r += pr * weight;
    g += pg * weight;
    b += pb * weight;
    total += weight;
  }
  if (count === 0 || total / count < MIN_WEIGHT) return null;
  const [h, s] = rgbToHsl(r / total, g / total, b / total);
  return hslToRgb(h, Math.min(MAX_SATURATION, Math.max(MIN_SATURATION, s)), TARGET_LIGHTNESS);
}

/** La teinte en triplet CSS (« 236, 72, 153 »), la forme de `--oc-accent-rgb`. */
export function rgbTriplet([r, g, b]: Rgb): string {
  return `${r}, ${g}, ${b}`;
}
