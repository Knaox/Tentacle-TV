/**
 * Épisode précédent / suivant parmi les TÉLÉCHARGEMENTS — logique pure.
 *
 * En ligne, `useEpisodeNavigation` interroge Jellyfin pour toute la série. Sans
 * serveur, la seule liste disponible — et la seule pertinente, puisqu'un
 * épisode non téléchargé serait de toute façon illisible — est celle des
 * téléchargements du compte. La navigation traverse les saisons, comme en
 * ligne : le dernier épisode d'une saison enchaîne sur le premier de la
 * suivante s'il est là.
 *
 * Fichier SANS import React ni `main` : testable en environnement Node.
 */

import type { MediaItem } from "@tentacle-tv/shared";
import type { DownloadEntry } from "./api";
import { byEpisodeNumber } from "./offlineGroups";

export interface LocalEpisodeNavigation {
  previousEpisode: MediaItem | null;
  nextEpisode: MediaItem | null;
}

function sameSeries(a: DownloadEntry, b: DownloadEntry): boolean {
  if (a.seriesId && b.seriesId) return a.seriesId === b.seriesId;
  return (a.seriesName ?? "") === (b.seriesName ?? "");
}

/**
 * `DownloadEntry` → `MediaItem` minimal : de quoi alimenter le titre, le code
 * SxxEyy et la navigation. Le synopsis vient du snapshot local, lu à part par
 * l'écran de fin (il n'est pas dénormalisé en base).
 */
function toMediaItem(entry: DownloadEntry): MediaItem {
  return {
    Id: entry.itemId,
    Name: entry.title ?? "",
    Type: "Episode",
    SeriesName: entry.seriesName ?? undefined,
    SeriesId: entry.seriesId ?? undefined,
    SeasonId: entry.seasonId ?? undefined,
    IndexNumber: entry.indexNumber ?? undefined,
    ParentIndexNumber: entry.parentIndexNumber ?? undefined,
    RunTimeTicks: entry.runtimeTicks ?? undefined,
  };
}

/** Épisodes adjacents parmi les téléchargements COMPLETS de la même série. */
export function findAdjacentLocalEpisodes(
  entries: DownloadEntry[],
  itemId: string | undefined,
): LocalEpisodeNavigation {
  const none: LocalEpisodeNavigation = { previousEpisode: null, nextEpisode: null };
  if (!itemId) return none;

  const episodes = entries.filter((e) => e.status === "complete" && e.kind === "episode");
  const current = episodes.find((e) => e.itemId === itemId);
  if (!current) return none;

  const siblings = episodes.filter((e) => sameSeries(e, current)).sort(byEpisodeNumber);
  const index = siblings.findIndex((e) => e.itemId === itemId);
  if (index < 0) return none;

  return {
    previousEpisode: index > 0 ? toMediaItem(siblings[index - 1]) : null,
    nextEpisode: index < siblings.length - 1 ? toMediaItem(siblings[index + 1]) : null,
  };
}
