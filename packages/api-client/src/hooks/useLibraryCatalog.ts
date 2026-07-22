import { useInfiniteQuery } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";

// Catalogue paginé d'une bibliothèque (grilles web + TV) — extraction
// mécanique de useLibrary.ts (limite de 300 lignes), comportement inchangé.

export interface CatalogFilters {
  sortBy?: string;
  sortOrder?: string;
  genreIds?: string[];
  years?: string[];
  statusFilter?: string;
  searchTerm?: string;
  limit?: number;
  minCommunityRating?: number;
  isFavorite?: boolean;
  studioIds?: string[];
  /** "light" (TV) : champs minimum pour la grille ; "full" (web, défaut) :
   *  + ProviderIds/Studios (requis par le filtre plateforme web). */
  fields?: "light" | "full";
}

const CATALOG_STALE_TIME = 10 * 60 * 1000;

/** Clé de cache du catalogue — partagée entre useLibraryCatalog et le prefetch
 *  (toute divergence = cache-miss silencieux). */
export function getLibraryCatalogKey(libraryId: string | undefined, filters: CatalogFilters = {}): unknown[] {
  const {
    sortBy = "DateCreated", sortOrder = "Descending",
    genreIds, years, statusFilter, searchTerm,
    limit = 30, minCommunityRating, isFavorite, studioIds,
    fields = "full",
  } = filters;
  return ["library", "catalog", libraryId, sortBy, sortOrder, genreIds, years, statusFilter, searchTerm, limit, minCommunityRating, isFavorite, studioIds, fields];
}

interface CatalogFetchClient {
  fetch<T>(url: string): Promise<T>;
}

/** queryFn d'une page de catalogue — partagée entre le hook et le prefetch. */
function buildCatalogPageFetcher(
  client: CatalogFetchClient,
  userId: string,
  libraryId: string,
  filters: CatalogFilters = {},
) {
  const {
    sortBy = "DateCreated", sortOrder = "Descending",
    genreIds, years, statusFilter, searchTerm,
    limit = 30, minCommunityRating, isFavorite, studioIds,
    fields = "full",
  } = filters;
  // RecursiveItemCount requis par le filtre des séries vides ci-dessous ;
  // MediaSources requis pour les chips qualité au focus/hover.
  // Overview retiré : non consommé par les grilles web/TV (payload dominant).
  const fieldList = fields === "light"
    ? "PrimaryImageAspectRatio,RecursiveItemCount,MediaSources"
    : "PrimaryImageAspectRatio,ProviderIds,Studios,RecursiveItemCount,MediaSources";

  return ({ pageParam }: { pageParam?: unknown }) => {
    const startIndex = typeof pageParam === "number" ? pageParam : 0;
    const itemTypes = statusFilter === "IsResumable" ? "Movie,Episode" : "Movie,Series";
    let url =
      `/Users/${userId}/Items?ParentId=${libraryId}` +
      `&SortBy=${sortBy}&SortOrder=${sortOrder}` +
      `&IncludeItemTypes=${itemTypes}&Recursive=true` +
      `&Fields=${fieldList}` +
      `&ExcludeLocationTypes=Virtual&IsMissing=false` +
      `&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1` +
      `&Limit=${limit}&StartIndex=${startIndex}` +
      `&EnableTotalRecordCount=true&EnableUserData=true`;
    if (genreIds && genreIds.length > 0) url += `&GenreIds=${genreIds.join(",")}`;
    if (years && years.length > 0) url += `&Years=${years.join(",")}`;
    if (statusFilter) url += `&Filters=${statusFilter}`;
    if (isFavorite) url += `&IsFavorite=true`;
    if (minCommunityRating != null) url += `&MinCommunityRating=${minCommunityRating}`;
    if (studioIds && studioIds.length > 0) url += `&StudioIds=${studioIds.join(",")}`;
    if (searchTerm && searchTerm.length >= 2) url += `&searchTerm=${encodeURIComponent(searchTerm)}`;
    return client.fetch<{ Items: MediaItem[]; TotalRecordCount: number }>(url).then((res) => ({
      Items: res.Items.filter((item) =>
        item.Type !== "Series" || (item.RecursiveItemCount ?? 0) > 0
      ),
      TotalRecordCount: res.TotalRecordCount,
      _serverCount: res.Items.length,
    }));
  };
}

export function useLibraryCatalog(libraryId: string | undefined, filters: CatalogFilters = {}) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useInfiniteQuery({
    queryKey: getLibraryCatalogKey(libraryId, filters),
    queryFn: buildCatalogPageFetcher(client, userId ?? "", libraryId ?? "", filters),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const serverLoaded = allPages.reduce((sum, p) => sum + p._serverCount, 0);
      return serverLoaded < lastPage.TotalRecordCount ? serverLoaded : undefined;
    },
    enabled: !!userId && !!libraryId,
    staleTime: CATALOG_STALE_TIME,
    // Garde la grille affichée pendant un changement de tri/filtre.
    // Double-compat : api-client est typé v5 (web) mais la TV résout la v4 au
    // runtime — ne PAS importer le helper `keepPreviousData` de v5 (absent en
    // v4 → crash Metro). v4 lit keepPreviousData ; v5 lit placeholderData(prev).
    ...({ keepPreviousData: true, placeholderData: (prev: unknown) => prev } as object),
  });
}

interface PrefetchClientLike {
  prefetchInfiniteQuery(options: Record<string, unknown>): Promise<void>;
}

/** Précharge la première page du catalogue (ex. au focus d'une bibliothèque
 *  dans le rail TV) — no-op réseau si le cache est encore frais. Duck-typé :
 *  accepte un QueryClient v4 (TV) comme v5 (web). */
export function prefetchLibraryCatalog(
  qc: PrefetchClientLike,
  client: CatalogFetchClient,
  userId: string | null | undefined,
  libraryId: string,
  filters: CatalogFilters = {},
): Promise<void> {
  if (!userId || !libraryId) return Promise.resolve();
  return qc.prefetchInfiniteQuery({
    queryKey: getLibraryCatalogKey(libraryId, filters),
    queryFn: buildCatalogPageFetcher(client, userId, libraryId, filters),
    initialPageParam: 0,
    staleTime: CATALOG_STALE_TIME,
  });
}
