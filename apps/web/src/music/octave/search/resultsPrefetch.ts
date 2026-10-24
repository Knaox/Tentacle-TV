/**
 * Octave — QUAND annoncer les premiers résultats d'une extension pour qu'elle
 * les prépare (`prefetch("results")`, une préparation coûte des requêtes
 * YouTube côté extension). La recherche, elle, reste immédiate ; seule
 * l'anticipation attend :
 * - une page NON provisoire (contrat v2 : un classement provisoire va changer) ;
 * - une requête STABLE depuis 700 ms (la stabilisation de l'extension) : une
 *   pause dans la frappe ne prépare pas les résultats d'un mot inachevé ;
 * - une seule fois par requête.
 */

export const RESULTS_STABLE_MS = 700;
export const RESULTS_PREFETCHED = 3;

export interface ResultsAnnounceInput {
  /** La requête affichée. */
  query: string;
  /** La requête une fois restée identique `RESULTS_STABLE_MS`. */
  stableQuery: string;
  provisional: boolean;
  /** Les identifiants externes des titres, dans l'ordre affiché. */
  ids: readonly string[];
  /** La dernière requête déjà annoncée. */
  announced: string | null;
}

/** Les identifiants à annoncer maintenant, sinon `null`. */
export function resultsToAnnounce(input: ResultsAnnounceInput): string[] | null {
  const q = input.query.trim();
  if (!q || input.provisional || input.stableQuery.trim() !== q || input.announced === q) return null;
  const ids = input.ids.slice(0, RESULTS_PREFETCHED);
  return ids.length > 0 ? ids : null;
}
