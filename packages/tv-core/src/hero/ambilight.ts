/**
 * Le halo de bannière — la géométrie et l'arithmétique, sans rendu.
 *
 * La référence est le web (`HeroAmbilight.tsx`) : l'affiche elle-même, servie
 * une seconde fois en petit, floutée à 48 px sur une carte de 1524 px, posée
 * DERRIÈRE la carte. Rien n'est échantillonné, aucune couleur n'est extraite —
 * le halo EST l'image.
 *
 * Deux choses ne se transposent pas telles quelles en React Native, et ce
 * module existe pour les deux.
 *
 * 1. `filter: blur()` travaille en pixels d'écran ; `blurRadius` travaille en
 *    pixels du BITMAP DÉCODÉ, qui reste à la taille de la source (iOS :
 *    `RCTImageView.mm` floute `loadedImage`, et `RCTImageUtils.mm` refuse de
 *    suragrandir). Poser 48 sur une source de 128 px, c'est un noyau de 18 %
 *    de la largeur : l'affiche est écrasée en une couleur moyenne. D'où un
 *    RAPPORT, jamais un nombre de pixels — et une inversion par plateforme,
 *    parce qu'iOS fait trois passes de boîte et Android deux.
 * 2. `blurRadius` ne déborde pas de son rectangle : l'arête reste franche. Le
 *    débordement est donc reconstruit par des couches concentriques dont
 *    l'alpha suit l'extinction qu'un vrai flou aurait produite.
 */

/** Une couche du halo. `d` : dilatation au-delà de la carte, en points.
 *  `opacity` : l'alpha de CETTE couche — pas le composite qu'elle produit. */
export interface HaloLayer {
  d: number;
  opacity: number;
}

export interface HaloRamp {
  /** Écart-type de l'extinction, en points d'écran. */
  sigma: number;
  /** Débordement total : la dilatation de la couche la plus externe. */
  bleed: number;
  /** De la plus interne à la plus externe. */
  layers: readonly HaloLayer[];
}

/** Φ, la répartition normale centrée réduite. `erf` par Abramowitz & Stegun
 *  7.1.26 — 1,5·10⁻⁷ d'erreur, trois ordres de grandeur sous ce qu'un alpha
 *  sur 8 bits peut exprimer. */
export function phi(x: number): number {
  const s = x < 0 ? -1 : 1;
  const a = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * a);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-a * a);
  return 0.5 * (1 + s * erf);
}

/** Φ⁻¹, par bissection : cinquante tours suffisent et il n'y a aucune table
 *  de coefficients à auditer. */
