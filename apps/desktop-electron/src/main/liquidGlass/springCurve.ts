/**
 * Le ressort de la page, rejoué par AppKit.
 *
 * La page anime ses verres au RESSORT (`apps/web/src/theme/glass/springs.ts`,
 * lg-physique) ; une région native qui la suivait sur une courbe fixe divergeait
 * d'elle pendant une métamorphose. Le natif reprend donc la MÊME physique :
 * paramétrage d'Apple (`response`, `dampingFraction`), mêmes ressorts —
 * `contractMirror.test.ts` relit `springs.ts` et refuse que les valeurs divergent.
 *
 * # Pourquoi 291 ms et pas les 584 ms de `NATIVE_GLASS_MORPH_MS`
 *
 * La page arrête le ressort à son repos à 0,1 % (584 ms pour `morph`). Une seule
 * Bézier ne sait pas suivre une montée rapide PUIS cette longue traîne : la
 * meilleure possible sur 584 ms s'écarte du ressort de 3,7 % en pleine course
 * (recherche exhaustive, 21/10) — 11 px sur une métamorphose de 300 px. Sur la
 * coupe à 1 % (`SPRING_CSS_EPSILON`, 291 ms), elle reste sous 1 % de bout en
 * bout, et elle FINIT exactement au but : ajustée, pas tronquée, elle n'a pas le
 * saut final d'un ressort coupé. Ensuite, la page ne s'éloigne plus du but que
 * de 0,76 % au plus (le dépassement de `morph`), soit 2 px sur 300.
 *
 * # Pourquoi une courbe de Bézier, et pas `CASpringAnimation`
 *
 * Mesuré le 21/10 (maquette, macOS 26.6) : un `NSGlassEffectView` IGNORE les
 * animations Core Animation posées sur sa couche — position, taille, opacité :
 * la forme est déjà à destination à 60 ms. Seul l'animateur d'AppKit
 * (`NSAnimationContext`) fait suivre la forme du verre, et il ne prend qu'une
 * courbe de Bézier (`CAMediaTimingFunction`), rabotée à [0, 1]. On ajuste donc
 * la Bézier la plus proche de la réponse du ressort, sur sa coupe à 1 % :
 * `morph` (dépassement < 1 %) y est rendu fidèlement ; un ressort qui rebondit
 * franchement (`lens`, 12 %) y perd son rebond, jamais sa durée.
 */

/** Un ressort au paramétrage d'Apple — celui de la page. */
export interface GlassSpring {
  /** Période non amortie, en secondes. */
  readonly response: number;
  /** 1 = critique, < 1 = rebond, > 1 = suramorti. */
  readonly dampingFraction: number;
}

/** Les ressorts de la page (`GLASS_SPRINGS`), recopiés et verrouillés par test. */
export const GLASS_SPRINGS = {
  lens: { response: 0.32, dampingFraction: 0.55 },
  morph: { response: 0.42, dampingFraction: 0.84 },
  settle: { response: 0.26, dampingFraction: 1 },
} as const satisfies Record<string, GlassSpring>;

/** Coupe : 1 % du trajet, celle des transitions CSS de la page (`SPRING_CSS_EPSILON`). */
export const SPRING_CUT = 0.01;

/** Une animation que l'animateur d'AppKit sait jouer : durée et Bézier. */
export interface NativeMotion {
  readonly durationMs: number;
  /** `x1, y1, x2, y2` de `functionWithControlPoints::::`, tous dans [0, 1]. */
  readonly points: readonly [number, number, number, number];
}

/** Position à `t` secondes, départ 0, but 1, vitesse nulle — la formule de la page. */
export function springPosition(spring: GlassSpring, t: number): number {
  if (t <= 0) return 0;
  const omega0 = (2 * Math.PI) / spring.response;
  const zeta = spring.dampingFraction;
  if (zeta < 1) {
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
    const envelope = Math.exp(-zeta * omega0 * t);
    return 1 - envelope * (Math.cos(omegaD * t) + ((zeta * omega0) / omegaD) * Math.sin(omegaD * t));
  }
  if (zeta === 1) return 1 - Math.exp(-omega0 * t) * (1 + omega0 * t);
  const root = Math.sqrt(zeta * zeta - 1);
  const r1 = -omega0 * (zeta - root);
  const r2 = -omega0 * (zeta + root);
  const c2 = r1 / (r1 - r2);
  return 1 - ((1 - c2) * Math.exp(r1 * t) + c2 * Math.exp(r2 * t));
}

/** Dernier instant hors de la coupe, au millième près — la recherche de la page (`springSettleSeconds`). */
export function springCutSeconds(spring: GlassSpring, epsilon = SPRING_CUT): number {
  for (let ms = Math.ceil(spring.response * 6 * 1000); ms >= 0; ms -= 1) {
    if (Math.abs(1 - springPosition(spring, ms / 1000)) > epsilon) return (ms + 1) / 1000;
  }
  return 0;
}

type Points = [number, number, number, number];

/** La Bézier `points` à l'abscisse `u` : on résout x(s) = u, puis on rend y(s). */
export function bezierAt(points: readonly [number, number, number, number], u: number): number {
  const [x1, y1, x2, y2] = points;
  const curve = (a: number, b: number, s: number): number => 3 * (1 - s) * (1 - s) * s * a + 3 * (1 - s) * s * s * b + s * s * s;
  let lo = 0;
  let hi = 1;
  let s = u;
  for (let i = 0; i < 40; i += 1) {
    const x = curve(x1, x2, s);
    if (Math.abs(x - u) < 1e-6) break;
    if (x < u) lo = s;
    else hi = s;
    s = (lo + hi) / 2;
  }
  return curve(y1, y2, s);
}

const SAMPLES = 48;
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Bézier aux moindres carrés sur la réponse du ressort, par descente coordonnée. */
function fit(target: readonly number[]): Points {
  const error = (p: Points): number => {
    let sum = 0;
    for (let i = 0; i <= SAMPLES; i += 1) {
      const d = bezierAt(p, i / SAMPLES) - (target[i] ?? 0);
      sum += d * d;
    }
    return sum;
  };
  let best: Points = [0.25, 0.8, 0.3, 1];
  let bestError = error(best);
  for (let step = 0.2; step > 1e-4; ) {
    let improved = false;
    for (let k = 0; k < 4; k += 1) {
      for (const direction of [-1, 1]) {
        const candidate = [...best] as Points;
        candidate[k] = clamp01((candidate[k] ?? 0) + direction * step);
        const candidateError = error(candidate);
        if (candidateError < bestError) {
          best = candidate;
          bestError = candidateError;
          improved = true;
        }
      }
    }
    if (!improved) step /= 2;
  }
  return best.map((v) => Math.round(v * 1000) / 1000) as Points;
}

const fitted = new Map<string, NativeMotion>();

/** Durée de coupe et Bézier ajustée d'un ressort — calculées une fois par ressort. */
export function springMotion(spring: GlassSpring): NativeMotion {
  const key = `${String(spring.response)}/${String(spring.dampingFraction)}`;
  const known = fitted.get(key);
  if (known !== undefined) return known;
  const seconds = springCutSeconds(spring);
  const target: number[] = [];
  // Le dernier point est forcé au but, comme le fait la page pour son `linear()`.
  for (let i = 0; i <= SAMPLES; i += 1) target.push(i === SAMPLES ? 1 : springPosition(spring, (i / SAMPLES) * seconds));
  const motion: NativeMotion = { durationMs: Math.round(seconds * 1000), points: fit(target) };
  fitted.set(key, motion);
  return motion;
}
