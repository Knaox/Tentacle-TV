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
  /**
   * Langues audio / de sous-titres (codes Jellyfin : « fre », « fra »…) —
   * Jellyfin 12+ seulement : un serveur plus ancien IGNORE le paramètre et rend
   * tout. N'en passer que si `useLibraryLanguages` a dit que le serveur sait.
   */
  audioLanguages?: string[];
  subtitleLanguages?: string[];
  /** "grid" (grille d'affiches Apple TV) : le strict minimum, sans
   *  MediaSources — 1 Kio par film au lieu de 7,6 (mesuré, Jellyfin 10.11) ;
   *  "light" (Android TV) : + MediaSources, pour les puces de qualité de ses
   *  cartes au focus ; "full" (web, défaut) : + ProviderIds/Studios (requis
   *  par le filtre plateforme). */
  fields?: "grid" | "light" | "full";
}

const CATALOG_STALE_TIME = 10 * 60 * 1000;

/** Clé de cache du catalogue — partagée entre useLibraryCatalog et le prefetch
 *  (toute divergence = cache-miss silencieux). */
export function getLibraryCatalogKey(libraryId: string | undefined, filters: CatalogFilters = {}): unknown[] {
  const {
    sortBy = "DateCreated", sortOrder = "Descending",
    genreIds, years, statusFilter, searchTerm,
    limit = 30, minCommunityRating, isFavorite, studioIds,
    audioLanguages, subtitleLanguages, fields = "full",
  } = filters;
  return ["library", "catalog", libraryId, sortBy, sortOrder, genreIds, years, statusFilter, searchTerm, limit, minCommunityRating, isFavorite, studioIds, audioLanguages, subtitleLanguages, fields];
}

interface CatalogFetchClient {
  fetch<T>(url: string): Promise<T>;
}

/** Les types d'une grille de bibliothèque : « En cours » montre des épisodes, le reste films et séries. */
export function catalogItemTypes(filters: CatalogFilters): string {
  return filters.statusFilter === "IsResumable" ? "Movie,Episode" : "Movie,Series";
}

/**
 * Les filtres d'une grille, en paramètres de `/Users/{id}/Items` — partagés avec
 * le relevé des titres supprimables (`libraryDelete/deletableIndex.ts`) : « tout
 * sélectionner » doit couvrir EXACTEMENT ce que la grille montre.
 */
export function catalogFilterParams(filters: CatalogFilters): string {
  const {
    genreIds, years, statusFilter, searchTerm, minCommunityRating, isFavorite, studioIds,
    audioLanguages, subtitleLanguages,
  } = filters;
  let params = "";
  if (genreIds && genreIds.length > 0) params += `&GenreIds=${genreIds.join(",")}`;
  if (years && years.length > 0) params += `&Years=${years.join(",")}`;
  if (statusFilter) params += `&Filters=${statusFilter}`;
  if (isFavorite) params += `&IsFavorite=true`;
  if (minCommunityRating != null) params += `&MinCommunityRating=${minCommunityRating}`;
  if (studioIds && studioIds.length > 0) params += `&StudioIds=${studioIds.join(",")}`;
  if (audioLanguages && audioLanguages.length > 0) params += `&AudioLanguages=${audioLanguages.map(encodeURIComponent).join(",")}`;
  if (subtitleLanguages && subtitleLanguages.length > 0) params += `&SubtitleLanguages=${subtitleLanguages.map(encodeURIComponent).join(",")}`;
  if (searchTerm && searchTerm.length >= 2) params += `&searchTerm=${encodeURIComponent(searchTerm)}`;
  return params;
}

/** queryFn d'une page de catalogue — partagée entre le hook et le prefetch. */
function buildCatalogPageFetcher(
  client: CatalogFetchClient,
  userId: string,
  libraryId: string,
  filters: CatalogFilters = {},
) {
  const { sortBy = "DateCreated", sortOrder = "Descending", limit = 30, fields = "full" } = filters;
  // RecursiveItemCount requis par le filtre des séries vides ci-dessous ;
  // MediaSources requis pour les chips qualité au focus/hover (web, Android
  // TV) — c'est lui qui pèse : 87 % d'une page de films.
  // Overview retiré : non consommé par les grilles web/TV (payload dominant).
  const fieldList = fields === "grid"
    ? "RecursiveItemCount"
    : fields === "light"
      ? "PrimaryImageAspectRatio,RecursiveItemCount,MediaSources"
      : "PrimaryImageAspectRatio,ProviderIds,Studios,RecursiveItemCount,MediaSources";

  return ({ pageParam }: { pageParam?: unknown }) => {
    const startIndex = typeof pageParam === "number" ? pageParam : 0;
    const itemTypes = catalogItemTypes(filters);
    let url =
      `/Users/${userId}/Items?ParentId=${libraryId}` +
      `&SortBy=${sortBy}&SortOrder=${sortOrder}` +
      `&IncludeItemTypes=${itemTypes}&Recursive=true` +
      `&Fields=${fieldList}` +
      `&ExcludeLocationTypes=Virtual&IsMissing=false` +
      `&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1` +
      `&Limit=${limit}&StartIndex=${startIndex}` +
      `&EnableTotalRecordCount=true&EnableUserData=true`;
    url += catalogFilterParams(filters);
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
