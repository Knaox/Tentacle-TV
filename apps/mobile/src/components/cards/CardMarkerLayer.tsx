import { memo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { useCardMarkers } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useCardDeviceState } from "@/hooks/offline/useDeviceState";
import { CardRatingBadge } from "./CardRatingBadge";
import { CardStatusMarkers } from "./CardStatusMarkers";

interface Props {
  item: MediaItem;
  /** Note globale à poser (`cardRatingFor(...).rating`). */
  communityRating: number | null;
  /** Ce que la carte montre : la série (affiche) ou l'item lui-même. */
  scope?: "item" | "series";
  /**
   * Une barre de progression occupe le bord inférieur : la note remonte
   * au-dessus d'elle au lieu de la chevaucher.
   */
  liftRating?: boolean;
  statusStyle?: StyleProp<ViewStyle>;
  /** Ma liste dite par l'appelant : un titre hors bibliothèque mis de côté jusqu'à son arrivée. */
  inWatchlist?: boolean;
}

/**
 * Les marqueurs d'une affiche — note (globale + la vôtre) en bas à gauche,
 * pastille d'états (Ma liste, favori, vu, sur cet appareil) en haut à droite.
 * Le fond vient de `useCardMarkers` (modèle partagé par toutes les
 * plateformes), qui ne réveille que la carte dont un état change.
 */
export const CardMarkerLayer = memo(function CardMarkerLayer({
  item,
  communityRating,
  scope = "series",
  liftRating = false,
  statusStyle,
  inWatchlist,
}: Props) {
  const device = useCardDeviceState(item);
  const markers = useCardMarkers(item, { communityRating, scope, inWatchlist, device });
  return (
    <>
      <CardRatingBadge
        rating={markers.communityRating}
        userScore={markers.userScore}
        style={liftRating ? LIFTED : undefined}
      />
      <CardStatusMarkers statuses={markers.statuses} device={markers.device} style={statusStyle} />
    </>
  );
});

const LIFTED = { bottom: 14 } as const;
