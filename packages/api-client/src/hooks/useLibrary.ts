import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import type { LibraryView, MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";

export function useLibraries() {
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
                  `&IncludeItemTypes=Movie,Series&Recursive=true` +
                  `&Limit=0&EnableTotalRecordCount=true`
              )
              .catch(() => undefined),
            client
              .fetch<{ Items: Array<{ Id: string; BackdropImageTags?: string[]; ImageTags?: { Primary?: string } }> }>(
                `/Users/${userId}/Items?ParentId=${lib.Id}` +
                  `&IncludeItemTypes=Movie,Series&Recursive=true` +
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
    enabled: !!userId,
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
        `&Recursive=true&Fields=Overview,PrimaryImageAspectRatio&Limit=${limit}` +
        `&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1`;
      if (search.length >= 2) url += `&searchTerm=${encodeURIComponent(search)}`;
      return client.fetch<{ Items: MediaItem[] }>(url).then((r) => r.Items);
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
          `/Shows/${seriesId}/Seasons?userId=${userId}&Fields=PrimaryImageAspectRatio`
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
            `&Fields=Overview,PrimaryImageAspectRatio,MediaSources,MediaStreams`
        )
        .then((r) => r.Items),
    enabled: !!userId && !!seriesId && !!seasonId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useMediaItem(itemId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["item", itemId],
    queryFn: () =>
      client.fetch<MediaItem>(
        `/Users/${userId}/Items/${itemId}?Fields=Overview,Genres,Taglines,MediaSources,MediaStreams,People,Studios,ProviderIds,Chapters,ParentId`
      ),
    enabled: !!userId && !!itemId,
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
            `&IncludeItemTypes=Movie,Series&Limit=24&Fields=Overview,PrimaryImageAspectRatio` +
            `&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1`
        )
        .then((r) => r.Items),
    enabled: !!userId && query.length >= 2,
    staleTime: 30 * 1000,
  });
}

/** Fetch all ancestors of an item — used to find which library it belongs to. */
export function useItemAncestors(itemId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["item-ancestors", itemId],
    queryFn: () =>
      client.fetch<Array<{ Id: string; Name: string; Type: string }>>(
        `/Items/${itemId}/Ancestors?userId=${userId}`
      ),
    enabled: !!userId && !!itemId,
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
          `/Items/${itemId}/Similar?userId=${userId}&Limit=24&Fields=Overview,PrimaryImageAspectRatio,ParentId` +
            `&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1`
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

export interface CatalogFilters {
  sortBy?: string;
  sortOrder?: string;
  genreIds?: string[];
  years?: string[];
  statusFilter?: string;
  searchTerm?: string;
}

export function useLibraryCatalog(libraryId: string | undefined, filters: CatalogFilters = {}) {
  const client = useJellyfinClient();
  const userId = useUserId();
  const {
    sortBy = "DateCreated",
    sortOrder = "Descending",
    genreIds,
    years,
    statusFilter,
    searchTerm,
  } = filters;

  return useInfiniteQuery({
    queryKey: ["library-catalog", libraryId, sortBy, sortOrder, genreIds, years, statusFilter, searchTerm],
    queryFn: ({ pageParam = 0 }) => {
      const itemTypes = statusFilter === "IsResumable" ? "Movie,Episode" : "Movie,Series";
      let url =
        `/Users/${userId}/Items?ParentId=${libraryId}` +
        `&SortBy=${sortBy}&SortOrder=${sortOrder}` +
        `&IncludeItemTypes=${itemTypes}&Recursive=true` +
        `&Fields=Overview,PrimaryImageAspectRatio` +
        `&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1` +
        `&Limit=30&StartIndex=${pageParam}` +
        `&EnableTotalRecordCount=true`;
      if (genreIds && genreIds.length > 0) url += `&GenreIds=${genreIds.join(",")}`;
      if (years && years.length > 0) url += `&Years=${years.join(",")}`;
      if (statusFilter) url += `&Filters=${statusFilter}`;
      if (searchTerm && searchTerm.length >= 2) url += `&searchTerm=${encodeURIComponent(searchTerm)}`;
      return client.fetch<{ Items: MediaItem[]; TotalRecordCount: number }>(url);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.Items.length, 0);
      return loaded < lastPage.TotalRecordCount ? loaded : undefined;
    },
    enabled: !!userId && !!libraryId,
    staleTime: 2 * 60 * 1000,
  });
}
