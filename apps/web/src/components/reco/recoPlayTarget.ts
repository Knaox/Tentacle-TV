import type { MediaItem, NextEpisodeResult } from "@tentacle-tv/shared";
import { formatEpisodeCode } from "@tentacle-tv/shared";

export type RecoPlayKind = "resume" | "start" | "next" | "detail";

export interface RecoPlayResolution {
  /**
   * `/watch/{id}` — ou `/media/{seriesId}` quand rien n'est lançable : série
   * terminée, état encore en vol, erreur réseau. Ouvrir la fiche vaut mieux
   * que lancer un épisode au hasard (même repli que PosterTile).
   */
  path: string;
  kind: RecoPlayKind;
  labelKey: "common:resume" | "common:play";
  /** « S2 · E5 », le format des boutons Reprendre — null pour un film. */
  episodeCode: string | null;
  /** Série dont l'état est encore en vol : bouton rendu, un clic ouvre la fiche. */
  pending: boolean;
}

/**
 * Même seuil que la fiche (DetailActions) : Jellyfin rend couramment 99,4 % sur
 * un média vu jusqu'au générique — au-delà, il ne reste rien à reprendre.
 */
export const RESUME_MAX_PERCENT = 99;

export function hasMovieResume(media: MediaItem | undefined): boolean {
  const percent = media?.UserData?.PlayedPercentage;
  return percent != null && percent > 0 && percent < RESUME_MAX_PERCENT;
}

/**
 * L'item dont on lit MediaSources (qualité, langues) et UserData (reprise) : le
 * film lui-même, ou l'épisode que la série va lancer — rien tant que la série
 * n'est pas résolue, rien non plus quand elle est terminée.
 */
export function playMediaId(
  jellyfinItemId: string,
  mediaType: "movie" | "tv",
  watchState: NextEpisodeResult | undefined,
): string | undefined {
  if (mediaType === "movie") return jellyfinItemId;
  if (!watchState || watchState.type === "completed") return undefined;
  return watchState.episode.Id;
}

/**
 * Où mène le bouton Lecture d'une carte de recommandation, et ce qu'il dit.
 *
 * Un film se lance toujours tel quel : le lecteur reprend seul à la position
 * mémorisée, le libellé ne fait que l'annoncer. Une série passe par son état
 * de visionnage : `continue` reprend l'épisode entamé, `next` et `start`
 * lancent le suivant — `start` étant le tout premier épisode.
 */
export function resolveRecoPlayTarget(input: {
  jellyfinItemId: string;
  mediaType: "movie" | "tv";
  watchState: NextEpisodeResult | undefined;
  watchFailed: boolean;
  media: MediaItem | undefined;
}): RecoPlayResolution {
  const { jellyfinItemId, mediaType, watchState, watchFailed, media } = input;

  if (mediaType === "movie") {
    const resume = hasMovieResume(media);
    return {
      path: `/watch/${jellyfinItemId}`,
      kind: resume ? "resume" : "start",
      labelKey: resume ? "common:resume" : "common:play",
      episodeCode: null,
      pending: false,
    };
  }

  const detail = (pending: boolean): RecoPlayResolution => ({
    path: `/media/${jellyfinItemId}`,
    kind: "detail",
    labelKey: "common:play",
    episodeCode: null,
    pending,
  });
  if (!watchState) return detail(!watchFailed);
  if (watchState.type === "completed") return detail(false);

  const episode = watchState.episode;
  const episodeCode = formatEpisodeCode(episode.ParentIndexNumber, episode.IndexNumber);
  const path = `/watch/${episode.Id}`;
  if (watchState.type === "continue") {
    return { path, kind: "resume", labelKey: "common:resume", episodeCode, pending: false };
  }
  return { path, kind: watchState.type, labelKey: "common:play", episodeCode, pending: false };
}
