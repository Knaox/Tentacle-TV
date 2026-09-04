import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMediaItem, useSeriesWatchState } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { playMediaId, resolveRecoPlayTarget, type RecoPlayResolution } from "./recoPlayTarget";

export interface RecoPlayTarget extends RecoPlayResolution {
  /** Libellé complet, traduit : « Reprendre S2 · E5 », « Lecture S1 · E1 », « Reprendre », « Lecture ». */
  label: string;
  /**
   * Porte MediaSources — le film, ou l'épisode qui va être lu — pour les chips
   * qualité et langues ; undefined tant que rien n'est chargé.
   */
  media: MediaItem | undefined;
}

/**
 * Cible du bouton Lecture d'une carte de recommandation, résolue AU SURVOL.
 *
 * À n'appeler QUE depuis un composant monté au survol (RecoCardHoverLayer) :
 * le montage est la porte, pas un `enabled`. Au niveau carte, quatre-vingts
 * affiches au repos porteraient chacune deux observateurs, notifiés par la
 * moindre invalidation `["item"]`. Deux requêtes chaînées pour une série
 * (l'état de visionnage, puis l'épisode à lancer), une seule pour un film —
 * sur les clés `["series-watch-state", id]` et `["item", id]` de la fiche et
 * du lecteur : le survol préchauffe leur cache.
 *
 * Hors bibliothèque (`jellyfinItemId` nul) : rien, et aucune requête.
 */
export function useRecoPlayTarget(
  jellyfinItemId: string | null,
  mediaType: "movie" | "tv",
): RecoPlayTarget | null {
  const seriesId = mediaType === "tv" ? (jellyfinItemId ?? undefined) : undefined;
  const { data: watchState, isError: watchFailed } = useSeriesWatchState(seriesId);
  const mediaId = jellyfinItemId ? playMediaId(jellyfinItemId, mediaType, watchState) : undefined;
  const { data: media } = useMediaItem(mediaId);
  const { t } = useTranslation("common");

  return useMemo(() => {
    if (!jellyfinItemId) return null;
    const resolution = resolveRecoPlayTarget({ jellyfinItemId, mediaType, watchState, watchFailed, media });
    const label = [t(resolution.labelKey), resolution.episodeCode].filter(Boolean).join(" ");
    return { ...resolution, label, media };
  }, [jellyfinItemId, mediaType, watchState, watchFailed, media, t]);
}
