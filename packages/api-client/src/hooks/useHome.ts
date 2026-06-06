import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import {
  dedupResumeBySeries,
  filterNextUpAgainstResume,
  buildSmartNextUp,
  groupLatestByRuns,
} from "../utils/mediaFilters";

// MediaSources est requis pour afficher le badge qualité (4K / HDR / Dolby)
// sur les items du hero. Payload +~5KB par item — acceptable pour un Limit=12.
const FIELDS = "Overview,Genres,PrimaryImageAspectRatio,MediaSources";
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
    select: dedupResumeBySeries,
    enabled: !!userId,
    staleTime: 30_000,
  });
}

interface LatestItemsOptions {
  /** CollectionType de la bibliothèque (ex: "tvshows", "movies"). Quand "tvshows",
   *  la rangée renvoie des épisodes, regroupés en collection par runs consécutifs
   *  d'une même série (cf. groupLatestByRuns). */
  collectionType?: string;
}

// Champs légers pour le rendu épisode (image, label SxxExx, navigation). On
// retire Overview/Genres/MediaSources : inutiles ici et trop lourds à Limit élevé.
const EPISODE_FIELDS = "PrimaryImageAspectRatio,SeriesName,SeriesId,ParentIndexNumber,IndexNumber";

// Fenêtre d'épisodes récupérée avant regroupement par série. Élevée car une série
// fraîchement ajoutée en masse (saison complète) consomme beaucoup de slots ; sans
// ça, les séries ajoutées avant disparaissent de la rangée.
const EPISODE_LATEST_LIMIT = 200;

