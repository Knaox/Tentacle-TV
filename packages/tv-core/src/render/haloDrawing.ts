import type { RenderProfile } from "./renderProfile";

/**
 * Le dessin d'un halo d'œuvre (`ArtworkHalo`) : flouté PETIT, à `scale` de sa
 * taille, puis agrandi par le GPU. `deviation` : l'écart-type à écrire dans
 * son `FeGaussianBlur` pour que le halo agrandi ait le flou voulu (`blur`, en
 * points de la scène).
 *
 * - Apple TV (`points`) : l'écart-type écrit est celui du dessin, en points
 *   — le rendu de référence, inchangé.
 * - Android (`renderscript`) : react-native-svg floute en pixels du dessin
 *   par RenderScript, d'un rayon r = 2 × l'écart-type écrit, plafonné à 25 ;
 *   RenderScript en tire σ = 0,4 r + 0,6. On écrit donc l'écart-type qui rend
 *   le σ voulu, et le dessin se calcule à la densité 1 quelle que soit
 *   l'échelle de l'écran (un téléviseur 4K ne dessine pas quatre fois plus
 *   de pixels) ; un flou qui dépasserait le plafond fait réduire le dessin
 *   d'autant — un flou agrandi reste un flou.
 */

/** Le plus grand rayon de RenderScript. */
const RS_MAX_RADIUS = 25;
/** σ = 0,4 r + 0,6 (ScriptIntrinsicBlur). */
const rsSigmaOf = (radius: number) => 0.4 * radius + 0.6;
/** Le plus grand flou que RenderScript rende, en pixels du dessin. */
export const RS_MAX_SIGMA = rsSigmaOf(RS_MAX_RADIUS);

export function haloDrawing(render: Pick<RenderProfile, "haloDrawScale" | "svgBlur">, blur: number, pixelRatio: number): { scale: number; deviation: number } {
  const base = render.haloDrawScale;
  if (render.svgBlur === "points") return { scale: base, deviation: blur * base };
  // En pixels du dessin, à la densité 1 : le flou voulu, borné au plafond.
  const wanted = Math.max(0, blur * base);
  const sigma = Math.min(wanted, RS_MAX_SIGMA);
  const shrink = wanted > RS_MAX_SIGMA ? RS_MAX_SIGMA / wanted : 1;
  const ratio = pixelRatio > 0 ? pixelRatio : 1;
  // r = (σ − 0,6) / 0,4, écrit comme r / 2 ; sous 0,6 px, aucun flou.
  return { scale: (base * shrink) / ratio, deviation: Math.max(0, (sigma - 0.6) / 0.8) };
}
