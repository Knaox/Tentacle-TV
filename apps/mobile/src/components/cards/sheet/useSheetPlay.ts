import { useSeriesWatchState } from "@tentacle-tv/api-client";
import { formatEpisodeCode, type MediaItem } from "@tentacle-tv/shared";

/**
 * Ce qui se lance d'une carte : film, épisode, vidéo — et une série, par
 * l'épisode à reprendre ou à suivre. Une collection ou une saison ne se lance
 * pas : la feuille n'a pas de bouton Lecture.
 */
const PLAYABLE_TYPES = new Set(["Movie", "Episode", "Series", "Video", "MusicVideo"]);

export interface SheetPlay {
  /** Lecture entamée (film, épisode) ou épisode entamé (série) : « Reprendre ». */
  resume: boolean;
  /**
   * L'item à lancer. `null` : rien de lançable n'est résolu — série terminée,
   * ou son état encore en vol — et le bouton ouvre alors la fiche, comme le
   * survol web (`PosterTile`) : mieux qu'un épisode au hasard.
   */
  targetId: string | null;
  /** « S2 · E5 » — l'épisode qu'une série va lancer ; `null` sinon. */
  episodeCode: string | null;
  /** L'état de visionnage de la série se charge encore. */
  pending: boolean;
}

/**
 * Le bouton Lecture de la feuille — le bouton central du survol web. Une
 * série se résout ICI, à l'ouverture de la feuille seulement : une requête
 * par série (clé `series-watch-state`, celle de la fiche et du lecteur), que
 * la fiche retrouvera en cache.
 */
export function useSheetPlay(item: MediaItem | null): SheetPlay | null {
  const seriesId = item?.Type === "Series" ? item.Id : undefined;
  const { data: state, isError } = useSeriesWatchState(seriesId);
  if (!item || !PLAYABLE_TYPES.has(item.Type)) return null;

  if (!seriesId) {
    const percent = item.UserData?.PlayedPercentage ?? 0;
    return { resume: percent > 0 && item.UserData?.Played !== true, targetId: item.Id, episodeCode: null, pending: false };
  }

  const episode = state && state.type !== "completed" ? state.episode : null;
  return {
    resume: state?.type === "continue",
    targetId: episode?.Id ?? null,
    episodeCode: episode ? formatEpisodeCode(episode.ParentIndexNumber, episode.IndexNumber) : null,
    pending: !state && !isError,
  };
}