export function useLatestItems(parentId: string | undefined, options?: LatestItemsOptions) {
  const client = useJellyfinClient();
  const userId = useUserId();
  const episodeMode = options?.collectionType === "tvshows";

  return useQuery({
    // Le 3e segment évite qu'un cache "série groupée" serve un consommateur "épisodes".
    queryKey: ["latest-items", parentId, episodeMode ? "episodes" : "default"],
    queryFn: () => {
      if (!parentId || !userId) return Promise.resolve([]);
      if (episodeMode) {
        // Épisodes triés par date d'ajout, SANS filtre "non lu" (un épisode vu
        // reste présent). Large fenêtre car on regroupe ensuite par runs.
        return client
          .fetch<{ Items: MediaItem[] }>(
            `/Users/${userId}/Items?ParentId=${parentId}&Recursive=true&IncludeItemTypes=Episode` +
              `&SortBy=DateCreated&SortOrder=Descending&Limit=${EPISODE_LATEST_LIMIT}` +
              `&Fields=${EPISODE_FIELDS}&${IMAGE_OPTS}&${USER_DATA}`
          )
          .then((r) => r.Items);
      }
      // Films (ou autres) : derniers ajoutés par date, SANS filtre "non lu".
      const typeFilter = options?.collectionType === "movies" ? "&IncludeItemTypes=Movie" : "";
      return client
        .fetch<{ Items: MediaItem[] }>(
          `/Users/${userId}/Items?ParentId=${parentId}&Recursive=true${typeFilter}` +
            `&SortBy=DateCreated&SortOrder=Descending&Limit=16` +
            `&Fields=${FIELDS}&${IMAGE_OPTS}&${USER_DATA}`
        )
        .then((r) => r.Items);
    },
    select: episodeMode ? groupLatestByRuns : undefined,
    enabled: !!userId && !!parentId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * "Prochains épisodes" — hybrid strategy.
 *
 * Jellyfin's /Shows/NextUp has known bugs with gaps (issue #13732, #15432):
 * if you watched S05 entirely + S01E01-06, NextUp won't surface S01E07
 * because it tracks "next after last watched", not "first unwatched".
 *
 * Approach (defensive — carousel never disappears):
 *  1. PRIMARY : /Shows/NextUp (always returns valid data, fast).
 *  2. SUPPLEMENT : smart "first unwatched per engaged series" fills the gaps
 *     for series NOT covered by NextUp.
 *  3. FILTER : drop series with an in-progress episode (those live in Resume).
 *
 * If the smart queries fail (e.g., unsupported SortBy on some Jellyfin
 * versions), we still get the primary NextUp result — graceful degradation.
 */
export function useNextUp() {
  const client = useJellyfinClient();
  const userId = useUserId();
  const resume = useResumeItems();

  // Primary: Jellyfin's official NextUp — always returns valid data.
  const primary = useQuery({
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

  // Supplement: all unwatched episodes (sorted by season+episode number,
  // which is universally supported — no SeriesSortName risk).
  const unwatched = useQuery({
    queryKey: ["next-up", "unwatched-episodes"],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Users/${userId}/Items?IncludeItemTypes=Episode&Filters=IsUnplayed&Recursive=true` +
            `&SortBy=ParentIndexNumber,IndexNumber&Limit=500` +
            `&Fields=${FIELDS}&${IMAGE_OPTS}&${USER_DATA}`,
        )
        .then((r) => r.Items),
    enabled: !!userId,
    staleTime: 60_000,
    // Don't block the carousel if this fails — primary still has data.
    retry: 1,
  });

  // Engagement source: watched episodes ordered by recency.
  const engagement = useQuery({
    queryKey: ["next-up", "engaged-series"],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Users/${userId}/Items?IncludeItemTypes=Episode&Filters=IsPlayed&Recursive=true` +
            `&SortBy=DatePlayed&SortOrder=Descending&Limit=500&${USER_DATA}`,
        )
        .then((r) => r.Items),
    enabled: !!userId,
    staleTime: 60_000,
    retry: 1,
  });

  const data = useMemo(() => {
    const primaryItems = primary.data ?? [];

    // Engagement rank map: SeriesId → position in DatePlayed-desc timeline
    // (rank 0 = the show the user watched most recently). Used at the end to
    // sort the merged carousel so "last watched series" appears first.
    const rankBySeries = new Map<string, number>();
    if (engagement.data) {
      for (const ep of engagement.data) {
        if (!ep.SeriesId || rankBySeries.has(ep.SeriesId)) continue;
        rankBySeries.set(ep.SeriesId, rankBySeries.size);
      }
    }

    // Series already covered by the primary endpoint (avoid duplicates).
    const coveredSeries = new Set<string>();
    for (const it of primaryItems) {
      if (it.Type === "Episode" && it.SeriesId) coveredSeries.add(it.SeriesId);
    }

    // Smart supplement — only adds series NOT in primary. Skipped entirely
    // if the smart queries failed/empty (graceful degradation).
    let merged: MediaItem[] = [...primaryItems];
    if (unwatched.data && engagement.data && unwatched.data.length > 0) {
      const smart = buildSmartNextUp(unwatched.data, engagement.data, 24);
      const supplementary = smart.filter(
        (it) => it.SeriesId && !coveredSeries.has(it.SeriesId),
      );
      if (supplementary.length > 0) {
        merged = [...primaryItems, ...supplementary];
      }
    }

    // Sort by engagement recency — most recently watched series first.
    // Items without a known engagement rank (e.g., primary returned a
    // never-watched series) sink to the end.
    merged.sort((a, b) => {
      const ra = a.SeriesId
        ? rankBySeries.get(a.SeriesId) ?? Number.POSITIVE_INFINITY
        : Number.POSITIVE_INFINITY;
      const rb = b.SeriesId
        ? rankBySeries.get(b.SeriesId) ?? Number.POSITIVE_INFINITY
        : Number.POSITIVE_INFINITY;
      return ra - rb;
    });

    // Hide series with an in-progress episode (those live in "Reprendre").
    const filtered = filterNextUpAgainstResume(merged, resume.data ?? []);
    return filtered.slice(0, 12);
  }, [primary.data, unwatched.data, engagement.data, resume.data]);

  return {
    data,
    isLoading: primary.isLoading,
    isError: primary.isError,
    error: primary.error,
    refetch: () => {
      primary.refetch();
      unwatched.refetch();
      engagement.refetch();
    },
  };
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
            `&IncludeItemTypes=Movie,Series&Fields=Overview,Genres,Taglines,MediaSources&HasBackdrop=true&${IMAGE_OPTS}&${USER_DATA}`
        )
        .then((r) => r.Items),
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
  });
}
