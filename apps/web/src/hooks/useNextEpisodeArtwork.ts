/**
 * Visuels et résumé de l'ÉPISODE SUIVANT (bannière auto-next + affiche de fin).
 *
 * En streaming, tout vient de Jellyfin. En lecture LOCALE (zéro réseau, même
 * en ligne) ou hors ligne, tout vient du disque : l'épisode suivant proposé
 * est alors forcément téléchargé (navigation locale), ses visuels et son
 * synopsis sont dans son snapshot.
 *
 * Extrait de WatchDesktop (limite de 300 lignes par fichier).
 */

import { useMemo } from "react";
import type { JellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { localResourceUrl, useDownloadsRootReady } from "../downloads/localFiles";
import { useLocalSnapshot } from "../downloads/useLocalSnapshot";
import { stripOverviewHtml } from "../lib/overviewHtml";

const MAX_DESCRIPTION = 300;

export interface NextEpisodeArtwork {
  /** Fond immersif de la bannière auto-next. */
  imageUrl: string | undefined;
  /** Fond de l'affiche de fin : bannière de la SÉRIE de préférence. */
  seriesBackdropUrl: string | undefined;
  /** Vignette de l'épisode. */
  thumbUrl: string | undefined;
  description: string | undefined;
}

export function useNextEpisodeArtwork(
  nextEpisode: MediaItem | null | undefined,
  client: JellyfinClient,
  /** Servir depuis le disque : lecture locale (zéro réseau) OU hors ligne. */
  useLocalArtwork: boolean,
): NextEpisodeArtwork {
  const rootReady = useDownloadsRootReady();
  const nextId = nextEpisode?.Id;
  // En local, le synopsis n'est pas dénormalisé en base : il vit dans le
  // snapshot du prochain épisode.
  const snapshot = useLocalSnapshot(useLocalArtwork ? nextId : undefined, "item.json", rootReady);

  return useMemo(() => {
    if (!nextId) {
      return { imageUrl: undefined, seriesBackdropUrl: undefined, thumbUrl: undefined, description: undefined };
    }

    const rawOverview = useLocalArtwork ? snapshot?.Overview : nextEpisode?.Overview;
    const text = rawOverview ? stripOverviewHtml(rawOverview) : undefined;
    // stripOverviewHtml AVANT le découpage : couper du HTML brut sectionnerait
    // une balise.
    const description = text
      ? (text.length > MAX_DESCRIPTION ? `${text.slice(0, MAX_DESCRIPTION)}…` : text)
      : undefined;

    if (useLocalArtwork) {
      const backdrop = rootReady ? localResourceUrl(`meta/${nextId}/backdrop.jpg`) ?? undefined : undefined;
      const primary = rootReady ? localResourceUrl(`meta/${nextId}/primary.jpg`) ?? undefined : undefined;
      return {
        imageUrl: backdrop ?? primary,
        seriesBackdropUrl: backdrop ?? primary,
        thumbUrl: primary ?? backdrop,
        description,
      };
    }

    const hasOwnBackdrop = (nextEpisode?.BackdropImageTags?.length ?? 0) > 0;
    const hasParentBackdrop = (nextEpisode?.ParentBackdropImageTags?.length ?? 0) > 0;
    const isEpisode = nextEpisode?.Type === "Episode";
    const backdropId = isEpisode
      ? (hasOwnBackdrop ? nextId : (nextEpisode?.ParentBackdropItemId ?? nextEpisode?.SeriesId ?? nextId))
      : nextId;
    const imageType = hasOwnBackdrop || hasParentBackdrop ? "Backdrop" : "Primary";
    const imageUrl = client.getImageUrl(backdropId, imageType, { width: 1920, quality: 85 });

    const seriesId = nextEpisode?.SeriesId ?? nextEpisode?.ParentBackdropItemId;
    const seriesBackdropUrl = seriesId
      ? client.getImageUrl(seriesId, "Backdrop", { width: 1920, quality: 85 })
      : hasOwnBackdrop
        ? client.getImageUrl(nextId, "Backdrop", { width: 1920, quality: 85 })
        : imageUrl;

    return {
      imageUrl,
      seriesBackdropUrl,
      thumbUrl: client.getImageUrl(nextId, "Primary", { width: 500, quality: 90 }),
      description,
    };
  }, [nextId, nextEpisode, client, useLocalArtwork, snapshot, rootReady]);
}
