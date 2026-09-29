import { useQuery } from "@tanstack/react-query";
import { resolveCardMarkers, type CardDeviceState, type CardMarkers, type MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import { tentacleApiFetch } from "./usePreferences";
import { hasRatingsSession, ratingKey, type UserRatingEntry } from "./useRatings";
import { fetchSeriesIds, seriesStateId } from "./useSeriesListMembership";
import { FAVORITE_SERIES_IDS_KEY, WATCHLIST_SERIES_IDS_KEY } from "./watchlistEffects";

/**
 * Les marqueurs d'une carte (note, ma liste, favori, vu), prêts à rendre.
 *
 * Chaque carte s'abonne à trois requêtes PARTAGÉES — les deux Sets de séries
 * et la liste des notes du compte — mais à travers un `select` qui ne rend
 * qu'un booléen ou un nombre. TanStack Query compare ce résultat et ne
 * réveille la carte que s'il change : noter un titre ou l'ajouter à Ma liste
 * re-rend UNE carte, pas les quatre-vingts de l'accueil. C'est ce qui a permis
 * de monter ces marqueurs au repos, là où `CardQuickActions` (qui lit les Sets
 * entiers) doit rester monté au survol seulement.
 *
 * Les index (Set d'ids, Map de notes) sont construits UNE fois par version des
 * données, pas une fois par carte : `WeakMap` indexée sur le tableau du cache.
 */

const idSets = new WeakMap<readonly string[], Set<string>>();

function idSet(ids: readonly string[]): Set<string> {
  let set = idSets.get(ids);
  if (!set) {
    set = new Set(ids);
    idSets.set(ids, set);
  }
  return set;
}

interface RatingIndex {
  byKey: Map<string, number>;
  byItemId: Map<string, number>;
}

const ratingIndexes = new WeakMap<readonly UserRatingEntry[], RatingIndex>();

function ratingIndex(entries: readonly UserRatingEntry[]): RatingIndex {
  let index = ratingIndexes.get(entries);
  if (!index) {
    index = { byKey: new Map(), byItemId: new Map() };
    for (const entry of entries) {
      // Un retrait en cours de synchronisation n'est plus une note.
      if (entry.syncStatus === "delete_pending") continue;
      index.byKey.set(ratingKey(entry), entry.score);
      if (entry.jellyfinItemId) index.byItemId.set(entry.jellyfinItemId, entry.score);
    }
    ratingIndexes.set(entries, index);
  }
  return index;
}

/**
 * La note de l'utilisateur pour ce que la carte MONTRE.
 *
 * `series` (affiche 2:3) : un épisode y est le visage de sa série — même règle
 * que `cardRatingFor`. La série se retrouve par son identifiant Jellyfin, que
 * la note enregistre ; un épisode ne porte pas le tmdb de sa série.
 * `item` (vignette 16:9) : la note de l'item lui-même.
 * Film et série se retrouvent AUSSI par leur tmdb : une note posée depuis la
 * page de recommandations n'a pas toujours d'identifiant Jellyfin.
 */
function scoreFor(index: RatingIndex, item: MediaItem, scope: "item" | "series"): number | null {
  const faceId = scope === "series" && item.Type === "Episode" ? item.SeriesId : item.Id;
  const byItem = faceId ? index.byItemId.get(faceId) : undefined;
  if (byItem !== undefined) return byItem;
  const tmdbId = Number(item.ProviderIds?.Tmdb);
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) return null;
  const mediaType = item.Type === "Movie" ? "movie" : item.Type === "Series" ? "series" : null;
  if (!mediaType) return null;
  return index.byKey.get(ratingKey({ mediaType, tmdbId })) ?? null;
}

/** Pur, pour les tests : la note de l'utilisateur lue dans la liste du compte. */
export function userScoreFromRatings(
  entries: readonly UserRatingEntry[],
  item: MediaItem,
  scope: "item" | "series" = "series",
): number | null {
  return scoreFor(ratingIndex(entries), item, scope);
}

export interface CardMarkersOptions {
  /** Note globale à afficher (`cardRatingFor(...).rating`). */
  communityRating: number | null;
  /** Ce que la carte montre — cf. `scoreFor`. Défaut : `series`. */
  scope?: "item" | "series";
  /** `false` : aucune requête (catalogue hors ligne, bancs). Les états de `UserData` restent lus. */
  enabled?: boolean;
  /**
   * Ma liste dite par l'appelant — un titre hors bibliothèque mis de côté
   * jusqu'à son arrivée (`useIsWatchlistPending`), qu'aucun cache Jellyfin ne
   * connaît. Absent : les Sets et le `UserData` répondent.
   */
  inWatchlist?: boolean;
  /**
   * Le cœur dit par l'appelant — un titre hors bibliothèque aimé en attendant
   * son arrivée (`useIsFavoritePending`). Absent : les Sets et le `UserData`.
   */
  isFavorite?: boolean;
  /**
   * « Sur cet appareil » — lu par la plateforme qui garde hors ligne (bureau,
   * mobile) dans SA liste locale (`cardDeviceState`, offline-core). Absent :
   * rien à dire (web, TV, carte déjà lue sur le disque).
   */
  device?: CardDeviceState | null;
}

export function useCardMarkers(item: MediaItem, options: CardMarkersOptions): CardMarkers {
  const client = useJellyfinClient();
  const userId = useUserId();
  const enabled = options.enabled ?? true;
  const scope = options.scope ?? "series";
  const seriesId = seriesStateId(item);
  const membershipEnabled = enabled && !!userId && !!seriesId;

  // Mêmes clés, même `queryFn` et même `staleTime` que `useSeriesIdSet` : un
  // seul cache, patché par les mutations de Ma liste et des favoris.
  const { data: inWatchlist } = useQuery({
    queryKey: WATCHLIST_SERIES_IDS_KEY,
    queryFn: () => fetchSeriesIds(client, userId!, "Likes"),
    enabled: membershipEnabled,
    staleTime: 60_000,
    select: (ids: string[]) => idSet(ids).has(seriesId!),
  });
  const { data: isFavorite } = useQuery({
    queryKey: FAVORITE_SERIES_IDS_KEY,
    queryFn: () => fetchSeriesIds(client, userId!, "IsFavorite"),
    enabled: membershipEnabled,
    staleTime: 60_000,
    select: (ids: string[]) => idSet(ids).has(seriesId!),
  });
  // Mêmes clé et options que `useMyRatings` — la liste entière, un cache.
  const { data: userScore } = useQuery({
    queryKey: ["ratings"],
    queryFn: () => tentacleApiFetch<UserRatingEntry[]>("/api/ratings"),
    staleTime: 60_000,
    enabled: enabled && hasRatingsSession(),
    select: (entries: UserRatingEntry[]) => scoreFor(ratingIndex(entries), item, scope),
  });

  return resolveCardMarkers({
    item,
    communityRating: options.communityRating,
    userScore: userScore ?? null,
    // Pas de série (film) ou Set pas encore chargé : `UserData` répond.
    inWatchlist: options.inWatchlist ?? (seriesId ? inWatchlist : undefined),
    isFavorite: options.isFavorite ?? (seriesId ? isFavorite : undefined),
    device: options.device,
  });
}