export function probit(p: number): number {
  if (p <= 0) return -10;
  if (p >= 1) return 10;
  let low = -10;
  let high = 10;
  for (let i = 0; i < 50; i += 1) {
    const mid = (low + high) / 2;
    if (phi(mid) < p) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/** L'extinction visée : le flou gaussien floute aussi l'ALPHA, donc à la
 *  distance `d` hors d'une arête il reste `Φ(−d/σ)` — la moitié sur l'arête
 *  elle-même, et non un. C'est la courbe que la rampe discrétise. */
export const haloProfile = (d: number, sigma: number): number => phi(-d / sigma);

/** σ en points d'écran : le rapport de la référence appliqué à la carte réelle
 *  (48 / 1524 sur le web ; ici la largeur mesurée). */
export const haloSigma = (cardWidth: number, blurRatio: number): number =>
  blurRatio * cardWidth;

/**
 * La rampe.
 *
 * On découpe l'extinction en `n` valeurs équidistantes de Φ, de 0,5 sur l'arête
 * jusqu'au `plancher`, ce qui donne les frontières `d`. Le composite visé dans
 * l'anneau `k` est la mi-valeur de ses deux frontières ; comme toutes les
 * couches portent la même couleur, l'empilement `src-over` télescope :
 *
 *     C_k = 1 − Π_{i≥k}(1 − a_i)   ⇒   a_k = 1 − (1 − C_k)/(1 − C_{k+1})
 *
 * Les alphas obtenus sont tous du même ordre (aucune couche « principale »),
 * et le saut d'un anneau au suivant vaut exactement (0,5 − plancher)/n.
 */
export function haloRamp(
  cardWidth: number,
  { blurRatio, layers: n, alphaFloor }: { blurRatio: number; layers: number; alphaFloor: number },
): HaloRamp {
  const sigma = haloSigma(cardWidth, blurRatio);
  const step = (0.5 - alphaFloor) / n;

  // Frontières : d_j tel que Φ(−d_j/σ) = 0,5 − j·pas. d_0 vaut 0.
  const d: number[] = [];
  for (let j = 0; j <= n; j += 1) d.push(sigma * probit(1 - (0.5 - j * step)));

  // Composites visés, puis les alphas qui les produisent, de l'extérieur vers
  // l'intérieur (chaque couche ne « voit » que ce que les suivantes ont posé).
  const layers: HaloLayer[] = [];
  let nextComposite = 0;
  for (let k = n; k >= 1; k -= 1) {
    const composite = 0.5 - (k - 0.5) * step;
    layers.unshift({
      d: d[k],
      opacity: 1 - (1 - composite) / (1 - nextComposite),
    });
    nextComposite = composite;
  }

  return { sigma, bleed: d[n], layers };
}

/** σ atteint, en pixels du bitmap, pour un `blurRadius` donné — la formule
 *  native rejouée à l'identique, `floor` et division entière compris.
 *
 *  iOS (`RCTImageBlurUtils.mm`) : `boxSize = floor((R·s·3·√(2π)/4 + 0,5)/2) | 1`,
 *  puis TROIS `vImageBoxConvolve` ⇒ variance 3·(w²−1)/12.
 *  Android (`ReactImageView.kt`) : `r = (R·densité).toInt()/2`, puis
 *  `IterativeBoxBlurPostProcessor(2, r)` ⇒ DEUX passes de noyau 2r+1.
 *  σ_iOS ≈ 0,47·R·densité contre σ_Android ≈ 0,41·R·densité : ni l'une ni
 *  l'autre ne vaut le rayon annoncé, et elles ne coïncident pas (15 % d'écart)
 *  — d'où une inversion par plateforme, pas une constante partagée. */
export function effectiveSigma(
  radius: number,
  platform: "ios" | "android",
  pixelRatio: number,
): number {
  if (platform === "ios") {
    let w = Math.floor((radius * pixelRatio * 3 * Math.sqrt(2 * Math.PI)) / 4 / 2 + 0.25);
    w |= 1;
    return Math.sqrt(Math.max(0, w * w - 1)) / 2;
  }
  const r = Math.trunc(Math.trunc(radius * pixelRatio) / 2);
  if (r === 0) return 0;
  const width = 2 * r + 1;
  return Math.sqrt((width * width - 1) / 6);
}

/** Le `blurRadius` à poser pour obtenir `targetSigma` pixels de bitmap.
 *  L'inversion analytique existe mais bute sur le `floor` et le `| 1` ; un
 *  balayage au quart de point retombe sur l'optimum exact, une fois au montage. */
export function blurRadius(
  targetSigma: number,
  platform: "ios" | "android",
  pixelRatio: number,
): number {
  let best = 0;
  let delta = Number.POSITIVE_INFINITY;
  for (let r = 0.25; r <= 120; r += 0.25) {
    const e = Math.abs(effectiveSigma(r, platform, pixelRatio) - targetSigma);
    if (e < delta) {
      delta = e;
      best = r;
    }
  }
  return best;
}

/** σ visé dans le bitmap : le σ d'écran ramené à l'échelle de la source, telle
 *  qu'elle est grossie pour remplir la boîte de débordement. */
export const sigmaSource = (sigma: number, boxWidth: number, sourceWidth: number): number =>
  (sigma * sourceWidth) / boxWidth;

/** Sous-échelle de rendu. L'assemblage est rendu à 1/K puis remis à l'échelle :
 *  le cache rastérisé coûte K² fois moins, et sa magnification bilinéaire
 *  transforme chaque marche d'alpha en rampe de K points — c'est elle, plus que
 *  le nombre de couches, qui efface l'escalier. Plafonné par le plus petit
 *  écart entre deux couches : en dessous, les couches internes fusionnent en
 *  sous-pixel et rouvrent une grosse marche contre la carte. */
export function subScale(layers: readonly HaloLayer[]): number {
  let smallest = Number.POSITIVE_INFINITY;
  let previous = 0;
  for (const { d } of layers) {
    smallest = Math.min(smallest, d - previous);
    previous = d;
  }
  return Math.max(1, Math.floor(smallest));
}

// ── Le flou d'Android : inverser ce que react-native-svg lui fait subir ────

/**
 * Le plafond dur de `FeGaussianBlurView` (`Math.min(stdDeviation, 25f)`), au-delà
 * duquel le flou cesse d'obéir sans rien dire.
 */
export const ANDROID_MAX_RADIUS = 25;

/** σ de `ScriptIntrinsicBlur` pour un rayon donné (AOSP, `rsCpuIntrinsicBlur`). */
export const sigmaRenderScript = (radius: number): number => 0.4 * radius + 0.6;

export interface AndroidBlurSetting {
  /** Sous-échelle de rendu : le canevas fait 1/K, la vue le remet à l'échelle. */
  k: number;
  /** La valeur à transmettre à `FeGaussianBlur`. */
  stdDeviation: number;
}

/**
 * Le `stdDeviation` à transmettre sur Android pour obtenir le σ visé À L'ÉCRAN.
 *
 * # Pourquoi il faut le pré-compenser
 *
 * Les deux implémentations natives de `react-native-svg` ne font pas la même
 * chose de la valeur qu'on leur donne. Côté Apple, elle est multipliée par
 * l'échelle d'écran, avec un commentaire qui dit pourquoi :
 *
 *     // We need to multiply stdDeviation by screenScale to achive the same
 *     // results as on web
 *
 * Côté Android, rien de tel — un `× 2` en dur, censé compenser RenderScript,
 * puis un plafond :
 *
 *     float stdDeviation = Math.max(mStdDeviationX, mStdDeviationY) * 2;
 *     float radius = Math.min(stdDeviation, 25.0f);
 *
 * Or `ScriptIntrinsicBlur` rend σ = 0,4·r + 0,6. Le `× 2` rate donc le 0,4 de
 * vingt pour cent, et la densité n'entre jamais en compte. Le rapport obtenu
 * sur visé vaut `(0,8·s + 0,6) / (s · densité)` : 0,87 à densité 1, 0,43 à
 * densité 2. Jamais un. La lueur ourle la carte au lieu de l'entourer, et
 * d'autant moins que la dalle est fine.
 *
 * # Ce que fait cette fonction
 *
 * Elle remonte la chaîne. Le bitmap du canevas est à la densité de l'écran, et
 * la vue le remet à l'échelle ×K : le σ obtenu À L'ÉCRAN, en pixels, vaut donc
 * `(0,4·min(2s ; 25) + 0,6) × K`. On veut `targetSigma × densité`, d'où
 * `s = (targetSigma · densité / K − 0,6) / 0,8`.
 *
 * Reste le plafond. Si `s` dépasse 12,5, le rayon sature à 25 et le flou
 * s'arrête là, en silence. Plutôt que de le subir, on RÉDUIT le canevas : rendre
 * à 1/12 au lieu de 1/6 demande deux fois moins de rayon pour le même résultat
 * à l'écran. C'est exactement le levier que la référence web utilise déjà —
 * douze et demi pour cent, puis `scale(8)`.
 */
export function androidBlurSetting(
  targetSigma: number,
  cardWidth: number,
  sourceWidth: number,
  density: number,
): AndroidBlurSetting {
  const kNatural = Math.max(1, Math.round(cardWidth / sourceWidth));
  const sigmaBitmapMax = sigmaRenderScript(ANDROID_MAX_RADIUS);

  // La sous-échelle minimale qui garde le rayon sous le plafond.
  const kMin = Math.ceil((targetSigma * density) / sigmaBitmapMax);
  const k = Math.max(kNatural, kMin, 1);

  const sigmaBitmap = (targetSigma * density) / k;
  const stdDeviation = Math.max(0, (sigmaBitmap - 0.6) / 0.8);
  return { k, stdDeviation };
}

/** Le σ qu'Android rendra VRAIMENT à l'écran, en pixels — pour les bancs. */
export const androidScreenSigma = (stdDeviation: number, k: number): number =>
  sigmaRenderScript(Math.min(2 * stdDeviation, ANDROID_MAX_RADIUS)) * k;
