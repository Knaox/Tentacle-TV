import { memo } from "react";
import { View, Text } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { ticksToSeconds } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { Colors, Typography } from "../../theme/colors";
import { TVCardImage } from "./TVCardImage";
import { TVCardProgressBar } from "./TVCardProgressBar";
import { TV_EPISODE_WIDTH, TV_CARD_RADIUS, type TVCardSize } from "./cardSizes";

interface TVEpisodeCardProps {
  item: MediaItem;
  size?: TVCardSize;
}

/**
 * 16:9 landscape card for "Reprendre" / "Prochains épisodes" rows.
 * Shows the actual scene (backdrop), the SxxExx label, and the watch progress.
 * Pure visual — wrap with `<Focusable variant="card">` at call site.
 *
 * Replaces `<TVMediaCard variant="landscape" />` with brand-violet progress
 * (was orange) and tighter typography on the overlay.
 */
export const TVEpisodeCard = memo(function TVEpisodeCard({
  item,
  size = "md",
}: TVEpisodeCardProps) {
  const client = useJellyfinClient();
  const isEpisode = item.Type === "Episode";
  const width = TV_EPISODE_WIDTH[size];

  // For episodes prefer the episode's own thumbnail; fallback to backdrop.
  const imageType = isEpisode ? "Primary" : "Backdrop";
  const imageUrl = client.getImageUrl(item.Id, imageType, { width: 540, quality: 80 });

  const watched = item.UserData?.Played === true;
  const progress = item.UserData?.PlayedPercentage ?? 0;

  const epLabel = isEpisode && item.ParentIndexNumber != null && item.IndexNumber != null
    ? `S${String(item.ParentIndexNumber).padStart(2, "0")}E${String(item.IndexNumber).padStart(2, "0")}`
    : null;

  const remainingTicks = item.RunTimeTicks && progress > 0
    ? item.RunTimeTicks * (1 - progress / 100)
    : null;
  const remainingMin = remainingTicks ? Math.round(ticksToSeconds(remainingTicks) / 60) : null;

  return (
    <View style={{ width }}>
      <View
        style={{
          width,
          aspectRatio: 16 / 9,
          borderRadius: TV_CARD_RADIUS,
          overflow: "hidden",
          backgroundColor: Colors.bgCard,
        }}
      >
        <TVCardImage uri={imageUrl} style={{ width: "100%", height: "100%" }} />

        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.85)"]}
          locations={[0.35, 1]}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "65%",
          }}
        />

        {/* Episode label + title overlay */}
        <View
          style={{
            position: "absolute",
            bottom: 10,
            left: 12,
            right: 12,
          }}
        >
          {epLabel && (
            <Text
              style={{
                color: Colors.textSecondary,
                fontSize: 12,
                fontWeight: "700",
                letterSpacing: 1.4,
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              {epLabel}
            </Text>
          )}
          <Text
            numberOfLines={1}
            style={{
              color: Colors.textPrimary,
              fontSize: 15,
              fontWeight: "600",
            }}
          >
            {item.Name}
          </Text>
        </View>

        {remainingMin != null && remainingMin > 0 && (
          <View
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              backgroundColor: "rgba(0,0,0,0.6)",
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 4,
            }}
          >
            <Text style={{ color: Colors.textSecondary, fontSize: 12, fontWeight: "600" }}>
              {remainingMin} min
            </Text>
          </View>
        )}

        {!watched && <TVCardProgressBar percent={progress} />}
      </View>

      {item.SeriesName && (
        <Text
          numberOfLines={1}
          style={{ color: Colors.textTertiary, ...Typography.caption, marginTop: 8 }}
        >
          {item.SeriesName}
        </Text>
      )}
    </View>
  );
});
