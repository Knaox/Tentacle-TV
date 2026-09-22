import { useQuery } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";

/**
 * Les saisons d'une série et les épisodes « légers » d'une saison — ce qu'une
 * liste d'épisodes affiche, avec de quoi le PRÉCHARGER sous la même clé.
 *
 * Sortis de `useLibrary`, qui dépassait la limite de taille, avec leurs
 * fonctions de préchargement : le lecteur du téléviseur les appelle dès que la
 * lecture démarre, pour que le panneau des épisodes s'ouvre déjà rempli.
 */

/** Le strict nécessaire d'un client Jellyfin, décrit par sa forme. */
interface ItemsFetchClient {
  fetch<T>(url: string): Promise<T>;
}

/** Le strict nécessaire d'un `QueryClient` pour précharger — v4 (TV) comme v5. */
interface PrefetchQueryClientLike {
  prefetchQuery(options: Record<string, unknown>): Promise<void>;
}

const SEASONS_STALE_TIME = 5 * 60 * 1000;
const EPISODES_STALE_TIME = 2 * 60 * 1000;

function fetchSeasons(client: ItemsFetchClient, userId: string, seriesId: string) {
  return client
    .fetch<{ Items: MediaItem[] }>(
      `/Shows/${seriesId}/Seasons?userId=${userId}&Fields=PrimaryImageAspectRatio,RemoteTrailers`
    )
    .then((r) => r.Items);
}

export function useSeasons(seriesId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["seasons", seriesId],
    queryFn: () => fetchSeasons(client, userId!, seriesId!),
    enabled: !!userId && !!seriesId,
    staleTime: SEASONS_STALE_TIME,
  });
}

/** Précharge les saisons d'une série, sous la clé exacte de `useSeasons`. */
export function prefetchSeasons(
  qc: PrefetchQueryClientLike,
  client: ItemsFetchClient,
  userId: string | null | undefined,
  seriesId: string,
): Promise<void> {
  if (!userId || !seriesId) return Promise.resolve();
  return qc.prefetchQuery({
    queryKey: ["seasons", seriesId],
    queryFn: () => fetchSeasons(client, userId, seriesId),
    staleTime: SEASONS_STALE_TIME,
  });
}

/**
 * La clé des épisodes d'une saison SANS leurs sources.
 *
 * Elle prolonge celle de `useEpisodes` au lieu d'en inventer une : les
 * invalidations par série (`invalidateSeriesWatchViews`) et les mises à jour
 * optimistes de l'état « vu » (`updateItemUserDataInCache`) travaillent par
 * PRÉFIXE `episodes`, et couvrent donc celle-ci sans une ligne de plus.
 */
export const getSeasonEpisodesLiteKey = (seriesId: string | undefined, seasonId: string | undefined) =>
  ["episodes", seriesId, seasonId, "lite"] as const;

function fetchSeasonEpisodesLite(
  client: ItemsFetchClient,
  userId: string,
  seriesId: string,
  seasonId: string,
) {
  return client
    .fetch<{ Items: MediaItem[] }>(
      `/Shows/${seriesId}/Episodes?SeasonId=${seasonId}&userId=${userId}` +
        `&Fields=Overview,PrimaryImageAspectRatio&EnableUserData=true`
    )
    .then((r) => r.Items);
}

/**
 * Les épisodes d'une saison, de quoi AFFICHER la liste — sans leurs sources.
 *
 * `useEpisodes` demande `MediaSources` et `MediaStreams`, que seules les
 * pastilles de qualité lisent. Leur prix se mesure sur une longue saison : les
 * 196 épisodes de la onzième de One Piece pèsent 2,7 Mo et 600 ms avec, 0,3 Mo
 * et 100 ms sans — le serveur calcule les sources de chaque fichier. La liste
 * part donc de celle-ci, et les pastilles arrivent quand `useEpisodes` répond.
 */
export function useSeasonEpisodesLite(seriesId: string | undefined, seasonId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: getSeasonEpisodesLiteKey(seriesId, seasonId),
    queryFn: () => fetchSeasonEpisodesLite(client, userId!, seriesId!, seasonId!),
    enabled: !!userId && !!seriesId && !!seasonId,
    staleTime: EPISODES_STALE_TIME,
  });
}

/** Précharge les épisodes « légers » d'une saison (cf. `useSeasonEpisodesLite`). */
export function prefetchSeasonEpisodesLite(
  qc: PrefetchQueryClientLike,
  client: ItemsFetchClient,
  userId: string | null | undefined,
  seriesId: string,
  seasonId: string,
): Promise<void> {
  if (!userId || !seriesId || !seasonId) return Promise.resolve();
  return qc.prefetchQuery({
    queryKey: getSeasonEpisodesLiteKey(seriesId, seasonId),
    queryFn: () => fetchSeasonEpisodesLite(client, userId, seriesId, seasonId),
    staleTime: EPISODES_STALE_TIME,
  });
}
