import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import { dedupResumeBySeries, filterNextUpAgainstResume } from "../utils/mediaFilters";

const FIELDS = "Overview,Genres,PrimaryImageAspectRatio";
const IMAGE_OPTS = "EnableImageTypes=Primary,Backdrop,Thumb&ImageTypeLimit=1";
const USER_DATA = "EnableUserData=true";

export function useResumeItems() {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["resume-items"],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Users/${userId}/Items/Resume?Limit=12&Recursive=true` +
            `&IncludeItemTypes=Movie,Episode&Fields=${FIELDS}&MediaTypes=Video&${IMAGE_OPTS}&${USER_DATA}`
        )
        .then((r) => r.Items),
    // Dedup by series — never show two episodes of the same show.
    // Jellyfin returns by DatePlayed desc, so the first occurrence wins (= latest watched).
    select: dedupResumeBySeries,
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useLatestItems(parentId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["latest-items", parentId],
    queryFn: () => {
      // Guard: ne jamais envoyer de requête avec un parentId vide
      if (!parentId || !userId) return Promise.resolve([]);
      return client.fetch<MediaItem[]>(
        `/Users/${userId}/Items/Latest?ParentId=${parentId}&Limit=16&Fields=${FIELDS}&${IMAGE_OPTS}&${USER_DATA}`
      );
    },
    enabled: !!userId && !!parentId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useNextUp() {
  const client = useJellyfinClient();
  const userId = useUserId();
  const resume = useResumeItems();

  const raw = useQuery({
    queryKey: ["next-up"],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Shows/NextUp?userId=${userId}&Limit=12&DisableFirstEpisode=true` +
            `&EnableResumable=false&Fields=${FIELDS}&${IMAGE_OPTS}&${USER_DATA}`
        )
        .then((r) => r.Items),
    enabled: !!userId,
    staleTime: 30_000,
  });

  // Hide "next up" entries for series the user is currently mid-way through.
  // The current episode lives in Resume — advertising the *next* one before
  // the current is finished feels premature.
  const data = useMemo(() => {
    if (!raw.data) return raw.data;
    return filterNextUpAgainstResume(raw.data, resume.data ?? []);
  }, [raw.data, resume.data]);

  return { ...raw, data };
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
            `&Recursive=true&IncludeItemTypes=Movie,Episode&Filters=IsPlayed&Fields=${FIELDS}&${IMAGE_OPTS}&${USER_DATA}`
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
            `&IncludeItemTypes=Movie,Series&Fields=Overview,Genres,Taglines&HasBackdrop=true&${IMAGE_OPTS}&${USER_DATA}`
        )
        .then((r) => r.Items),
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
  });
}
