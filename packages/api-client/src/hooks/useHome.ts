import { useQuery } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle/shared";
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

const FIELDS = "Overview,Genres,PrimaryImageAspectRatio";
const IMAGE_OPTS = "EnableImageTypes=Primary,Backdrop,Thumb&ImageTypeLimit=1";

export function useResumeItems() {
  const client = useJellyfinClient();
  const userId = getUserId();

  return useQuery({
    queryKey: ["resume-items"],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Users/${userId}/Items/Resume?Limit=12&Fields=${FIELDS}&MediaTypes=Video&${IMAGE_OPTS}`
        )
        .then((r) => r.Items),
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}

export function useLatestItems(parentId: string | undefined) {
  const client = useJellyfinClient();
  const userId = getUserId();

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
  const userId = getUserId();

  return useQuery({
    queryKey: ["next-up"],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Shows/NextUp?userId=${userId}&Limit=12&Fields=${FIELDS}&${IMAGE_OPTS}`
        )
        .then((r) => r.Items),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useFeaturedItems() {
  const client = useJellyfinClient();
  const userId = getUserId();

  return useQuery({
    queryKey: ["featured"],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Users/${userId}/Items?SortBy=Random&Limit=5&Recursive=true` +
            `&IncludeItemTypes=Movie&Fields=Overview,Genres,Taglines&HasBackdrop=true&${IMAGE_OPTS}`
        )
        .then((r) => r.Items),
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
  });
}
