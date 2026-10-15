import { metaKey } from "../tmdb/metaCache";
import { getContentPolicy } from "./contentPolicy";
import { restrictedAllows, scheduleAllows } from "./externalTitleRule";
import { getRatingContext } from "./ratingContext";
import { getTitleCertifications } from "./titleCertifications";

/**
 * Les titres EXTÉRIEURS (TMDB : recommandations hors bibliothèque, saga, « À
 * demander », Vigie) face à la politique de contenu d'un compte
 * (docs/DROITS-UTILISATEURS.md § 5).
 *
 * - Compte NON restreint : chemin court, aucune requête TMDB, la liste rendue telle quelle.
 * - Compte restreint : un titre ne passe que si sa certification TMDB, ramenée sur
 *   l'échelle de Jellyfin, tient sous sa note maximale (`externalTitleRule.ts`).
 *   Sans certification exploitable, `adult`, ou toute panne : caché.
 */

export type ExternalMediaType = "movie" | "tv";

export interface ExternalTitleRef {
  mediaType: ExternalMediaType;
  tmdbId: number;
}

/** Titres lus chez TMDB au plus par appel ; le reste est caché cette fois-ci, et lu en fond. */
export const EXTERNAL_FETCH_BUDGET = 24;

/** Les titres que ce compte peut voir, dans l'ordre reçu ; chaque objet rendu est celui reçu. */
export async function filterExternalTitles<T extends ExternalTitleRef>(userId: string, titles: readonly T[]): Promise<T[]> {
  if (titles.length === 0) return [];
  try {
    const policy = await getContentPolicy(userId);
    if (!policy.restricted) return [...titles];
    const now = new Date();
    if (!policy.readable || !scheduleAllows(policy, now)) return [];
    const [context, certifications] = await Promise.all([
      getRatingContext(),
      getTitleCertifications(titles, { budget: EXTERNAL_FETCH_BUDGET }),
    ]);
    return titles.filter((title) =>
      restrictedAllows(certifications.get(metaKey(title.mediaType, title.tmdbId)) ?? null, policy, context, now),
    );
  } catch {
    // Fermé à l'échec : une panne ne laisse rien passer.
    return [];
  }
}

/** UN titre extérieur : visible par ce compte ? */
export async function allowsExternalTitle(userId: string, title: ExternalTitleRef): Promise<boolean> {
  return (await filterExternalTitles(userId, [title])).length === 1;
}
