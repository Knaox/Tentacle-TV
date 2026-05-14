import { memo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Animated from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { PressableCard, ProgressBar } from "@/components/ui";
import { colors, typography, BRAND, RADIUS, SHADOW_RN, SURFACE, FONT_FAMILY } from "@/theme";
import { ENABLE_SHARED_POSTER_TRANSITION } from "@/constants/featureFlags";

interface Props {
  item: MediaItem;
  onPress: () => void;
  onLongPress?: () => void;
  width?: number;
}

/**
 * Card poster 2:3 Netflix-style — radius 12, fallback letter cinematic,
 * progress bar violet en bas, watched check rond glass top-right, scale spring
 * sur press (via PressableCard). Title Inter semibold, sous-titre tertiary.
 */
export const MobileMediaCard = memo(function MobileMediaCard({
  item, onPress, onLongPress, width = 130,
}: Props) {
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
    <PressableCard
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ width }}
      accessibilityRole="button"
      accessibilityLabel={`${item.Name}${item.ProductionYear ? `, ${item.ProductionYear}` : ""}${hasProgress ? `, ${Math.round(progress)}%` : ""}`}
    >
      <View style={st.poster}>
        {/* Inner clip — sépare le clipping de l'image du shadow du poster (sinon l'image déborde légèrement les coins arrondis sur certains renders). */}
        <View style={st.imageClip} pointerEvents="none">
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
              transition={250}
            />
          )}
        </View>
        {hasProgress && (
          <View style={st.progWrap}>
            <ProgressBar progress={progress / 100} height={3} tint={BRAND.violet} />
          </View>
        )}
        {isWatched && !hasProgress && (
          <View style={st.watchedBadge}>
            <Feather name="check" size={12} color="#000" />
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={st.title}>
        {isEpisode && item.IndexNumber != null
          ? `S${String(item.ParentIndexNumber ?? 1).padStart(2, "0")}E${String(item.IndexNumber).padStart(2, "0")} · `
          : ""}{item.Name}
      </Text>
      {!isEpisode && item.ProductionYear != null && <Text style={st.year}>{item.ProductionYear}</Text>}
      {isEpisode && item.SeriesName != null && <Text numberOfLines={1} style={st.year}>{item.SeriesName}</Text>}
    </PressableCard>
  );
});

const st = StyleSheet.create({
  poster: {
    aspectRatio: 2 / 3,
    borderRadius: RADIUS.lg,
    backgroundColor: SURFACE.s2,
    ...SHADOW_RN.elev2,
  },
  imageClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    backgroundColor: SURFACE.s2,
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SURFACE.s2,
  },
  fallbackLetter: {
    fontSize: 36,
    fontFamily: FONT_FAMILY.extrabold,
    color: "rgba(255,255,255,0.18)",
    letterSpacing: -0.5,
  },
  progWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  watchedBadge: {
    // R11 — Watched check unifié sur les 3 plateformes : pill blanc + check noir + shadow.
    // Match desktop apps/web/src/components/cards/PosterCard.tsx:90 (bg-white text-black rounded-full shadow).
    position: "absolute",
    top: 7,
    right: 7,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  title: {
    ...typography.small,
    fontSize: 13,
    fontFamily: FONT_FAMILY.semibold,
    color: colors.textPrimary,
    marginTop: 8,
    letterSpacing: -0.1,
  },
  year: {
    ...typography.badge,
    fontFamily: FONT_FAMILY.medium,
    color: colors.textMuted,
    marginTop: 2,
  },
});
