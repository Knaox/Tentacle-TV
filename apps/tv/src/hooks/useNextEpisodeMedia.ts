import { useEpisodeNavigation, useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * Ce qu'il faut MONTRER de l'épisode suivant — titres et images, rien d'autre.
 *
 * Ce fichier est ce qui reste de `useAutoPlay` : son moteur (seuil de
 * déclenchement, minuteur, escalade bannière → écran de fin, refus mémorisé)
 * a rejoint les réducteurs partagés (`packages/shared/src/playback`), lus par
 * l'arbitre unique. Il ne restait ici que la fabrique d'URL d'images et les
 * libellés, qui sont bien de la TV.
 */
export interface NextEpisodeMedia {
  nextEpisode: MediaItem | null;
  nextEpisodeTitle: string | undefined;
  nextEpisodeImageUrl: string | undefined;
  nextEpisodeDescription: string | undefined;
  /** Overview complet (l'écran plein clampe à 3 lignes au rendu). */
  nextEpisodeOverview: string | undefined;
  /** Backdrop de la SÉRIE (fond plein écran de l'écran de fin). */
  seriesBackdropUrl: string | undefined;
  /** Primary de l'épisode suivant (vignette de l'écran de fin). */
  nextEpisodeThumbUrl: string | undefined;
}

export function useNextEpisodeMedia(item: MediaItem | undefined): NextEpisodeMedia {
  const client = useJellyfinClient();
  const { nextEpisode } = useEpisodeNavigation(item);

  const nextEpisodeTitle = nextEpisode
    ? `S${nextEpisode.ParentIndexNumber}E${nextEpisode.IndexNumber} — ${nextEpisode.Name}`
    : undefined;

  const nextEpisodeImageUrl = nextEpisode?.Id
    ? client.getImageUrl(nextEpisode.Id, "Primary", { height: 200, quality: 85 })
    : undefined;

  const nextEpisodeDescription = nextEpisode?.Overview
    ? (nextEpisode.Overview.length > 120
      ? nextEpisode.Overview.slice(0, 120) + "..."
      : nextEpisode.Overview)
    : undefined;

  // Images de l'écran de fin plein écran (parité WatchDesktop) : backdrop de la
  // SÉRIE en fond + Primary de l'épisode suivant en vignette.
  const seriesBackdropUrl = nextEpisode
    ? client.getImageUrl(
      nextEpisode.SeriesId ?? nextEpisode.ParentBackdropItemId ?? nextEpisode.Id,
      "Backdrop",
      { width: 1920, quality: 85 },
    )
    : undefined;
  const nextEpisodeThumbUrl = nextEpisode?.Id
    ? client.getImageUrl(nextEpisode.Id, "Primary", { width: 500, quality: 90 })
    : undefined;

  return {
    nextEpisode,
    nextEpisodeTitle,
    nextEpisodeImageUrl,
    nextEpisodeDescription,
    nextEpisodeOverview: nextEpisode?.Overview ?? undefined,
    seriesBackdropUrl,
    nextEpisodeThumbUrl,
  };
}
