import { useQuery } from "@tanstack/react-query";
import type { LibraryView, MediaItem } from "@tentacle/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";

export function useLibraries() {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["libraries"],
    queryFn: () =>
      client
        .fetch<{ Items: LibraryView[] }>(`/Users/${userId}/Views`)
        .then((r) => r.Items),
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
        `/Users/${userId}/Items/${itemId}?Fields=Overview,Genres,Taglines,MediaSources,MediaStreams,People,Studios,ProviderIds`
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

export function useSimilarItems(itemId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["similar", itemId],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Items/${itemId}/Similar?userId=${userId}&Limit=12&Fields=Overview,PrimaryImageAspectRatio` +
            `&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1`
        )
        .then((r) => r.Items),
    enabled: !!userId && !!itemId,
    staleTime: 5 * 60 * 1000,
  });
}
