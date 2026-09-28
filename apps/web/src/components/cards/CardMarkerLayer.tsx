import { memo } from "react";
import { useCardMarkers } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { CardRatingBadge } from "./CardRatingBadge";
import { CardStatusMarkers } from "./CardStatusMarkers";

interface CardMarkerLayerProps {
  item: MediaItem;
  /** Note globale à poser (`cardRatingFor(...).rating`). */
  communityRating: number | null;
  /** Ce que la carte montre : la série (affiche) ou l'item (vignette 16:9). */
  scope?: "item" | "series";
  /** La note s'efface (survol, panneau d'aperçu). */
  hideRating?: boolean;
  /** La pastille d'états s'efface (le plateau du survol la reprend). */
  hideStatus?: boolean;
  ratingClassName?: string;
  statusClassName?: string;
}

/**
 * Les marqueurs d'une carte au repos — note en bas à gauche, états en haut à
 * droite. Le fond vient de `useCardMarkers` (modèle partagé par toutes les
 * plateformes), la forme de `CardRatingBadge` et `CardStatusMarkers`.
 *
 * `memo` : la carte parente se re-rend à chaque survol ; les marqueurs, eux,
 * ne bougent que si l'item ou un état change.
 */
export const CardMarkerLayer = memo(function CardMarkerLayer({
  item,
  communityRating,
  scope = "series",
  hideRating = false,
  hideStatus = false,
  ratingClassName,
  statusClassName,
}: CardMarkerLayerProps) {
  const markers = useCardMarkers(item, { communityRating, scope });
  return (
    <>
      <CardRatingBadge
        rating={markers.communityRating}
        userScore={markers.userScore}
        shown={!hideRating}
        className={ratingClassName}
      />
      <CardStatusMarkers statuses={markers.statuses} shown={!hideStatus} className={statusClassName} />
    </>
  );
});
