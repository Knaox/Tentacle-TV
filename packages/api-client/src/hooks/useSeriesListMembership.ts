import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import { WATCHLIST_SERIES_IDS_KEY, FAVORITE_SERIES_IDS_KEY } from "./watchlistEffects";

/**
 * Sources de vérité « légères » pour savoir si une SÉRIE est dans Ma liste /
 * Favoris. On ne charge que les IDs (pas de Limit, pas de UserData/Fields), ce
 * qui couvre TOUTES les séries likées/favorites — y compris au-delà du top 20
 * affiché dans les rangées. Un ÉPISODE est « ajouté » si sa série l'est.
 */
function fetchSeriesIds(
  client: ReturnType<typeof useJellyfinClient>,
  userId: string,
  filter: "Likes" | "IsFavorite",
): Promise<string[]> {
  return client
    .fetch<{ Items: MediaItem[] }>(
      `/Users/${userId}/Items?Filters=${filter}&Recursive=true&IncludeItemTypes=Series&EnableUserData=false`,
    )
    .then((r) => (r.Items || []).map((i) => i.Id).filter((id): id is string => !!id));
}

function useSeriesIdSet(
  queryKey: readonly unknown[],
  filter: "Likes" | "IsFavorite",
): { has: (seriesId?: string) => boolean } {
  const client = useJellyfinClient();
  const userId = useUserId();

  const { data } = useQuery({
    queryKey,
    queryFn: () => fetchSeriesIds(client, userId!, filter),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const set = useMemo(() => new Set(data ?? []), [data]);
  return { has: (seriesId?: string) => !!seriesId && set.has(seriesId) };
}

/**
 * Id de la SÉRIE dont l'appartenance pilote l'état affiché pour cet item, ou
 * `undefined` quand l'item répond de lui-même (film).
 *
 * Un épisode reflète sa série parente — c'est la règle produit : Ma liste et
 * Favoris agissent au niveau série. Une SÉRIE reflète... elle-même, et ce
 * détour n'est pas une coquetterie : la vignette « +N nouveaux épisodes » des
 * derniers ajouts est fabriquée côté client (`groupLatestByRuns`) à partir
 * d'épisodes, sans le `UserData` de la série. Lire `item.UserData.Likes` sur
 * cette tuile ne renvoyait donc jamais rien, et l'ajout à Ma liste n'y était
 * jamais visible. Le Set, lui, est complet et patché à la mutation.
 */
export function seriesStateId(item: MediaItem): string | undefined {
  if (item.Type === "Episode") return item.SeriesId;
  if (item.Type === "Series") return item.Id;
  return undefined;
}

/** Séries présentes dans « Ma liste » (Likes). */
export function useWatchlistSeriesIds() {
  return useSeriesIdSet(WATCHLIST_SERIES_IDS_KEY, "Likes");
}

/** Séries présentes dans « Favoris » (IsFavorite). */
export function useFavoriteSeriesIds() {
  return useSeriesIdSet(FAVORITE_SERIES_IDS_KEY, "IsFavorite");
}
