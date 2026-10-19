import type { CatalogFilters } from "@tentacle-tv/api-client";
import type { GroupQuery, LibraryGroup } from "@tentacle-tv/tv-core";
import type { LibraryFilterState } from "../../hooks/libraryCatalogParams";
import { gridCatalogParams } from "../library/gridCatalogParams";

/**
 * Les requêtes des RANGÉES d'une bibliothèque (tv-core `groups/libraryGroups.ts`)
 * — la seule fabrique de leurs paramètres : celles des comptes et celles des
 * rangées partagent la même base, les filtres posés, avec les champs minimaux
 * de la grille (`gridCatalogParams`).
 */

/** Une page d'une rangée : de quoi remplir l'écran et la suite proche. */
export const GROUP_ROW_PAGE = 24;

/** Le tri d'un palier de note : la note d'abord, le titre pour départager — stable d'une page à l'autre. */
const RATING_SORT = "CommunityRating,SortName";

export function groupBaseParams(filters: LibraryFilterState): CatalogFilters {
  return gridCatalogParams(filters);
}

/** La base, réduite au groupe : son genre, ses années, ses lettres, sa note minimale. */
export function groupQueryParams(base: CatalogFilters, query: GroupQuery): CatalogFilters {
  return {
    ...base,
    ...(query.genreIds ? { genreIds: query.genreIds } : {}),
    ...(query.years ? { years: query.years.map(String) } : {}),
    ...(query.nameFrom ? { nameStartsWithOrGreater: query.nameFrom } : {}),
    ...(query.nameBefore ? { nameLessThan: query.nameBefore } : {}),
    ...(query.minRating !== undefined ? { minCommunityRating: query.minRating } : {}),
  };
}

/** Une rangée : sa requête, page par page ; un palier de note, sa tranche de la liste triée par note. */
export function groupRowParams(base: CatalogFilters, group: LibraryGroup): CatalogFilters {
  const params = { ...groupQueryParams(base, group.query), limit: GROUP_ROW_PAGE };
  return group.slice
    ? { ...params, sortBy: RATING_SORT, sortOrder: "Descending", offset: group.slice.offset, maxItems: group.slice.limit }
    : params;
}
