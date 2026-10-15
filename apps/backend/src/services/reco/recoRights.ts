/**
 * Les droits du compte appliqués à ce qu'une page de recommandations SERT
 * (docs/DROITS-UTILISATEURS.md § 5) — au service, pas seulement au calcul :
 * l'instantané et le pool peuvent dater d'avant un changement de politique,
 * ce qu'ils montrent ne la trahit jamais.
 *
 * - titre de la bibliothèque : montré s'il est visible au compte ;
 * - titre extérieur : jamais s'il est dans la bibliothèque mais caché au
 *   compte (`libraryRights.ts`) ;
 * - droits illisibles (catalogue ou relevé du compte absents) : les titres de
 *   la bibliothèque restent (calculés au nom du compte), les extérieurs
 *   partent — fermé à l'échec (§ 1).
 */

import { libraryRightsFor, type LibraryRights } from "../search/libraryRights";

export interface RightsItem {
  mediaType: "movie" | "tv";
  tmdbId: number;
  jellyfinItemId?: string | null;
}

/** Le verdict pur, pour un titre. */
export function allowedByRights(rights: LibraryRights | null, item: RightsItem): boolean {
  if (item.jellyfinItemId) return rights === null || rights.seesItem(item.jellyfinItemId);
  return rights !== null && !rights.hidesTitle(item.mediaType, item.tmdbId);
}

/** Le filtre du compte, prêt à s'appliquer à une liste. */
export async function rightsFilterFor(userId: string): Promise<(item: RightsItem) => boolean> {
  const rights = await libraryRightsFor(userId);
  return (item) => allowedByRights(rights, item);
}
