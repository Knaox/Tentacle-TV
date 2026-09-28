import { memo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { useCardMarkers } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { TVCardRatingBadge } from "./TVCardRatingBadge";
import { TVCardStatusMarkers } from "./TVCardStatusMarkers";

interface Props {
  item: MediaItem;
  /** Note globale à poser (`cardRatingFor(...).rating`). */
  communityRating: number | null;
  /** Ce que la carte montre : la série (affiche) ou l'item (vignette d'épisode). */
  scope?: "item" | "series";
  /** La note cède sa place (puces qualité/langues au focus). */
  hideRating?: boolean;
  ratingStyle?: StyleProp<ViewStyle>;
  statusStyle?: StyleProp<ViewStyle>;
}

/**
 * Les marqueurs d'une carte du salon — note (globale + la vôtre) et pastille
 * d'états (Ma liste, favori, vu). Le fond vient de `useCardMarkers`, le même
 * modèle que le web et le mobile ; la forme de `TVCardRatingBadge` et
 * `TVCardStatusMarkers`. Seule la carte dont un état change se re-rend.
 */
export const TVCardMarkerLayer = memo(function TVCardMarkerLayer({
  item,
  communityRating,
  scope = "series",
  hideRating = false,
  ratingStyle,
  statusStyle,
}: Props) {
  const markers = useCardMarkers(item, { communityRating, scope });
  return (
    <>
      {!hideRating && (
        <TVCardRatingBadge rating={markers.communityRating} userScore={markers.userScore} style={ratingStyle} />
      )}
      <TVCardStatusMarkers statuses={markers.statuses} style={statusStyle} />
    </>
  );
});
