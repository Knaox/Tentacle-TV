import { useQuery } from "@tanstack/react-query";
import type { LibraryView, MediaItem } from "@tentacle/shared";
import { useJellyfinClient } from "./useJellyfinClient";

export function useLibraries() {
  const client = useJellyfinClient();

  return useQuery({
    queryKey: ["libraries"],
    queryFn: () =>
      client
        .fetch<{ Items: LibraryView[] }>("/UserViews")
        .then((r) => r.Items),
    staleTime: 5 * 60 * 1000,
  });
}

export function useLibraryItems(libraryId: string | undefined) {
  const client = useJellyfinClient();

  return useQuery({
    queryKey: ["library", libraryId, "items"],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Items?ParentId=${libraryId}&SortBy=SortName&SortOrder=Ascending&IncludeItemTypes=Movie,Series&Recursive=true&Fields=Overview,MediaSources,UserData&ImageTypeLimit=1&EnableImageTypes=Primary,Backdrop`
        )
        .then((r) => r.Items),
    enabled: !!libraryId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useMediaItem(itemId: string | undefined) {
  const client = useJellyfinClient();

  return useQuery({
    queryKey: ["item", itemId],
    queryFn: () =>
      client.fetch<MediaItem>(
        `/Items/${itemId}?Fields=Overview,MediaSources,People,Studios,Genres,UserData`
      ),
    enabled: !!itemId,
    staleTime: 5 * 60 * 1000,
  });
}
