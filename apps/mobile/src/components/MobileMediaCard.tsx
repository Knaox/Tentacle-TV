import { memo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Animated from "react-native-reanimated";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { PressableCard, ProgressBar } from "@/components/ui";
import { colors, typography } from "@/theme";
import { ENABLE_SHARED_POSTER_TRANSITION } from "@/constants/featureFlags";

interface Props {
  item: MediaItem;
  onPress: () => void;
  onLongPress?: () => void;
  width?: number;
}

export const MobileMediaCard = memo(function MobileMediaCard({ item, onPress, onLongPress, width = 130 }: Props) {
  const client = useJellyfinClient();
  const isEpisode = item.Type === "Episode";
  const posterId = isEpisode && item.SeriesId ? item.SeriesId : item.Id;
  const hasPrimary = isEpisode && item.SeriesId ? true : !!item.ImageTags?.Primary;
  const poster = hasPrimary ? client.getImageUrl(posterId, "Primary", { width: 300, quality: 80 }) : null;
  const [imgError, setImgError] = useState(false);
  const progress = item.UserData?.PlayedPercentage ?? 0;
  const isWatched = item.UserData?.Played === true;
  const hasProgress = progress > 0 && progress < 100;
  const showFallback = !poster || imgError;

  return (
    <PressableCard onPress={onPress} onLongPress={onLongPress} style={{ width }} accessibilityRole="button" accessibilityLabel={`${item.Name}${item.ProductionYear ? `, ${item.ProductionYear}` : ""}${hasProgress ? `, ${Math.round(progress)}%` : ""}`}>
      <View style={st.poster}>
        {showFallback ? (
          <View style={st.fallback}>
            <Text style={st.fallbackLetter}>{item.Name?.charAt(0).toUpperCase() ?? "?"}</Text>
          </View>
        ) : ENABLE_SHARED_POSTER_TRANSITION ? (
          <Animated.Image
            source={{ uri: poster }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => setImgError(true)}
            sharedTransitionTag={`poster-${posterId}`}
          />
        ) : (
          <Image
            source={{ uri: poster }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            onError={() => setImgError(true)}
          />
        )}
        {hasProgress && (
          <View style={st.progWrap}>
            <ProgressBar progress={progress / 100} height={3} />
          </View>
        )}
        {isWatched && (
          <View style={st.badge}>
            <Text style={st.check}>{"\u2713"}</Text>
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={st.title}>
        {isEpisode && item.IndexNumber != null
          ? `S${String(item.ParentIndexNumber ?? 1).padStart(2, "0")}E${String(item.IndexNumber).padStart(2, "0")} \u00b7 `
          : ""}{item.Name}
      </Text>
      {!isEpisode && item.ProductionYear != null && <Text style={st.year}>{item.ProductionYear}</Text>}
      {isEpisode && item.SeriesName != null && <Text numberOfLines={1} style={st.year}>{item.SeriesName}</Text>}
    </PressableCard>
  );
});

const st = StyleSheet.create({
  poster: { aspectRatio: 2 / 3, borderRadius: 10, overflow: "hidden", backgroundColor: colors.surfaceElevated },
  fallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceElevated },
  fallbackLetter: { fontSize: 32, fontWeight: "700", color: colors.textMuted },
  progWrap: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 4, paddingBottom: 4 },
  badge: { position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  check: { color: "#fff", fontSize: 12, fontWeight: "800" },
  title: { ...typography.small, color: colors.textPrimary, marginTop: 6 },
  year: { ...typography.badge, color: colors.textMuted, marginTop: 2 },
});
