/**
 * Ressorts du Liquid Glass — la physique de référence, pure.
 *
 * Paramétrage d'Apple (SwiftUI `.spring(response:dampingFraction:)`) plutôt
 * que raideur/amortissement : `response` est la période d'oscillation non
 * amortie, en secondes ; `dampingFraction` vaut 1 au critique (aucun rebond),
 * moins de 1 pour un rebond. Deux nombres qui se lisent, là où « raideur 420,
 * amortissement 28 » ne dit rien de ce que l'on verra.
 *
 * Trois sorties, une seule courbe :
 *  - `springPosition` : la position à l'instant t (0 → 1), solution analytique ;
 *  - `springToCssLinear` : la même courbe en `linear()` CSS — une transition CSS
 *    qui rebondit, sans une ligne de JavaScript par image (Chromium ≥ 113) ;
 *  - `springToFramer` : la même pour framer-motion (raideur, amortissement, masse 1).
 */

export interface GlassSpring {
  /** Période non amortie, en secondes (> 0). */
  response: number;
  /** 1 = critique, < 1 = rebond, > 1 = suramorti. */
  dampingFraction: number;
}

/** Seuil de repos : écart au but sous lequel le ressort est considéré posé. */
export const SPRING_REST_EPSILON = 0.001;

/**
 * Les ressorts de référence. Les valeurs suivent l'échelle de `motion.ts`
 * (150–400 ms perçus) : `lens` répond au doigt et rebondit franchement,
 * `morph` porte une forme qui change de taille et ne doit presque pas rebondir,
 * `settle` repose ce qui sort, sans rebond.
 */
export const GLASS_SPRINGS = {
  lens: { response: 0.32, dampingFraction: 0.55 },
  morph: { response: 0.42, dampingFraction: 0.84 },
  settle: { response: 0.26, dampingFraction: 1 },
} as const satisfies Record<string, GlassSpring>;

export type GlassSpringName = keyof typeof GLASS_SPRINGS;

/** Position du ressort à l'instant `t` (secondes), départ 0, but 1, vitesse nulle. */
export function springPosition(spring: GlassSpring, t: number): number {
  if (t <= 0) return 0;
  const omega0 = (2 * Math.PI) / spring.response;
  const zeta = spring.dampingFraction;
  if (zeta < 1) {
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
    const envelope = Math.exp(-zeta * omega0 * t);
    return 1 - envelope * (Math.cos(omegaD * t) + ((zeta * omega0) / omegaD) * Math.sin(omegaD * t));
  }
  if (zeta === 1) {
    return 1 - Math.exp(-omega0 * t) * (1 + omega0 * t);
  }
  // Suramorti : deux exponentielles réelles.
  const root = Math.sqrt(zeta * zeta - 1);
  const r1 = -omega0 * (zeta - root);
  const r2 = -omega0 * (zeta + root);
  const c2 = r1 / (r1 - r2);
  const c1 = 1 - c2;
  return 1 - (c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t));
}

/**
 * Durée au bout de laquelle le ressort ne quitte plus le voisinage du but
 * (`SPRING_REST_EPSILON`), arrondie à la milliseconde. Cherchée par pas de
 * 1 ms depuis la fin : le dernier instant hors tolérance fait foi, un rebond
 * tardif n'est donc jamais coupé.
 */
export function springSettleSeconds(spring: GlassSpring): number {
  const horizon = spring.response * 6;
  for (let ms = Math.ceil(horizon * 1000); ms >= 0; ms -= 1) {
    if (Math.abs(1 - springPosition(spring, ms / 1000)) > SPRING_REST_EPSILON) {
      return (ms + 1) / 1000;
    }
  }
  return 0;
}

/** Plus grand dépassement du but (0 sans rebond) — utile pour borner une échelle. */
export function springOvershoot(spring: GlassSpring): number {
  if (spring.dampingFraction >= 1) return 0;
  const zeta = spring.dampingFraction;
  return Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta));
}

const round4 = (n: number): string => {
  const v = Math.round(n * 10000) / 10000;
  return Object.is(v, -0) ? "0" : String(v);
};

/**
 * La courbe en `linear()` CSS, échantillonnée régulièrement sur la durée de
 * repos. 40 points suffisent : entre deux points, l'écart à la vraie courbe
 * reste sous le centième (vérifié par le test) — sous le pixel pour un
 * grossissement de quelques pour cent.
 */
export function springToCssLinear(spring: GlassSpring, samples = 40): { easing: string; durationMs: number } {
  const settle = springSettleSeconds(spring);
  const points: string[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = (i / samples) * settle;
    points.push(round4(i === samples ? 1 : springPosition(spring, t)));
  }
  return { easing: `linear(${points.join(", ")})`, durationMs: Math.round(settle * 1000) };
}

/** Équivalent framer-motion (masse 1) : k = ω0², c = 2ζω0. */
export function springToFramer(spring: GlassSpring): { type: "spring"; stiffness: number; damping: number; mass: 1 } {
  const omega0 = (2 * Math.PI) / spring.response;
  return {
    type: "spring",
    stiffness: Math.round(omega0 * omega0 * 10) / 10,
    damping: Math.round(2 * spring.dampingFraction * omega0 * 100) / 100,
    mass: 1,
  };
}
