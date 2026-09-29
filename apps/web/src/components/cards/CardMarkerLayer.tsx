import { memo } from "react";
import { useCardMarkers } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { CardRatingBadge } from "./CardRatingBadge";
import { CardStatusMarkers } from "./CardStatusMarkers";
import { useCardDeviceState } from "../../downloads/useDeviceState";

interface CardMarkerLayerProps {
  item: MediaItem;
  /** Note globale à poser (`cardRatingFor(...).rating`). */
  communityRating: number | null;
  /** Ce que la carte montre : la série (affiche) ou l'item (vignette 16:9). */
  scope?: "item" | "series";
  /** La note s'efface (survol, focus sur téléviseur). */
  hideRating?: boolean;
  /** La pastille d'états s'efface (le plateau du survol la reprend). */
  hideStatus?: boolean;
  /** Ma liste dite par l'appelant : un titre hors bibliothèque mis de côté jusqu'à son arrivée. */
  inWatchlist?: boolean;
  /** Le cœur dit par l'appelant : un titre hors bibliothèque aimé en attendant son arrivée. */
  isFavorite?: boolean;
  ratingClassName?: string;
  statusClassName?: string;
}

/**
 * Les marqueurs d'une carte au repos — note en bas à gauche, états en haut à
 * droite, et, sur le bureau, « sur cette machine » au bout de la pastille.
 * Le fond vient de `useCardMarkers` (modèle partagé par toutes les
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
  inWatchlist,
  isFavorite,
  ratingClassName,
  statusClassName,
}: CardMarkerLayerProps) {
  const device = useCardDeviceState(item);
  const markers = useCardMarkers(item, { communityRating, scope, inWatchlist, isFavorite, device });
  return (
    <>
      <CardRatingBadge
        rating={markers.communityRating}
        userScore={markers.userScore}
        shown={!hideRating}
        className={ratingClassName}
      />
      <CardStatusMarkers statuses={markers.statuses} device={markers.device} shown={!hideStatus} className={statusClassName} />
    </>
  );
});
