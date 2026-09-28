import type { ViewingStatsTitle } from "./contract";

/**
 * Le classement « film préféré » — des critères dits en clair, dans l'ordre
 * où ils pèsent, que la page rappelle :
 *  1. votre note (10/10 : +10 … 5/10 : 0 … 1/10 : −8) ;
 *  2. coup de cœur (+6), « J'aime » (+3), « Pas pour moi » (−6) ;
 *  3. favori (+4) ;
 *  4. revisionnages : +2 par visionnage au-delà du premier, jusqu'à +6.
 * À score égal, le temps passé départage, puis la dernière lecture.
 *
 * Ma liste n'y entre pas : garder un film pour plus tard ne dit rien de ce
 * qu'on en a pensé.
 */

type Judged = Pick<ViewingStatsTitle, "rating" | "verdict" | "favorite" | "viewings">;

const VERDICT_POINTS = { superlike: 6, like: 3, dislike: -6 } as const;
const FAVORITE_POINTS = 4;
const REWATCH_POINTS = 2;
const REWATCH_MAX = 3;

export function preferenceScore(t: Judged): number {
  const rating = t.rating === null ? 0 : (t.rating - 5) * 2;
  const verdict = t.verdict ? VERDICT_POINTS[t.verdict] : 0;
  const favorite = t.favorite ? FAVORITE_POINTS : 0;
  const rewatch = Math.min(Math.max(0, t.viewings - 1), REWATCH_MAX) * REWATCH_POINTS;
  return rating + verdict + favorite + rewatch;
}

/** Du préféré au moins aimé. */
export function byPreference(a: ViewingStatsTitle, b: ViewingStatsTitle): number {
  return (
    preferenceScore(b) - preferenceScore(a) ||
    b.seconds - a.seconds ||
    (b.lastPlayedAt ?? "").localeCompare(a.lastPlayedAt ?? "")
  );
}
