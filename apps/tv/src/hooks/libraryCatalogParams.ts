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
const memoire = new Map<string, LibraryFilterState>();

/** Les filtres retenus pour cette bibliothèque, ou les défauts. */
export function filtresMemorises(libraryId: string): LibraryFilterState {
  return memoire.get(libraryId) ?? DEFAULT_FILTERS;
}

export function memoriserFiltres(libraryId: string, filtres: LibraryFilterState): void {
  memoire.set(libraryId, filtres);
}

/** L'API Jellyfin n'accepte pas une plage : chaque année est ÉNUMÉRÉE
 *  (repli 1900 / année courante sur la borne ouverte), comme le web. */
export function anneesEnumerees(filtres: LibraryFilterState): string[] | undefined {
  if (filtres.yearFrom == null && filtres.yearTo == null) return undefined;
  const de = filtres.yearFrom ?? 1900;
  const a = filtres.yearTo ?? new Date().getFullYear();
  const annees: string[] = [];
  for (let y = de; y <= a; y++) annees.push(String(y));
  return annees;
}

/** Le filtre plateforme n'existe pas côté serveur : il se pose après coup, sur
 *  une base plus large. C'est la seule chose qui change la LIMITE demandée. */
export function filtrePlateformeActif(filtres: LibraryFilterState): boolean {
  return filtres.platformIds.length > 0;
}

/**
 * Les paramètres du catalogue pour cet état de filtres — la seule fonction qui
 * ait le droit de les fabriquer.
 *
 * `fields: "light"` : payload minimum pour la grille. Plateformes actives →
 * limite montée à 500, la base du post-filtre client (parité web).
 */
export function catalogueParams(filtres: LibraryFilterState): CatalogFilters {
  return {
    sortBy: filtres.sortBy,
    sortOrder: filtres.sortOrder,
    genreIds: filtres.genreIds.length > 0 ? filtres.genreIds : undefined,
    years: anneesEnumerees(filtres),
    statusFilter: filtres.statusFilter ?? undefined,
    minCommunityRating: filtres.ratingMin ?? undefined,
    isFavorite: filtres.isFavorite || undefined,
    limit: filtrePlateformeActif(filtres) ? 500 : 30,
    fields: "light",
  };
}
