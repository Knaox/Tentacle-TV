import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { tentacleApiFetch } from "./usePreferences";
import { useMyRatings } from "./useRatings";
import type { RatingIdentity, UserRatingEntry } from "./useRatings";

/** Note TMDB d'un épisode (moyenne sur 10, null sans vote). */
export interface TmdbEpisodeRating {
  episodeNumber: number;
  voteAverage: number | null;
  voteCount: number;
}

interface SeasonEpisodesResponse {
  tmdbId: number;
  seasonNumber: number;
  episodes: TmdbEpisodeRating[];
}

export const TMDB_SEASON_KEY = "tmdb-season";
/** Une journée, comme le serveur : les votes d'un épisode bougent lentement. */
const SEASON_STALE_MS = 24 * 3600_000;
const EMPTY: ReadonlyMap<number, number> = new Map();

function isValidId(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
function isValidSeason(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * L'identité de notation d'un épisode : le tmdb de la SÉRIE (celui que porte
 * l'épisode dans ses ProviderIds est le sien, inutilisable pour la sync), plus
 * saison et numéro — la clé unique de user_ratings.
 */
export function episodeRatingIdentity(
  seriesTmdbId: number,
  seasonNumber: number,
  episodeNumber: number
): RatingIdentity {
  return { mediaType: "episode", tmdbId: seriesTmdbId, seasonNumber, episodeNumber };
}

/** Constante de module : `select` garde alors son résultat d'un rendu à l'autre. */
const selectByEpisode = (res: SeasonEpisodesResponse): ReadonlyMap<number, TmdbEpisodeRating> =>
  new Map(res.episodes.map((e) => [e.episodeNumber, e]));

/** Les notes TMDB des épisodes d'une saison, indexées par numéro d'épisode. */
export function useTmdbSeasonEpisodes(
  seriesTmdbId: number | null | undefined,
  seasonNumber: number | null | undefined
) {
  const enabled = isValidId(seriesTmdbId) && isValidSeason(seasonNumber);
  return useQuery({
    queryKey: [TMDB_SEASON_KEY, seriesTmdbId ?? 0, seasonNumber ?? -1],
    queryFn: () =>
      tentacleApiFetch<SeasonEpisodesResponse>(`/api/tmdb/tv/${seriesTmdbId}/season/${seasonNumber}/episodes`),
    enabled,
    staleTime: SEASON_STALE_MS,
    select: selectByEpisode,
  });
}

/** Index (numéro d'épisode → note) des notes du COMPTE pour une saison. Pur. */
export function episodeRatingsIndex(
  entries: readonly UserRatingEntry[] | undefined,
  seriesTmdbId: number,
  seasonNumber: number
): ReadonlyMap<number, number> {
  const map = new Map<number, number>();
  for (const r of entries ?? []) {
    if (r.mediaType !== "episode" || r.tmdbId !== seriesTmdbId || r.seasonNumber !== seasonNumber) continue;
    map.set(r.episodeNumber, r.score);
  }
  return map;
}

/**
 * Les notes du compte pour les épisodes d'une saison — UN abonnement à
 * `["ratings"]` pour toute la liste, jamais un par ligne (cf. HoverRatingStars :
 * un abonnement par tuile re-rendait toute la grille à chaque note).
 */
export function useMyEpisodeRatings(
  seriesTmdbId: number | null | undefined,
  seasonNumber: number | null | undefined
): ReadonlyMap<number, number> {
  const { data } = useMyRatings();
  return useMemo(
    () =>
      isValidId(seriesTmdbId) && isValidSeason(seasonNumber)
        ? episodeRatingsIndex(data, seriesTmdbId, seasonNumber)
        : EMPTY,
    [data, seriesTmdbId, seasonNumber]
  );
}
