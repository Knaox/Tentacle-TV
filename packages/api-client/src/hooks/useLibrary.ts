import { useQuery } from "@tanstack/react-query";
import type { LibraryView, MediaItem } from "@tentacle/shared";
import { useJellyfinClient } from "./useJellyfinClient";

function getUserId(): string | null {
  try {
    const raw = localStorage.getItem("tentacle_user");
    if (!raw) return null;
    return JSON.parse(raw).Id ?? null;
  } catch {
    return null;
  }
}

export function useLibraries() {
  const client = useJellyfinClient();
  const userId = getUserId();

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

export function useLibraryItems(libraryId: string | undefined) {
  const client = useJellyfinClient();
  const userId = getUserId();

  return useQuery({
    queryKey: ["library", libraryId, "items"],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Users/${userId}/Items?ParentId=${libraryId}` +
            `&SortBy=SortName&SortOrder=Ascending&IncludeItemTypes=Movie,Series` +
            `&Recursive=true&Fields=Overview,PrimaryImageAspectRatio&Limit=50` +
            `&EnableImageTypes=Primary,Backdrop&ImageTypeLimit=1`
        )
        .then((r) => r.Items),
    enabled: !!userId && !!libraryId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useMediaItem(itemId: string | undefined) {
  const client = useJellyfinClient();
  const userId = getUserId();

  return useQuery({
    queryKey: ["item", itemId],
    queryFn: () =>
      client.fetch<MediaItem>(
        `/Users/${userId}/Items/${itemId}?Fields=Overview,Genres,Taglines,MediaSources,MediaStreams,People,Studios`
      ),
    enabled: !!userId && !!itemId,
    staleTime: 5 * 60 * 1000,
  });
}
