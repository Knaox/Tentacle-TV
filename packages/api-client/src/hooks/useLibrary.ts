import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import type { LibraryView, MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";

export function useLibraries(options?: { enabled?: boolean }) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["libraries"],
    queryFn: async () => {
      const { Items: libraries } = await client.fetch<{ Items: LibraryView[] }>(
        `/Users/${userId}/Views`
      );

      // Récupérer le décompte réel + un item aléatoire par bibliothèque (en parallèle)
      const enriched = await Promise.all(
        libraries.map(async (lib) => {
          const [countRes, randomRes] = await Promise.all([
            client
              .fetch<{ TotalRecordCount: number }>(
                `/Users/${userId}/Items?ParentId=${lib.Id}` +
                  `&IncludeItemTypes=Movie,Series&Recursive=true&ExcludeLocationTypes=Virtual&IsMissing=false` +
                  `&Limit=0&EnableTotalRecordCount=true`
              )
              .catch(() => undefined),
            client
              .fetch<{ Items: Array<{ Id: string; BackdropImageTags?: string[]; ImageTags?: { Primary?: string } }> }>(
                `/Users/${userId}/Items?ParentId=${lib.Id}` +
                  `&IncludeItemTypes=Movie,Series&Recursive=true&ExcludeLocationTypes=Virtual&IsMissing=false` +
                  `&SortBy=Random&Limit=5&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1`
              )
              .catch(() => undefined),
          ]);

          const randomItems = (randomRes?.Items ?? []).map((item) => ({
            id: item.Id,
            hasBackdrop: (item.BackdropImageTags?.length ?? 0) > 0,
            hasPrimary: !!item.ImageTags?.Primary,
          }));

          return {
            ...lib,
            RecursiveItemCount: countRes?.TotalRecordCount ?? lib.ChildCount,
            _randomItems: randomItems,
          };
        })
      );

      return enriched;
    },
    enabled: !!userId && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}

export function useLibraryItems(
  libraryId: string | undefined,
  options?: { search?: string; limit?: number; sortBy?: string; sortOrder?: string }
) {
  const client = useJellyfinClient();
  const userId = useUserId();
  const limit = options?.limit ?? 50;
  const sortBy = options?.sortBy ?? "SortName";
  const sortOrder = options?.sortOrder ?? "Ascending";
  const search = options?.search?.trim() ?? "";

  return useQuery({
    queryKey: ["library", libraryId, "items", search, limit, sortBy, sortOrder],
    queryFn: () => {
      let url = `/Users/${userId}/Items?ParentId=${libraryId}` +
        `&SortBy=${sortBy}&SortOrder=${sortOrder}&IncludeItemTypes=Movie,Series` +
        `&Recursive=true&Fields=Overview,PrimaryImageAspectRatio,RecursiveItemCount,MediaSources` +
        `&ExcludeLocationTypes=Virtual&IsMissing=false&Limit=${limit}` +
        `&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1&EnableUserData=true`;
      if (search.length >= 2) url += `&searchTerm=${encodeURIComponent(search)}`;
      return client.fetch<{ Items: MediaItem[] }>(url).then((r) =>
        r.Items.filter((item) => item.Type !== "Series" || (item.RecursiveItemCount ?? 0) > 0)
      );
    },
    enabled: !!userId && !!libraryId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useSeasons(seriesId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["seasons", seriesId],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Shows/${seriesId}/Seasons?userId=${userId}&Fields=PrimaryImageAspectRatio,RemoteTrailers`
        )
        .then((r) => r.Items),
    enabled: !!userId && !!seriesId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useEpisodes(seriesId: string | undefined, seasonId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["episodes", seriesId, seasonId],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Shows/${seriesId}/Episodes?SeasonId=${seasonId}&userId=${userId}` +
            `&Fields=Overview,PrimaryImageAspectRatio,MediaSources,MediaStreams&EnableUserData=true`
        )
        .then((r) => r.Items),
    enabled: !!userId && !!seriesId && !!seasonId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useMediaItem(itemId: string | undefined, options?: { enabled?: boolean }) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["item", itemId],
    queryFn: () =>
      client.fetch<MediaItem>(
        `/Users/${userId}/Items/${itemId}?Fields=Overview,Genres,Taglines,MediaSources,MediaStreams,People,Studios,ProviderIds,Chapters,ParentId,Trickplay,RemoteTrailers,SeriesId,SeasonId,Status&EnableUserData=true`
      ),
    enabled: !!userId && !!itemId && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSearchItems(query: string) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["search", query],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Users/${userId}/Items?searchTerm=${encodeURIComponent(query)}&Recursive=true` +
            `&IncludeItemTypes=Movie,Series&Limit=24&Fields=Overview,PrimaryImageAspectRatio,MediaSources` +
            `&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1&EnableUserData=true`
        )
        .then((r) => r.Items),
    enabled: !!userId && query.length >= 2,
    staleTime: 30 * 1000,
  });
}

/** Fetch all ancestors of an item — used to find which library it belongs to. */
export function useItemAncestors(itemId: string | undefined, options?: { enabled?: boolean }) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["item-ancestors", itemId],
    queryFn: () =>
      client.fetch<Array<{ Id: string; Name: string; Type: string }>>(
        `/Items/${itemId}/Ancestors?userId=${userId}`
      ),
    enabled: !!userId && !!itemId && (options?.enabled ?? true),
    staleTime: 30 * 60 * 1000,
  });
}

export function useSimilarItems(itemId: string | undefined, parentId?: string) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["similar", itemId],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Items/${itemId}/Similar?userId=${userId}&Limit=24&Fields=Overview,PrimaryImageAspectRatio,ParentId,MediaSources` +
            `&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1&EnableUserData=true`
        )
        .then((r) => r.Items),
    select: (items) => {
      if (!parentId) return items.slice(0, 12);
      const sameLib = items.filter((i) => i.ParentId === parentId);
      return (sameLib.length > 0 ? sameLib : items).slice(0, 12);
    },
    enabled: !!userId && !!itemId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Contenu d'une collection (BoxSet) — films/séries enfants, triés par titre.
 * Utilisé par la fiche détail (web + TV) pour rendre les collections
 * navigables (un BoxSet n'a ni MediaSources ni saisons).
 */
export function useCollectionItems(boxSetId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["collection-items", boxSetId],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Users/${userId}/Items?ParentId=${boxSetId}&SortBy=PremiereDate,SortName&SortOrder=Ascending` +
            `&Fields=Overview,PrimaryImageAspectRatio,MediaSources` +
            `&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1&EnableUserData=true`
        )
        .then((r) => r.Items),
    enabled: !!userId && !!boxSetId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useGenres(libraryId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["genres", libraryId],
    queryFn: () =>
      client
        .fetch<{ Items: Array<{ Id: string; Name: string }> }>(
          `/Genres?ParentId=${libraryId}&UserId=${userId}&Fields=PrimaryImageAspectRatio`
        )
        .then((r) => r.Items),
    enabled: !!userId && !!libraryId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useStudios(libraryId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["studios", libraryId],
    queryFn: () =>
      client
        .fetch<{ Items: Array<{ Id: string; Name: string }> }>(
          `/Studios?ParentId=${libraryId}&UserId=${userId}`
        )
        .then((r) => r.Items),
    enabled: !!userId && !!libraryId,
    staleTime: 10 * 60 * 1000,
  });
}

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
