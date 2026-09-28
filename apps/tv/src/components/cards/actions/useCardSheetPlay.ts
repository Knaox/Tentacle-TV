import { useSeriesWatchState } from "@tentacle-tv/api-client";
import { formatEpisodeCode, formatPosition, type MediaItem } from "@tentacle-tv/shared";

/** Ce qui se lance tel quel. Une série passe par son épisode à suivre ;
 *  une collection, une saison, un dossier ne se lancent pas d'une carte. */
const PLAYABLE_TYPES = new Set(["Movie", "Episode", "Video", "MusicVideo"]);

export interface CardSheetPlay {
  /** Lecture entamée (film, épisode) ou épisode entamé (série) : « Reprendre ». */
  resume: boolean;
  /** Le complément du bouton : l'épisode d'une série (S02E05), la position
   *  d'une reprise (12:34). */
  detail: string | null;
  /** L'item à lancer — `null` tant que l'épisode d'une série se résout : le
   *  geste le résout alors lui-même (`useResolvePlayTarget`). */
  itemId: string | null;
}

/**
 * La lecture qu'offre la feuille, `null` quand rien ne se lance.
 *
 * Une SÉRIE ne se lit pas telle quelle : l'épisode à reprendre ou à suivre
 * vient de `useSeriesWatchState` — la clé de la fiche, que la feuille
 * préchauffe au passage. Série terminée : pas de bouton, comme sur la fiche.
 * La requête ne part que feuille ouverte : une par appui long, jamais une par
 * carte.
 */
export function useCardSheetPlay(face: MediaItem | null): CardSheetPlay | null {
  const isSeries = face?.Type === "Series";
  const { data: state } = useSeriesWatchState(isSeries ? face?.Id : undefined);

  if (!face) return null;
  if (isSeries) {
    // En résolution (ou en échec) : le bouton est là, le geste résoudra.
    if (!state) return { resume: false, detail: null, itemId: null };
    if (state.type === "completed") return null;
    const episode = state.episode;
    return {
      resume: state.type === "continue",
      detail: formatEpisodeCode(episode.ParentIndexNumber, episode.IndexNumber, { style: "padded" }),
      itemId: episode.Id,
    };
  }
  if (!PLAYABLE_TYPES.has(face.Type)) return null;
  const ticks = face.UserData?.PlaybackPositionTicks ?? 0;
  const resume = ticks > 0 && face.UserData?.Played !== true;
  return { resume, detail: resume ? formatPosition(ticks) : null, itemId: face.Id };
}
