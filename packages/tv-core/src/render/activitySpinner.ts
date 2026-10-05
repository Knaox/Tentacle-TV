/**
 * L'INDICATEUR D'ACTIVITÉ de l'Apple TV — `UIActivityIndicatorView`, que
 * React Native pose pour `ActivityIndicator` (`large` : style `.large`,
 * `small` : `.medium`) —, relevé au pixel sur le simulateur tvOS 26
 * « Apple TV 4K (3rd generation) (at 1080p) », un point par pixel, le
 * 2026-10-05 (une app de référence nue, captures sans perte et vidéo) :
 *
 * - HUIT rayons en gélule (bouts ronds), du centre vers le bord du cadre ;
 * - l'éclairage avance d'un rayon toutes les 100 ms, dans le sens des
 *   aiguilles d'une montre — un tour en 800 ms — ; un rayon éclairé
 *   s'éteint ensuite, linéairement, en 400 ms, jusqu'à l'opacité de repos ;
 * - l'image ne change que toutes les 50 ms (20 par seconde) : neuf paliers
 *   d'opacité, de 69/255 (repos) à 217/255 (éclairé), blanc sur noir.
 *
 * Android TV le redessine à l'identique (`TentacleSpinnerView`, profil de
 * rendu `spinner: "drawn"`) : son indicateur système est un arc Material de
 * 36 points — un autre dessin, rastérisé en 36 × 36 pixels puis agrandi
 * (flou) là où l'écran le grossit, et animé par le RenderThread, qui
 * redessinait toute la fenêtre 60 fois par seconde tant qu'il tournait.
 */

export interface SpinnerGeometry {
  /** Le cadre du dessin, en points : centré sur la vue, quelle que soit sa taille. */
  box: number;
  /** L'épaisseur d'un rayon (le diamètre de ses bouts ronds). */
  spokeWidth: number;
  /** Du centre au bout intérieur d'un rayon. */
  innerRadius: number;
  /** Du centre au bout extérieur : le bord du cadre. */
  outerRadius: number;
}

export type SpinnerSize = "large" | "small";

export const ACTIVITY_SPINNER = {
  spokes: 8,
  /** L'éclairage passe au rayon suivant. */
  stepMs: 100,
  /** L'image change (20 par seconde). */
  frameMs: 50,
  /** Un rayon éclairé revient au repos. */
  fadeMs: 400,
  /** L'opacité d'un rayon au repos, et celle du rayon éclairé (de la couleur de l'indicateur). */
  restAlpha: 69 / 255,
  litAlpha: 217 / 255,
  large: { box: 64, spokeWidth: 9, innerRadius: 9, outerRadius: 32 } as SpinnerGeometry,
  small: { box: 40, spokeWidth: 5, innerRadius: 6, outerRadius: 20 } as SpinnerGeometry,
} as const;

/** Le cadre de mise en page que React Native donne à `ActivityIndicator` (`sizeLarge`, `sizeSmall`) :
 *  le dessin le déborde, centré, comme sur Apple TV. */
export const SPINNER_LAYOUT_BOX: Readonly<Record<SpinnerSize, number>> = { large: 36, small: 20 };

const mod = (value: number, n: number) => ((value % n) + n) % n;

/**
 * L'opacité de chaque rayon (0 : à droite, puis dans le sens des aiguilles
 * d'une montre) `elapsedMs` après le départ — en fraction de la couleur.
 * Le rayon 0 s'allume au départ.
 */
export function spinnerAlphas(elapsedMs: number): number[] {
  const { spokes, stepMs, frameMs, fadeMs, restAlpha, litAlpha } = ACTIVITY_SPINNER;
  const frame = Math.floor(Math.max(0, elapsedMs) / frameMs);
  const framesPerStep = stepMs / frameMs;
  const levels = fadeMs / frameMs;
  const step = Math.floor(frame / framesPerStep);
  return Array.from({ length: spokes }, (_, spoke) => {
    // Le dernier allumage de ce rayon : l'étape la plus récente qui lui revient.
    const litStep = step - mod(step - spoke, spokes);
    const age = frame - litStep * framesPerStep;
    const level = Math.max(0, levels - age) / levels;
    return restAlpha + (litAlpha - restAlpha) * level;
  });
}
