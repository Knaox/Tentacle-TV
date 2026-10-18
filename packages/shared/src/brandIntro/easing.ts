/**
 * Courbes et petits calculs du mouvement de l'ouverture — purs, sans DOM.
 * Portés du site (`Tentacle Web`, `src/js/survey/easing.js`) : le web les
 * lirait tels quels, la TV les échantillonne (tv-core `boot/introSamples`).
 */

export const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

/** Un segment de la chorégraphie : départ et durée, en ms depuis le début. */
export interface IntroSpan {
  at: number;
  dur: number;
}

/** Avancement (0 → 1) d'un segment à l'instant t (ms). */
export const progressOf = (t: number, { at, dur }: IntroSpan): number => clamp((t - at) / dur);

export const smoothstep = (x: number): number => x * x * (3 - 2 * x);

export type Easing = (x: number) => number;

/** Les quatre points d'un `cubic-bezier` CSS. */
export type BezierPoints = readonly [number, number, number, number];

/**
 * cubic-bezier(x1, y1, x2, y2), le même qu'en CSS : une animation pilotée à la
 * main suit exactement la courbe des transitions du site.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  const solve = (x: number): number => {
    let t = x;
    for (let i = 0; i < 8; i += 1) {
      const error = sampleX(t) - x;
      if (Math.abs(error) < 1e-6) return t;
      const slope = slopeX(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= error / slope;
    }
    // Repli par dichotomie : Newton s'égare là où la courbe est presque plate.
    let low = 0;
    let high = 1;
    t = x;
    for (let i = 0; i < 32; i += 1) {
      const value = sampleX(t);
      if (Math.abs(value - x) < 1e-6) break;
      if (value < x) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return t;
  };

  return (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solve(x)));
}

/** Les courbes nommées de la chorégraphie (celles du site, et les mots-clés CSS). */
export const INTRO_EASINGS = {
  linear: [0, 0, 1, 1],
  out: [0.22, 1, 0.36, 1],
  outBack: [0.34, 1.4, 0.64, 1],
  outBounce: [0.34, 1.56, 0.64, 1],
  /** Les bras avant qui se referment sur l'écran : l'étreinte. */
  hug: [0.3, 1.35, 0.5, 1],
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1],
  /** La plongée : lente au départ, rapide au milieu, posée à l'arrivée. */
  zoom: [0.7, 0, 0.16, 1],
  /** Le cercle qui ouvre la vitre. */
  reveal: [0.3, 0, 0.1, 1],
} as const satisfies Record<string, BezierPoints>;

export type IntroEasingName = keyof typeof INTRO_EASINGS;

const cache = new Map<IntroEasingName, Easing>();

/** La courbe d'un nom, construite une fois. */
export function introEasing(name: IntroEasingName): Easing {
  let easing = cache.get(name);
  if (!easing) {
    const [x1, y1, x2, y2] = INTRO_EASINGS[name];
    easing = name === "linear" ? (x: number) => clamp(x) : cubicBezier(x1, y1, x2, y2);
    cache.set(name, easing);
  }
  return easing;
}
