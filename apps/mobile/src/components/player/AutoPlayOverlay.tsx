import { useEffect, useRef } from "react";
import { View, Text, Pressable, Animated, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { X, Play } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { BRAND, SURFACE } from "../../theme";

interface Props {
  nextEpisode: MediaItem;
  countdown: number;
  /** Initial countdown — used for progress bar width. */
  totalSeconds?: number;
  onPlay: () => void;
  onDismiss: () => void;
}

const DEFAULT_TOTAL = 10;

/**
 * Cinema-style "Up Next" card — mirror of the web `UpNextCard`.
 * Backdrop image at top with bottom scrim → fades into card surface for legibility.
 * Triggered by MobilePlayerOverlay following the same conditions as desktop:
 * `creditsSegment.start` when available, otherwise N seconds before the end.
 */
export function AutoPlayOverlay({ nextEpisode, countdown, totalSeconds = DEFAULT_TOTAL, onPlay, onDismiss }: Props) {
  const { t } = useTranslation("player");
  const client = useJellyfinClient();
  const { width: screenW } = useWindowDimensions();
  const slide = useRef(new Animated.Value(60)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [slide, opacity]);

  const progress = ((totalSeconds - countdown) / totalSeconds) * 100;

  const cardW = Math.min(320, screenW - 24);

  // Backdrop with fallback chain — episode own → series parent → primary
  const hasOwnBackdrop = (nextEpisode.BackdropImageTags?.length ?? 0) > 0;
  const hasParentBackdrop = (nextEpisode.ParentBackdropImageTags?.length ?? 0) > 0;
  const isEpisode = nextEpisode.Type === "Episode";
  const backdropId = isEpisode
    ? (hasOwnBackdrop ? nextEpisode.Id : (nextEpisode.ParentBackdropItemId ?? nextEpisode.SeriesId ?? nextEpisode.Id))
    : nextEpisode.Id;
  const imageType: "Backdrop" | "Primary" = (hasOwnBackdrop || hasParentBackdrop) ? "Backdrop" : "Primary";
  const imageUrl = client.getImageUrl(backdropId, imageType, { width: 720, quality: 85 });

  const episodeLabel = isEpisode && nextEpisode.ParentIndexNumber != null && nextEpisode.IndexNumber != null
    ? `S${String(nextEpisode.ParentIndexNumber).padStart(2, "0")}E${String(nextEpisode.IndexNumber).padStart(2, "0")}`
    : undefined;
  const description = nextEpisode.Overview
    ? (nextEpisode.Overview.length > 120 ? `${nextEpisode.Overview.slice(0, 120)}…` : nextEpisode.Overview)
    : undefined;

  const imageH = Math.round((cardW * 7) / 16);

  return (
    <Animated.View
      style={{
        position: "absolute",
        bottom: 16,
        right: 12,
        width: cardW,
        opacity,
        transform: [{ translateY: slide }],
        backgroundColor: SURFACE.s2 ?? "#15151c",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        borderRadius: 14,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.55,
        shadowRadius: 24,
        elevation: 20,
      }}
    >
      {/* Top progress bar — violet gradient */}
      <View style={{ height: 3, width: "100%", backgroundColor: "rgba(255,255,255,0.1)" }}>
        <LinearGradient
          colors={[BRAND.light ?? "#a78bfa", BRAND.violet ?? "#8b5cf6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ height: "100%", width: `${progress}%` }}
        />
      </View>

      {/* Backdrop strip */}
      <View style={{ width: "100%", height: imageH, position: "relative" }}>
        <Image
          source={{ uri: imageUrl }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={250}
        />
        {/* Bottom scrim fading into card surface */}
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(15,15,21,0.55)", SURFACE.s2 ?? "#15151c"]}
          locations={[0, 0.55, 1]}
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        />

        {/* Top-left badge — UP NEXT + countdown */}
        <View style={{ position: "absolute", top: 8, left: 10, flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              backgroundColor: "rgba(0,0,0,0.6)",
              borderColor: "rgba(139,92,246,0.55)",
              borderWidth: 1,
              borderRadius: 5,
              paddingHorizontal: 7,
              paddingVertical: 3,
            }}
          >
            <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: BRAND.light ?? "#a78bfa" }} />
            <Text style={{ color: "#fff", fontSize: 9, fontWeight: "700", letterSpacing: 1.4 }}>
              {(t("upNext") as string).toUpperCase()}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: "rgba(0,0,0,0.55)",
              borderRadius: 5,
              paddingHorizontal: 6,
              paddingVertical: 3,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 9, fontWeight: "600", fontVariant: ["tabular-nums"] }}>
              {countdown}{t("secondsShort")}
            </Text>
          </View>
        </View>

        {/* Top-right close */}
        <Pressable
          onPress={onDismiss}
          accessibilityLabel={t("dismiss") as string}
          hitSlop={10}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: "rgba(0,0,0,0.35)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={12} color="rgba(255,255,255,0.85)" />
        </Pressable>
      </View>

      {/* Episode meta + actions */}
      <View style={{ paddingHorizontal: 12, paddingTop: 2, paddingBottom: 10 }}>
        {episodeLabel && (
          <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 9, fontWeight: "700", letterSpacing: 1.6 }}>
            {episodeLabel}
          </Text>
        )}
        <Text numberOfLines={1} style={{ color: "#fff", fontSize: 13, fontWeight: "600", marginTop: 1 }}>
          {nextEpisode.Name}
        </Text>
        {description && (
          <Text numberOfLines={2} style={{ color: "rgba(255,255,255,0.55)", fontSize: 10.5, lineHeight: 14, marginTop: 4 }}>
            {description}
          </Text>
        )}

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
          <Pressable
            onPress={onPlay}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              backgroundColor: "#fff",
              borderRadius: 7,
              paddingVertical: 8,
              shadowColor: BRAND.violet ?? "#8b5cf6",
              shadowOffset: { width: 0, height: 5 },
              shadowOpacity: 0.45,
              shadowRadius: 12,
              elevation: 5,
            }}
          >
            <Play size={12} color="#000" fill="#000" />
            <Text style={{ color: "#000", fontSize: 12, fontWeight: "700" }}>
              {t("playNow")}
            </Text>
          </Pressable>
          <Pressable
            onPress={onDismiss}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 7,
            }}
          >
            <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: "500" }}>
              {t("dismiss")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}
