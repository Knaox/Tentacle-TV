import { getContentPolicy } from "./contentPolicy";

/**
 * Les titres EXTÉRIEURS (TMDB : recommandations hors bibliothèque, saga, « À
 * demander », Vigie) face à la politique de contenu d'un compte
 * (docs/DROITS-UTILISATEURS.md § 5).
 *
 * - Compte NON restreint : chemin court, aucune requête TMDB, la liste rendue telle quelle.
 * - Compte restreint (ou politique illisible) : un titre ne passe que si sa
 *   certification TMDB, ramenée sur l'échelle de Jellyfin, tient sous sa note
 *   maximale. Sans certification exploitable, ou `adult` : caché.
 *
 * ⚠️ PROVISOIRE (étape A du lot) : la correspondance des certifications n'est pas
 * encore branchée — un compte restreint ne reçoit AUCUN titre extérieur (fermé
 * à l'échec). Les signatures, elles, sont définitives.
 */

export type ExternalMediaType = "movie" | "tv";

export interface ExternalTitleRef {
  mediaType: ExternalMediaType;
  tmdbId: number;
}

/** Les titres que ce compte peut voir, dans l'ordre reçu ; chaque objet rendu est celui reçu. */
export async function filterExternalTitles<T extends ExternalTitleRef>(userId: string, titles: readonly T[]): Promise<T[]> {
  if (titles.length === 0) return [];
  const policy = await getContentPolicy(userId);
  if (!policy.restricted) return [...titles];
  return [];
}

/** UN titre extérieur : visible par ce compte ? */
export async function allowsExternalTitle(userId: string, title: ExternalTitleRef): Promise<boolean> {
  return (await filterExternalTitles(userId, [title])).length === 1;
}
