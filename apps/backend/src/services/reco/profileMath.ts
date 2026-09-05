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

/** Écart-type plancher : en dessous, la division amplifierait le bruit. */
const STD_DEV_FLOOR = 1;

/** Moyenne par défaut tant que l'utilisateur a trop peu de notes. */
const DEFAULT_MEAN = 6.5;
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
 * Moyenne et écart-type des notes de l'utilisateur. Sous trois notes, les
 * statistiques personnelles seraient du bruit : moyenne par défaut, écart nul
 * (le plancher prend le relais au moment de normaliser).
 */
export function ratingStats(scores: number[]): { mean: number; stdDev: number } {
  if (scores.length < MIN_RATINGS_FOR_STATS) return { mean: DEFAULT_MEAN, stdDev: 0 };
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

/**
 * Poids d'une note explicite, NORMALISÉE sur l'échelle personnelle : certains
 * notent tout entre 8 et 10, d'autres entre 4 et 7 — seule la position par
 * rapport à SA moyenne informe, divisée par SON écart-type (plancher inclus).
 * Les notes médianes (5..7) pèsent peu (±0,2) ; les extrêmes pèsent plein.
 */
export function ratingSignalWeight(score: number, mean: number, stdDev: number): number {
  const z = (score - mean) / Math.max(stdDev, STD_DEV_FLOOR);
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
