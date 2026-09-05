import type { FacetEntry } from "./facets";

// Poids de base des signaux (cf. spécification du moteur). Un signal positif
// tire les facettes du titre vers le profil, un négatif les en éloigne.
export const SIGNAL_FAVORITE = 0.7;
export const SIGNAL_WATCHLISTED = 0.3;
export const SIGNAL_COMPLETED = 0.5;
export const SIGNAL_REWATCH = 0.9;
export const SIGNAL_ABANDON = -0.6;
export const SIGNAL_SERIES_FOLLOWED = 0.6;

/** Une série est « suivie » à partir de trois épisodes vus. */
export const SERIES_FOLLOWED_MIN_EPISODES = 3;
/** Nombre d'épisodes vus à partir duquel l'engagement est plein. */
export const SERIES_ENGAGEMENT_FULL_EPISODES = 40;
/** Poids plafond d'une série suivie — au niveau d'un revisionnage. */
export const SERIES_ENGAGEMENT_MAX = 1.0;

/**
 * Poids d'une série suivie selon les épisodes VUS : 0 sous trois épisodes,
 * SIGNAL_SERIES_FOLLOWED (0,6) à trois, croissance logarithmique jusqu'à
 * SERIES_ENGAGEMENT_MAX vers quarante (bornée). Un poids plat comptait
 * 86 épisodes de Fire Force comme trois épisodes essayés — l'engagement
 * réel disparaissait du profil.
 */
export function seriesEngagementWeight(playedEpisodes: number): number {
  if (!(playedEpisodes >= SERIES_FOLLOWED_MIN_EPISODES)) return 0;
  const t =
    Math.log(playedEpisodes / SERIES_FOLLOWED_MIN_EPISODES) /
    Math.log(SERIES_ENGAGEMENT_FULL_EPISODES / SERIES_FOLLOWED_MIN_EPISODES);
  const clamped = Math.min(1, Math.max(0, t));
  return SIGNAL_SERIES_FOLLOWED + (SERIES_ENGAGEMENT_MAX - SIGNAL_SERIES_FOLLOWED) * clamped;
}

/** Demi-vie de la décroissance temporelle : un signal de 6 mois pèse moitié. */
export const HALF_LIFE_DAYS = 180;

/** Point neutre de l'échelle : 6,5 = « j'aime bien, sans plus ». Au-dessus,
 *  la note tire le profil vers le titre ; en dessous, elle l'en éloigne. Le
 *  MÊME pour tout le monde : un 7 veut dire « j'ai aimé » chez tous les
 *  noteurs — c'est d'ailleurs ce que la sync publie chez TMDB. Sert aussi de
 *  moyenne par défaut quand les notes sont trop peu nombreuses. */
export const NEUTRAL_SCORE = 6.5;
/** Unité de l'échelle : deux points de note valent un poids de 1 — un 8 vaut
 *  un favori (0,75 ≈ 0,7), un 10 en vaut deux et demi, un 4 vaut deux
 *  abandons. L'écart-type personnel ne s'applique qu'au-delà : un noteur qui
 *  étale ses notes sur toute l'échelle a des points qui pèsent moins. */
const SCALE_UNIT = 2;
const MIN_RATINGS_FOR_STATS = 3;

export function decayFactor(ageDays: number): number {
  if (ageDays <= 0) return 1;
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

export function ageInDays(date: Date | string, now = Date.now()): number {
  const t = typeof date === "string" ? Date.parse(date) : date.getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (now - t) / 86_400_000);
}

/**
 * Moyenne et écart-type des notes de l'utilisateur. La moyenne est
 * INFORMATIVE (profil stocké, endpoint de debug) : seul l'écart-type entre
 * dans le poids. Sous trois notes, les statistiques seraient du bruit :
 * moyenne au point neutre, écart nul (l'unité d'échelle prend le relais).
 */
