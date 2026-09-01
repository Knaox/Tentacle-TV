import { formatEpisodeCode } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { useMediaItem } from "./useLibrary";
import { useDeleteRating, useItemRating, useRateItem } from "./useRatings";
import type { RatingIdentity } from "./useRatings";

export interface EndCardRating {
  /** Note posée (1..10, écriture optimiste comprise), null sinon. */
  value: number | null;
  /** « S03E07 » — l'épisode NOTÉ (style padded), null si inconnu. */
  episodeCode: string | null;
  rate: (score: number) => void;
  clear: () => void;
}

/**
 * L'identité de notation de l'affiche de fin : l'ÉPISODE qu'on vient de finir.
 * L'affiche n'existe qu'à l'EOF d'un épisode au sein d'une série qui continue
 * (overlayArbiter, branche `nextCard final`) — jamais pour un film. Le tmdbId
 * stocké pour un épisode est celui de la SÉRIE (doctrine ratings + sync TMDB) :
 * il se lit sur la fiche série, chargée ici — celle de l'épisode ne le porte
 * pas de façon fiable. Identité incomplète (saison/épisode absents, série sans
 * tmdb) → null : pas d'étoiles, même doctrine que les cartes. RN-compatible :
 * tout passe par les hooks ratings existants (jeton via setPreferencesToken).
 */
export function useEndCardRating(
  episode: MediaItem | null | undefined,
  options?: { enabled?: boolean }
): EndCardRating | null {
  const enabled = options?.enabled ?? true;
  const isEpisode =
    enabled &&
    !!episode &&
    episode.Type === "Episode" &&
    !!episode.SeriesId &&
    episode.ParentIndexNumber != null &&
    episode.IndexNumber != null;
  const series = useMediaItem(isEpisode ? episode.SeriesId : undefined, { enabled: isEpisode });

  const seriesTmdbRaw = series.data?.ProviderIds?.Tmdb;
  const seriesTmdbId = seriesTmdbRaw ? Number(seriesTmdbRaw) : NaN;
  const tvdbRaw = series.data?.ProviderIds?.Tvdb;
  const tvdbNum = tvdbRaw ? Number(tvdbRaw) : NaN;
  const tvdbId = Number.isFinite(tvdbNum) && tvdbNum > 0 ? tvdbNum : null;

  const identity: RatingIdentity | null =
    isEpisode && Number.isFinite(seriesTmdbId) && seriesTmdbId > 0
      ? {
          mediaType: "episode",
          tmdbId: seriesTmdbId,
          seasonNumber: episode.ParentIndexNumber ?? 0,
          episodeNumber: episode.IndexNumber ?? 0,
        }
      : null;

  const current = useItemRating(identity);
  const rateItem = useRateItem();
  const deleteRating = useDeleteRating();

  if (!identity || !episode) return null;

  return {
    value: current?.score ?? null,
    episodeCode: formatEpisodeCode(episode.ParentIndexNumber, episode.IndexNumber, {
      style: "padded",
    }),
    rate: (score: number) =>
      rateItem.mutate({ ...identity, score, tvdbId, jellyfinItemId: episode.Id ?? null }),
    clear: () => deleteRating.mutate(identity),
  };
}
