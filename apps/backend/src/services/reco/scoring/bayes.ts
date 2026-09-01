/** Seuil de votes : en dessous, la moyenne du corpus tire la note vers elle. */
export const BAYES_M = 500;

/** Moyenne globale du corpus TMDB (~6,5 constaté). */
export const BAYES_C = 6.5;

/**
 * Moyenne bayésienne pondérée : WR = (v/(v+m))·R + (m/(v+m))·C. Un titre noté
 * 10/10 par 4 personnes ne remonte pas — il pèse ~C tant que v ≪ m.
 */
export function bayesianRating(voteAverage: number | null, voteCount: number | null): number {
  const R = voteAverage ?? BAYES_C;
  const v = Math.max(0, voteCount ?? 0);
  return (v / (v + BAYES_M)) * R + (BAYES_M / (v + BAYES_M)) * BAYES_C;
}

/** La même, ramenée 0..1 pour la combinaison linéaire du score final. */
export function qualityScore01(voteAverage: number | null, voteCount: number | null): number {
  return bayesianRating(voteAverage, voteCount) / 10;
}

/** Popularité TMDB au-delà de laquelle la pénalité s'applique. */
export const POPULARITY_PIVOT = 50;
const POPULARITY_K = 0.08;
const POPULARITY_CAP = 0.3;

/**
 * Pénalité LOGARITHMIQUE de popularité : sans elle, tout le monde reçoit les
 * mêmes blockbusters. Nulle sous le pivot, plafonnée au-delà.
 */
export function popularityPenalty(popularity: number | null): number {
  const p = popularity ?? 0;
  if (p <= POPULARITY_PIVOT) return 0;
  return Math.min(POPULARITY_CAP, POPULARITY_K * Math.log(p / POPULARITY_PIVOT));
}

/** Bonus de récence : 1 la première année, linéaire vers 0 à trois ans. */
export function freshnessScore(year: number | null, nowYear: number): number {
  if (year == null) return 0;
  const age = nowYear - year;
  if (age <= 0) return 1;
  if (age >= 3) return 0;
  return 1 - age / 3;
}