export function ratingStats(scores: number[]): { mean: number; stdDev: number } {
  if (scores.length < MIN_RATINGS_FOR_STATS) return { mean: NEUTRAL_SCORE, stdDev: 0 };
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

/**
 * Poids d'une note explicite, sur l'échelle ABSOLUE des étoiles : la distance
 * au point neutre (6,5), en unités d'échelle. L'ancienne normalisation sur la
 * moyenne PERSONNELLE faisait d'un 7 un reproche chez qui note généreusement
 * (moyenne 7,9 : 7 → −0,17, 6 → −0,37) et annulait la grille de démarrage à
 * froid — cinq titres aimés à 8 font une moyenne de 8, donc cinq poids nuls
 * et aucune graine. Les notes médianes (5..7) pèsent peu (× 0,2) ; les
 * extrêmes pèsent plein.
 */
export function ratingSignalWeight(score: number, stdDev: number): number {
  const z = (score - NEUTRAL_SCORE) / Math.max(stdDev, SCALE_UNIT);
  const k = score >= 8 || score <= 4 ? 1 : 0.2;
  return k * z;
}

/** Un signal prêt à l'accumulation : poids, âge, facettes du titre. */
export interface WeightedSignal {
  weight: number;
  ageDays: number;
  facets: FacetEntry[];
  /** Signal de CONSOMMATION (vu, suivi, noté) — ni favori ni Ma liste. */
  consumption?: boolean;
  /** Volume de visionnage en équivalents-film (défaut 1) : une série suivie
   *  vaut ses épisodes / EPISODES_PER_MOVIE. La part d'univers se mesure là. */
  volume?: number;
}

/** Quatre épisodes valent un film en temps de visionnage (approximation :
 *  un épisode d'animé dure 24 min, un épisode de série 45 — on ne pèse pas
 *  la durée, Jellyfin ne l'expose pas fiablement sur une fiche Series). */
export const EPISODES_PER_MOVIE = 4;

/**
 * Accumule les signaux en vecteur de facettes :
 * contribution = poids_signal × mult_facette × décroissance(âge) × idf(facette).
 * L'IDF est le garde-fou central — sans lui, « Drame » écrase tout.
 */
export function buildFacetVector(
  signals: WeightedSignal[],
  idfFor: (key: string) => number
): Record<string, number> {
  const vector: Record<string, number> = {};
  for (const signal of signals) {
    if (signal.weight === 0) continue;
    const decayed = signal.weight * decayFactor(signal.ageDays);
    for (const facet of signal.facets) {
      const delta = decayed * facet.mult * idfFor(facet.key);
      vector[facet.key] = (vector[facet.key] ?? 0) + delta;
    }
  }
  return vector;
}

/**
 * Part d'un univers dans une liste de signaux, en TEMPS DE VISIONNAGE :
 * Σ volume décroissé des signaux qui portent la facette / Σ volume décroissé
 * de tous (0..1, 0 sans signal). Le poids de goût n'entre pas : quatre-vingts
 * épisodes d'une série valent vingt films, pas un demi — mesuré sur un vrai
 * compte, la part au poids donnait 0,065 pour un tiers du visionnage.
 */
export function universeShare(signals: readonly WeightedSignal[], universeKey: string): number {
  let total = 0;
  let inUniverse = 0;
  for (const signal of signals) {
    const v = (signal.volume ?? 1) * decayFactor(signal.ageDays);
    if (v <= 0) continue;
    total += v;
    if (signal.facets.some((f) => f.key === universeKey)) inUniverse += v;
  }
  return total > 0 ? inUniverse / total : 0;
}

/** Tronque le vecteur aux `max` facettes les plus marquées (|poids| décroissant). */
export function truncateVector(vector: Record<string, number>, max: number): Record<string, number> {
  const entries = Object.entries(vector);
  if (entries.length <= max) return vector;
  entries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  return Object.fromEntries(entries.slice(0, max));
}
