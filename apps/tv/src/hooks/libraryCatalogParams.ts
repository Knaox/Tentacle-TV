import type { CatalogFilters } from "@tentacle-tv/api-client";

/**
 * Ce qu'on demande au serveur pour une bibliothèque — le MODÈLE, sans React.
 *
 * Ce fichier existe pour une raison précise, et elle a coûté un temps mort à
 * chaque entrée dans une bibliothèque : le rail préchargeait le catalogue avec
 * un tri écrit en dur (`DateCreated` / `Descending`) pendant que l'écran
 * l'interrogeait avec le tri par défaut (`SortName` / `Ascending`). Le tri
 * occupe les positions 3 et 4 de la clé de cache (`getLibraryCatalogKey`) : les
 * deux clés ne se rencontraient JAMAIS. Le préchargement ne servait donc rien,
 * et sa requête disputait la bande passante à celle dont l'écran dépendait.
 *
 * La correction n'est pas de recopier le bon tri des deux côtés — c'est ce qui
 * dérive à la première évolution. C'est de n'avoir qu'un seul endroit qui
 * fabrique ces paramètres, et de faire lire les deux appelants au même endroit.
 * L'état des filtres, sa mémoire de session et l'énumération des années y vivent
 * pour la même raison : le rail doit pouvoir les consulter sans monter l'écran.
 */

export interface LibraryFilterState {
  genreIds: string[];
  platformIds: number[];
  yearFrom: number | null;
  yearTo: number | null;
  ratingMin: number | null;
  statusFilter: string | null;
  isFavorite: boolean;
  sortBy: string;
  sortOrder: string;
}

export const DEFAULT_FILTERS: LibraryFilterState = {
  genreIds: [],
  platformIds: [],
  yearFrom: null,
  yearTo: null,
  ratingMin: null,
  statusFilter: null,
  isFavorite: false,
  sortBy: "SortName",
  sortOrder: "Ascending",
};

/** La mémoire de session, PAR bibliothèque — parité `filtersMemory` webOS :
 *  une Map en mémoire JS, jamais persistée. Revenir sur une bibliothèque
 *  retrouve ses filtres, redémarrer l'app les oublie (voulu). */
const memory = new Map<string, LibraryFilterState>();

/** Les filtres retenus pour cette bibliothèque, ou les défauts. */
export function rememberedFilters(libraryId: string): LibraryFilterState {
  return memory.get(libraryId) ?? DEFAULT_FILTERS;
}

export function rememberFilters(libraryId: string, filters: LibraryFilterState): void {
  memory.set(libraryId, filters);
}

/** L'API Jellyfin n'accepte pas une plage : chaque année est ÉNUMÉRÉE
 *  (repli 1900 / année courante sur la borne ouverte), comme le web. */
export function enumeratedYears(filters: LibraryFilterState): string[] | undefined {
  if (filters.yearFrom == null && filters.yearTo == null) return undefined;
  const from = filters.yearFrom ?? 1900;
  const to = filters.yearTo ?? new Date().getFullYear();
  const years: string[] = [];
  for (let y = from; y <= to; y++) years.push(String(y));
  return years;
}

/** Le filtre plateforme n'existe pas côté serveur : il se pose après coup, sur
 *  une base plus large. C'est la seule chose qui change la LIMITE demandée. */
export function hasPlatformFilter(filters: LibraryFilterState): boolean {
  return filters.platformIds.length > 0;
}

/**
 * Les paramètres du catalogue pour cet état de filtres — la seule fonction qui
 * ait le droit de les fabriquer.
 *
 * `fields: "light"` : payload minimum pour la grille. Plateformes actives →
 * limite montée à 500, la base du post-filtre client (parité web).
 */
export function catalogParams(filters: LibraryFilterState): CatalogFilters {
  return {
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    genreIds: filters.genreIds.length > 0 ? filters.genreIds : undefined,
    years: enumeratedYears(filters),
    statusFilter: filters.statusFilter ?? undefined,
    minCommunityRating: filters.ratingMin ?? undefined,
    isFavorite: filters.isFavorite || undefined,
    limit: hasPlatformFilter(filters) ? 500 : 30,
    fields: "light",
  };
}
