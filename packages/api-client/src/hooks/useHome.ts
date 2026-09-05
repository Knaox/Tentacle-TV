import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import {
  dedupResumeBySeries,
  filterNextUpAgainstResume,
  buildSmartNextUp,
  buildWatchAnchors,
  findStaleSuggestions,
  realignNextUp,
  groupLatestByRuns,
} from "../utils/mediaFilters";
import { useNextUpSuccessors } from "./useNextUpSuccessors";
import { homeLimits, staleFactor } from "../net/dataSaver";

// MediaSources est requis pour afficher le badge qualité (4K / HDR / Dolby)
// sur les items du hero. Payload +~5KB par item — acceptable pour un Limit=12.
const FIELDS = "Overview,Genres,PrimaryImageAspectRatio,MediaSources,ProviderIds";
const IMAGE_OPTS = "EnableImageTypes=Primary,Backdrop,Thumb&ImageTypeLimit=1";
const USER_DATA = "EnableUserData=true";

export function useResumeItems() {
  const client = useJellyfinClient();
  const userId = useUserId();

  // `Trickplay` sur CETTE requête seulement : la carte de reprise croppe la
  // vignette exacte de la position, et il lui faut le manifeste. Quelques
  // centaines d'octets par item × 12 — les autres rangées n'en font rien.
  return useQuery({
    queryKey: ["resume-items"],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Users/${userId}/Items/Resume?Limit=12&Recursive=true` +
            `&IncludeItemTypes=Movie,Episode&Fields=${FIELDS},Trickplay&MediaTypes=Video&${IMAGE_OPTS}&${USER_DATA}`
        )
        .then((r) => r.Items),
    select: dedupResumeBySeries,
    enabled: !!userId,
    staleTime: 30_000 * staleFactor(),
  });
}

interface LatestItemsOptions {
  /** CollectionType de la bibliothèque (ex: "tvshows", "movies"). Quand "tvshows",
   *  la rangée renvoie des épisodes, regroupés en collection par runs consécutifs
   *  d'une même série (cf. groupLatestByRuns). */
  collectionType?: string;
  /** Différer la requête jusqu'à ce que la rangée approche du viewport
   *  (mode économie). Par défaut la rangée charge dès le montage. */
  enabled?: boolean;
}

// Champs pour le rendu épisode (image, label SxxExx, navigation). MediaSources
// inclus pour alimenter la méta qualité/langues (CardMetaOverlay au hover sur
// les ajouts récents d'épisodes uniques). Overview/Genres restent exclus.
const EPISODE_FIELDS = "PrimaryImageAspectRatio,SeriesName,SeriesId,ParentIndexNumber,IndexNumber,MediaSources";

// Fenêtre d'épisodes récupérée avant regroupement par série : cf.
// `homeLimits().latestEpisodes`. Assez large pour qu'une saison ajoutée en
// masse n'éjecte pas les séries précédentes, mais bornée — 200 → 100 divisait
// le payload par 2 sans perte visible (la rangée n'affiche qu'une vingtaine de
// groupes), et le mode économie descend à 40.

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
              `&SortBy=DateCreated&SortOrder=Descending&Limit=${homeLimits().latestEpisodes}` +
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
    enabled: !!userId && !!parentId && (options?.enabled ?? true),
    staleTime: 2 * 60 * 1000 * staleFactor(),
  });
}

/**
 * « Prochains épisodes » — stratégie hybride.
 *
 * La règle du produit est la même ici que sur la fiche : le prochain épisode
 * est le SUIVANT de celui qu'on vient de regarder. Le supplément comblait
 * autrefois les trous — « premier non vu par série engagée » — et ramenait
 * donc en tête un épisode qu'on avait sauté, ou celui qu'on venait de remettre
 * en « non lu ». Il propose désormais le premier non-vu qui SUIT la dernière
 * lecture, et rien qui soit derrière elle.
 *
 * Le montage, défensif — le carrousel ne disparaît jamais :
 *  1. PRIMAIRE : /Shows/NextUp (répond toujours, et vite).
 *  2. SUPPLÉMENT : la même règle, pour les séries que NextUp ne couvre pas
 *     (ses angles morts sur les trous sont connus : #13732, #15432).
 *  3. FILTRE : on retire les séries dont un épisode est entamé — celles-là
 *     vivent dans « Reprendre ».
 *
 * Si les requêtes du supplément échouent (`SortBy` non géré par certaines
 * versions de Jellyfin), le primaire suffit — dégradation en douceur.
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
    staleTime: 30_000 * staleFactor(),
  });

  // Le vivier du supplément : tous les épisodes non vus, triés par saison puis
  // numéro (un tri universellement géré — pas de risque `SeriesSortName`).
  // Ce n'est PAS une liste de propositions : c'est parmi eux qu'on cherche
  // celui qui suit la dernière lecture.
  // Fields allégés (pas d'Overview/Genres : items du carrousel = image + chips)
  // et Limit borné — c'était 500 items × ~5KB refetchés à chaque retour Home.
  const unwatched = useQuery({
    queryKey: ["next-up", "unwatched-episodes"],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Users/${userId}/Items?IncludeItemTypes=Episode&Filters=IsUnplayed&Recursive=true` +
            `&SortBy=ParentIndexNumber,IndexNumber&Limit=${homeLimits().unwatched}` +
            `&Fields=PrimaryImageAspectRatio,MediaSources&${IMAGE_OPTS}&${USER_DATA}`,
        )
        .then((r) => r.Items),
    enabled: !!userId,
    staleTime: 60_000 * staleFactor(),
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
            `&SortBy=DatePlayed&SortOrder=Descending&Limit=${homeLimits().engaged}&${USER_DATA}`,
        )
        .then((r) => r.Items),
    enabled: !!userId,
    staleTime: 60_000 * staleFactor(),
    retry: 1,
  });

  // L'ancre de chaque série — sa dernière lecture. C'est elle qui commande, et
  // non ce que le serveur croit savoir : sur une série dont quelques épisodes
  // épars sont marqués vus, `/Shows/NextUp` repropose le tout premier.
  const anchors = useMemo(
    () => buildWatchAnchors(engagement.data ?? []),
    [engagement.data],
  );
  // Les propositions situées DERRIÈRE l'ancre. Vide dans le cas courant : la
  // requête de résolution ne part que là où il y a un défaut à réparer.
  const stale = useMemo(
    () => findStaleSuggestions(primary.data ?? [], anchors),
    [primary.data, anchors],
  );
  const successors = useNextUpSuccessors(stale);

  const data = useMemo(() => {
    const primaryItems = realignNextUp(primary.data ?? [], anchors, successors);

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
  }, [primary.data, unwatched.data, engagement.data, resume.data, anchors, successors]);

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
    staleTime: 5 * 60 * 1000 * staleFactor(),
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
    staleTime: 10 * 60 * 1000 * staleFactor(),
  });
}
