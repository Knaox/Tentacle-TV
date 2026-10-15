/**
 * Les droits du compte appliqués à ce qu'une page de recommandations SERT
 * (docs/DROITS-UTILISATEURS.md § 5) — au service, pas seulement au calcul :
 * l'instantané et le pool peuvent dater d'avant un changement de politique,
 * ce qu'ils montrent ne la trahit jamais.
 *
 * - titre de la bibliothèque : montré s'il est visible au compte ;
 * - titre extérieur : jamais s'il est dans la bibliothèque mais caché au
 *   compte (`libraryRights.ts`) ; sinon seulement si la politique de contenu
 *   du compte le laisse passer (`filterExternalTitles` du socle : certification
 *   TMDB, `adult` ; chemin court pour un compte non restreint) ;
 * - droits illisibles (catalogue ou relevé du compte absents) : les titres de
 *   la bibliothèque restent (calculés au nom du compte), les extérieurs
 *   partent — fermé à l'échec (§ 1).
 */

import { filterExternalTitles } from "../contentPolicy";
import { libraryRightsFor, type LibraryRights } from "../search/libraryRights";

export interface RightsItem {
  mediaType: "movie" | "tv";
  tmdbId: number;
  jellyfinItemId?: string | null;
}

/** Le verdict de la BIBLIOTHÈQUE, pour un titre (pur) — la politique des extérieurs vient après. */
export function allowedByRights(rights: LibraryRights | null, item: RightsItem): boolean {
  if (item.jellyfinItemId) return rights === null || rights.seesItem(item.jellyfinItemId);
  return rights !== null && !rights.hidesTitle(item.mediaType, item.tmdbId);
}

const keyOf = (item: RightsItem) => `${item.mediaType}:${item.tmdbId}`;

/**
 * Le filtre du compte pour CES titres : une seule question à la politique de
 * contenu pour tous les extérieurs de la liste (dédoublonnés), puis un verdict
 * synchrone par titre — à appliquer à cette liste, ou à une partie.
 */
export async function rightsFilterFor(userId: string, items: Iterable<RightsItem>): Promise<(item: RightsItem) => boolean> {
  const rights = await libraryRightsFor(userId);
  const candidates = new Map<string, RightsItem>();
  for (const item of items) {
    if (!item.jellyfinItemId && allowedByRights(rights, item)) {
      candidates.set(keyOf(item), { mediaType: item.mediaType, tmdbId: item.tmdbId });
    }
  }
  const passed = new Set((await filterExternalTitles(userId, [...candidates.values()])).map(keyOf));
  return (item) => (item.jellyfinItemId ? allowedByRights(rights, item) : passed.has(keyOf(item)));
}

/** La liste, dans son ordre, réduite à ce que le compte peut voir. */
export async function filterByRights<T extends RightsItem>(userId: string, items: readonly T[]): Promise<T[]> {
  const allowed = await rightsFilterFor(userId, items);
  return items.filter(allowed);
}
