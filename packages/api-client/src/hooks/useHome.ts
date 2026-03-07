import { useQuery } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";

const FIELDS = "Overview,Genres,PrimaryImageAspectRatio";
const IMAGE_OPTS = "EnableImageTypes=Primary,Backdrop,Thumb&ImageTypeLimit=1";

export function useResumeItems() {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["resume-items"],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Users/${userId}/Items/Resume?Limit=12&Recursive=true` +
            `&IncludeItemTypes=Movie,Episode&Fields=${FIELDS}&MediaTypes=Video&${IMAGE_OPTS}`
        )
        .then((r) => r.Items),
    enabled: !!userId,
    staleTime: 30_000,
    refetchOnMount: "always",
  });
}

export function useLatestItems(parentId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["latest-items", parentId],
    queryFn: () =>
      client.fetch<MediaItem[]>(
        `/Users/${userId}/Items/Latest?ParentId=${parentId}&Limit=16&Fields=${FIELDS}&${IMAGE_OPTS}`
      ),
    enabled: !!userId && !!parentId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useNextUp() {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["next-up"],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Shows/NextUp?userId=${userId}&Limit=12&DisableFirstEpisode=true` +
            `&EnableResumable=false&Fields=${FIELDS}&${IMAGE_OPTS}`
        )
        .then((r) => r.Items),
    enabled: !!userId,
    staleTime: 30_000,
    refetchOnMount: "always",
  });
}

export function useWatchedItems() {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["watched-items"],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Users/${userId}/Items?SortBy=DatePlayed&SortOrder=Descending&Limit=16` +
            `&Recursive=true&IncludeItemTypes=Movie,Episode&Filters=IsPlayed&Fields=${FIELDS}&${IMAGE_OPTS}`
        )
        .then((r) => r.Items),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useFeaturedItems() {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["featured"],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Users/${userId}/Items?SortBy=Random&Limit=5&Recursive=true` +
            `&IncludeItemTypes=Movie,Series&Fields=Overview,Genres,Taglines&HasBackdrop=true&${IMAGE_OPTS}`
        )
        .then((r) => r.Items),
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
  });
}
