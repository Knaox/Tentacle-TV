import { useQueries } from "@tanstack/react-query";
import { catalogFilterParams, catalogItemTypes, type CatalogFilters } from "./useLibraryCatalog";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";

/**
 * Les NOMBRES de titres de plusieurs requêtes de catalogue, sans leurs titres
 * — les rangées d'une bibliothèque des téléviseurs (tv-core `groups/`) : un
 * compte par genre, décennie, tranche de lettres ou palier de note, pour
 * savoir AVANT le premier dessin quelles rangées existent et dans quel ordre.
 *
 * Une requête par entrée, d'un seul titre et sans image, ni données
 * utilisateur, ni champ : quelques centaines d'octets. `undefined` tant
 * qu'un compte n'est pas là ; une entrée en échec vaut aussi `undefined`
 * (`failed` le dit).
 */

const COUNT_STALE_TIME = 10 * 60 * 1000;

export function getLibraryCountKey(libraryId: string, filters: CatalogFilters): unknown[] {
  return ["library", "count", libraryId, catalogItemTypes(filters), catalogFilterParams(filters)];
}

export function useLibraryCatalogCounts(libraryId: string | undefined, list: readonly CatalogFilters[]) {
  const client = useJellyfinClient();
  const userId = useUserId();
  const results = useQueries({
    queries: list.map((filters) => ({
      queryKey: getLibraryCountKey(libraryId ?? "", filters),
      queryFn: () =>
        client
          .fetch<{ TotalRecordCount: number }>(
            `/Users/${userId}/Items?ParentId=${libraryId}&IncludeItemTypes=${catalogItemTypes(filters)}&Recursive=true` +
              `&ExcludeLocationTypes=Virtual&IsMissing=false&Limit=1&EnableTotalRecordCount=true` +
              `&EnableImages=false&EnableUserData=false&Fields=` + catalogFilterParams(filters),
          )
          .then((res) => res.TotalRecordCount),
      enabled: !!userId && !!libraryId && filters.enabled !== false,
      staleTime: COUNT_STALE_TIME,
    })),
  });
  return {
    counts: results.map((result) => (typeof result.data === "number" ? result.data : undefined)),
    failed: results.some((result) => result.isError),
    retry: () => {
      for (const result of results) if (result.isError) void result.refetch();
    },
  };
}
