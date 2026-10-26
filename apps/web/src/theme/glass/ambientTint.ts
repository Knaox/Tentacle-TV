/**
 * Le fond ambiant — les DEUX teintes d'une image (affiche, bannière, pochette),
 * PURE : la moitié gauche et la moitié droite, chacune une moyenne pondérée
 * par la saturation (une affiche noire et rouge donne du rouge, pas du gris),
 * puis ramenée sous la luminance de nos roses (`capTintLuminance`) — une
 * affiche jaune ou blanche ne fait jamais tomber le texte d'un verre sous
 * l'AA. Une moitié sans couleur prend la teinte de l'autre ; une image sans
 * couleur du tout n'a pas de teinte : le fond garde nos couleurs.
 */

import type { Rgba } from "./contrast";
import { capTintLuminance } from "./paneMaterial";

/** Sous ce poids (pixels presque gris), pas de teinte. */
const MIN_WEIGHT = 0.02;
/** Une teinte trop terne est ravivée jusque-là (saturation HSV, 0…1). */
const MIN_SATURATION = 0.45;

function weightedTint(data: ArrayLike<number>, width: number, height: number, fromX: number, toX: number): Rgba | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let total = 0;
  let count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = fromX; x < toX; x++) {
      const i = (y * width + x) * 4;
      if ((data[i + 3] as number) < 200) continue;
      count += 1;
      const pr = data[i] as number;
      const pg = data[i + 1] as number;
      const pb = data[i + 2] as number;
      const max = Math.max(pr, pg, pb);
      if (max < 20) continue;
      const saturation = (max - Math.min(pr, pg, pb)) / max;
      const weight = saturation * saturation;
      r += pr * weight;
      g += pg * weight;
      b += pb * weight;
      total += weight;
    }
  }
  if (count === 0 || total / count < MIN_WEIGHT) return null;
  return vivid({ r: r / total, g: g / total, b: b / total, a: 1 });
}

/** Ravive une teinte terne (même teinte, la saturation portée à `MIN_SATURATION`). */
function vivid(c: Rgba): Rgba {
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  if (max === 0 || (max - min) / max >= MIN_SATURATION) return c;
  const floor = max * (1 - MIN_SATURATION);
  const scale = max === min ? 0 : (max - floor) / (max - min);
  const lift = (v: number) => max - (max - v) * scale;
  return { r: lift(c.r), g: lift(c.g), b: lift(c.b), a: 1 };
}

const triplet = (c: Rgba): string => `${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}`;

/**
 * Les deux teintes (« r, g, b ») de pixels RGBA `width × height` (une vignette
 * réduite), gauche puis droite — ou `null` si l'image n'a pas de couleur.
 */
export function ambientTintsFromPixels(data: ArrayLike<number>, width: number, height: number): readonly [string, string] | null {
  const half = Math.max(1, Math.floor(width / 2));
  const left = weightedTint(data, width, height, 0, half);
  const right = weightedTint(data, width, height, half, width);
  const a = left ?? right;
  const b = right ?? left;
  if (a === null || b === null) return null;
  return [triplet(capTintLuminance(a)), triplet(capTintLuminance(b))];
}
