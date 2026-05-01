import { memo } from "react";
import { View, Text } from "react-native";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { Colors, Typography } from "../../theme/colors";
import { CheckIcon } from "../icons/TVIcons";
import { TVCardImage } from "./TVCardImage";
import { TVCardProgressBar } from "./TVCardProgressBar";
import { TV_POSTER_WIDTH, TV_CARD_RADIUS, type TVCardSize } from "./cardSizes";

interface TVPosterCardProps {
  item: MediaItem;
  size?: TVCardSize;
}

/**
 * 2:3 portrait card — pure visual component.
 * Caller wraps it with `<Focusable variant="card">` to get focus border + glow + scale.
 *
 * Replaces the legacy `<TVMediaCard variant="portrait" />` with:
 *  - Larger default width (180 vs 160) for better TV legibility at 3m
 *  - Brand violet progress bar (was orange)
 *  - Inverted watched check (white circle + dark check) for a brand-coherent look
 *  - Episode-aware fallback image (uses series ID when applicable)
 */
export const TVPosterCard = memo(function TVPosterCard({
  item,
  size = "md",
}: TVPosterCardProps) {
  const client = useJellyfinClient();

  const isEpisode = item.Type === "Episode";
  const imageId = isEpisode && item.SeriesId ? item.SeriesId : item.Id;
  const imageUrl = client.getImageUrl(imageId, "Primary", { height: 360, quality: 85 });
  const watched = item.UserData?.Played === true;
  const progress = item.UserData?.PlayedPercentage;
  const width = TV_POSTER_WIDTH[size];

  return (
    <View style={{ width }}>
      <View
        style={{
          width,
          aspectRatio: 2 / 3,
          borderRadius: TV_CARD_RADIUS,
          overflow: "hidden",
          backgroundColor: Colors.bgCard,
        }}
      >
        <TVCardImage uri={imageUrl} style={{ width: "100%", height: "100%" }} />

        {watched && (
          <View
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: Colors.textPrimary,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <CheckIcon size={12} color={Colors.bgDeep} />
          </View>
        )}

        {!watched && <TVCardProgressBar percent={progress} />}
      </View>

      <Text
        numberOfLines={1}
        style={{ color: Colors.textSecondary, ...Typography.cardTitle, marginTop: 10 }}
      >
        {isEpisode ? (item.SeriesName ?? item.Name) : item.Name}
      </Text>
      {item.ProductionYear && (
        <Text style={{ color: Colors.textTertiary, ...Typography.caption, marginTop: 2 }}>
          {item.ProductionYear}
        </Text>
      )}
    </View>
  );
});
