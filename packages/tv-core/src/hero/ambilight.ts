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
export interface CoucheHalo {
  d: number;
  opacity: number;
}

export interface RampeHalo {
  /** Écart-type de l'extinction, en points d'écran. */
  sigma: number;
  /** Débordement total : la dilatation de la couche la plus externe. */
  bleed: number;
  /** De la plus interne à la plus externe. */
  couches: readonly CoucheHalo[];
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
  let bas = -10;
  let haut = 10;
  for (let i = 0; i < 50; i += 1) {
    const mid = (bas + haut) / 2;
    if (phi(mid) < p) bas = mid;
    else haut = mid;
  }
  return (bas + haut) / 2;
}

/** L'extinction visée : le flou gaussien floute aussi l'ALPHA, donc à la
 *  distance `d` hors d'une arête il reste `Φ(−d/σ)` — la moitié sur l'arête
 *  elle-même, et non un. C'est la courbe que la rampe discrétise. */
export const profilHalo = (d: number, sigma: number): number => phi(-d / sigma);

/** σ en points d'écran : le rapport de la référence appliqué à la carte réelle
 *  (48 / 1524 sur le web ; ici la largeur mesurée). */
export const sigmaHalo = (largeurCarte: number, rapportFlou: number): number =>
  rapportFlou * largeurCarte;

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
export function rampeHalo(
  largeurCarte: number,
  { rapportFlou, couches: n, plancher }: { rapportFlou: number; couches: number; plancher: number },
): RampeHalo {
  const sigma = sigmaHalo(largeurCarte, rapportFlou);
  const pas = (0.5 - plancher) / n;

  // Frontières : d_j tel que Φ(−d_j/σ) = 0,5 − j·pas. d_0 vaut 0.
  const d: number[] = [];
  for (let j = 0; j <= n; j += 1) d.push(sigma * probit(1 - (0.5 - j * pas)));

  // Composites visés, puis les alphas qui les produisent, de l'extérieur vers
  // l'intérieur (chaque couche ne « voit » que ce que les suivantes ont posé).
  const couches: CoucheHalo[] = [];
  let compositeSuivant = 0;
  for (let k = n; k >= 1; k -= 1) {
    const composite = 0.5 - (k - 0.5) * pas;
    couches.unshift({
      d: d[k],
      opacity: 1 - (1 - composite) / (1 - compositeSuivant),
    });
    compositeSuivant = composite;
  }

  return { sigma, bleed: d[n], couches };
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
export function sigmaEffectif(
  rayon: number,
  plateforme: "ios" | "android",
  pixelRatio: number,
): number {
  if (plateforme === "ios") {
    let w = Math.floor((rayon * pixelRatio * 3 * Math.sqrt(2 * Math.PI)) / 4 / 2 + 0.25);
    w |= 1;
    return Math.sqrt(Math.max(0, w * w - 1)) / 2;
  }
  const r = Math.trunc(Math.trunc(rayon * pixelRatio) / 2);
  if (r === 0) return 0;
  const largeur = 2 * r + 1;
  return Math.sqrt((largeur * largeur - 1) / 6);
}

/** Le `blurRadius` à poser pour obtenir `sigmaCible` pixels de bitmap.
 *  L'inversion analytique existe mais bute sur le `floor` et le `| 1` ; un
 *  balayage au quart de point retombe sur l'optimum exact, une fois au montage. */
export function rayonFlou(
  sigmaCible: number,
  plateforme: "ios" | "android",
  pixelRatio: number,
): number {
  let meilleur = 0;
  let ecart = Number.POSITIVE_INFINITY;
  for (let r = 0.25; r <= 120; r += 0.25) {
    const e = Math.abs(sigmaEffectif(r, plateforme, pixelRatio) - sigmaCible);
    if (e < ecart) {
      ecart = e;
      meilleur = r;
    }
  }
  return meilleur;
}

/** σ visé dans le bitmap : le σ d'écran ramené à l'échelle de la source, telle
 *  qu'elle est grossie pour remplir la boîte de débordement. */
export const sigmaSource = (sigma: number, largeurBoite: number, largeurSource: number): number =>
  (sigma * largeurSource) / largeurBoite;

/** Sous-échelle de rendu. L'assemblage est rendu à 1/K puis remis à l'échelle :
 *  le cache rastérisé coûte K² fois moins, et sa magnification bilinéaire
 *  transforme chaque marche d'alpha en rampe de K points — c'est elle, plus que
 *  le nombre de couches, qui efface l'escalier. Plafonné par le plus petit
 *  écart entre deux couches : en dessous, les couches internes fusionnent en
 *  sous-pixel et rouvrent une grosse marche contre la carte. */
export function sousEchelle(couches: readonly CoucheHalo[]): number {
  let mini = Number.POSITIVE_INFINITY;
  let precedent = 0;
  for (const { d } of couches) {
    mini = Math.min(mini, d - precedent);
    precedent = d;
  }
  return Math.max(1, Math.floor(mini));
}
