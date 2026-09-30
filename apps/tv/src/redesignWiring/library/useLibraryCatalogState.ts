import { useCallback, useMemo } from "react";
import { useLibraryCatalog, type CatalogFilters } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { hasPlatformFilter, type LibraryFilterState } from "../../hooks/libraryCatalogParams";
import { usePlatformFilter } from "../../hooks/usePlatformFilter";

export interface LibraryCatalogState {
  /** Ce que la grille montre : les pages mises bout à bout, plateformes filtrées. */
  items: MediaItem[];
  /** Tout ce qui est chargé, avant le filtre des plateformes (années connues). */
  loaded: MediaItem[];
  /** Le nombre de titres des filtres courants ; absent tant qu'on ne le sait pas. */
  total: number | undefined;
  /** Premier chargement : rien à montrer encore. */
  loading: boolean;
  /** La page suivante est en route. */
  loadingMore: boolean;
  /** Échec SANS rien à montrer : l'écran le dit, au lieu d'une grille vide. */
  failed: boolean;
  loadMore: () => void;
  retry: () => void;
}

/**
 * Le catalogue d'une bibliothèque tel que la grille le montre — les mêmes
 * requêtes que l'écran d'Android TV (`useLibraryCatalog` sur `catalogParams`,
 * post-filtre `usePlatformFilter`), et ce qu'il n'avait pas : l'erreur, que
 * l'ancienne grille affichait comme une bibliothèque vide.
 */
export function useLibraryCatalogState(libraryId: string, filters: LibraryFilterState, params: CatalogFilters): LibraryCatalogState {
  const { data, isLoading, isError, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = useLibraryCatalog(libraryId, params);
  const loaded = useMemo(() => data?.pages.flatMap((page) => page.Items) ?? [], [data]);
  const platforms = hasPlatformFilter(filters);
  const { filteredItems } = usePlatformFilter(loaded, filters.platformIds);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const retry = useCallback(() => void refetch(), [refetch]);

  return {
    items: platforms ? filteredItems : loaded,
    loaded,
    // Plateformes : le serveur ne sait pas filtrer, seul le décompte local vaut.
    total: platforms ? filteredItems.length : data?.pages[0]?.TotalRecordCount,
    loading: isLoading && !data,
    loadingMore: isFetchingNextPage,
    failed: isError && !data,
    loadMore,
    retry,
  };
}
