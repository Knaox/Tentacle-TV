import type { MediaItem } from "@tentacle-tv/shared";
import { episodeRatingIdentity } from "@tentacle-tv/api-client";
import type { RatingIdentity } from "@tentacle-tv/api-client";

/** Le tmdbId d'un item, s'il en porte un exploitable (> 0). */
export function tmdbIdForItem(item: MediaItem | null | undefined): number | null {
  const raw = item?.ProviderIds?.Tmdb;
  if (!raw) return null;
  const tmdbId = Number(raw);
  return Number.isFinite(tmdbId) && tmdbId > 0 ? tmdbId : null;
}

/**
 * L'identité de notation d'un item Jellyfin — la clé canonique (mediaType,
 * tmdbId) du moteur. Rend null quand l'item n'est pas notable : pas de tmdbId
 * dans ses ProviderIds, ou un type hors film/série. Un épisode ne se note pas
 * depuis une CARTE (son tmdb est le sien, pas celui de la série) : là où le
 * contexte série est connu — liste des saisons, fiche d'épisode, lecteur —
 * c'est `episodeRatingIdentityFor` qui le rend notable.
 */
export function ratingIdentityForItem(item: MediaItem): RatingIdentity | null {
  const tmdbId = tmdbIdForItem(item);
  if (!tmdbId) return null;
  if (item.Type === "Movie") return { mediaType: "movie", tmdbId };
  if (item.Type === "Series") return { mediaType: "series", tmdbId };
  return null;
}

/**
 * L'identité d'un ÉPISODE : le tmdb de la SÉRIE (celui que l'épisode porte
 * dans ses ProviderIds est celui de l'épisode, inutilisable pour la sync),
 * plus saison et numéro. Null sans l'un des trois.
 */
export function episodeRatingIdentityFor(
  episode: MediaItem,
  seriesTmdbId: number | null
): RatingIdentity | null {
  if (episode.Type !== "Episode" || !seriesTmdbId) return null;
  if (episode.ParentIndexNumber == null || episode.IndexNumber == null) return null;
  return episodeRatingIdentity(seriesTmdbId, episode.ParentIndexNumber, episode.IndexNumber);
}

/**
 * Le tvdbId de l'item, s'il en porte un : transmis à la notation pour ancrer
 * le mapping AniList des séries (la table Fribb pivote sur thetvdb_id).
 */
export function tvdbIdForItem(item: MediaItem): number | null {
  const raw = item.ProviderIds?.Tvdb;
  if (!raw) return null;
  const tvdbId = Number(raw);
  return Number.isFinite(tvdbId) && tvdbId > 0 ? tvdbId : null;
}
