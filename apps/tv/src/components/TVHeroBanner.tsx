import { useState, useEffect, useCallback, useRef, memo } from "react";
import { View, Text, Image, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import LinearGradient from "react-native-linear-gradient";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { formatDuration } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import { Focusable } from "./focus/Focusable";
import { PlayIcon } from "./icons/TVIcons";
import { Colors, Spacing, Typography, Radius, HeroConfig } from "../theme/colors";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const HERO_H = Math.round(SCREEN_H * HeroConfig.heightRatio);

interface TVHeroBannerProps {
  items: MediaItem[];
  onPlay: (item: MediaItem) => void;
  onDetail: (item: MediaItem) => void;
}

export const TVHeroBanner = memo(function TVHeroBanner({ items, onPlay, onDetail }: TVHeroBannerProps) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const [index, setIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState<number | null>(null);

  const currentOpacity = useSharedValue(1);
  const nextOpacity = useSharedValue(0);
  const kenBurns = useSharedValue(1);

  useEffect(() => {
    kenBurns.value = 1;
    kenBurns.value = withRepeat(
      withTiming(HeroConfig.kenBurnsScale, {
        duration: HeroConfig.kenBurnsDuration,
        easing: Easing.linear,
      }),
      -1,
      true,
    );
  }, [index, kenBurns]);

  const doTransition = useCallback(() => {
    if (items.length <= 1) return;
    const next = (index + 1) % items.length;
    setNextIndex(next);
    nextOpacity.value = 0;
    currentOpacity.value = withTiming(0, { duration: HeroConfig.crossfadeDuration });
    nextOpacity.value = withTiming(1, { duration: HeroConfig.crossfadeDuration }, () => {
      runOnJS(setIndex)(next);
      runOnJS(setNextIndex)(null);
    });
  }, [items.length, index, currentOpacity, nextOpacity]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (items.length <= 1) return;
    timerRef.current = setInterval(doTransition, HeroConfig.rotateInterval);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [items.length, doTransition]);

  useEffect(() => { currentOpacity.value = 1; }, [index, currentOpacity]);

  const currentStyle = useAnimatedStyle(() => ({ opacity: currentOpacity.value }));
  const nextStyle = useAnimatedStyle(() => ({ opacity: nextOpacity.value }));
  const kenBurnsStyle = useAnimatedStyle(() => ({ transform: [{ scale: kenBurns.value }] }));

  if (items.length === 0) return null;

  const item = items[index];
  const nextItem = nextIndex != null ? items[nextIndex] : null;
  const backdrop = client.getImageUrl(item.Id, "Backdrop", { width: 1920, quality: 80 });
  const nextBackdrop = nextItem
    ? client.getImageUrl(nextItem.Id, "Backdrop", { width: 1920, quality: 80 })
    : null;

  const year = item.ProductionYear;
  const genres = item.Genres?.slice(0, 3) ?? [];
  const runtime = item.RunTimeTicks ? formatDuration(item.RunTimeTicks) : null;
  const rating = item.CommunityRating?.toFixed(1);

  return (
    <View style={{
      width: SCREEN_W, height: HERO_H, overflow: "hidden",
      backgroundColor: Colors.bgDeep,
    }}>
      {/* Current backdrop with Ken Burns */}
      <Animated.View style={[{ position: "absolute", width: "100%", height: "100%" }, currentStyle]}>
        <Animated.Image
          source={{ uri: backdrop }}
          style={[{ width: "100%", height: "100%" }, kenBurnsStyle]}
          resizeMode="cover"
        />
      </Animated.View>

      {/* Next backdrop for crossfade */}
      {nextBackdrop && (
        <Animated.View style={[{ position: "absolute", width: "100%", height: "100%" }, nextStyle]}>
          <Image source={{ uri: nextBackdrop }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        </Animated.View>
      )}

      {/* Gradient vertical bottom */}
      <LinearGradient
        colors={["transparent", "rgba(6,6,10,0.5)", Colors.bgDeep]}
        locations={[0, 0.4, 0.85]}
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: HERO_H * 0.7 }}
      />
      {/* Hard opaque strip at the very bottom — eliminates any subpixel seam */}
      <View style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 24,
        backgroundColor: Colors.bgDeep,
      }} />

      {/* Gradient horizontal left */}
      <LinearGradient
        colors={[Colors.bgDeep, "rgba(6,6,10,0.6)", "transparent"]}
        locations={[0, 0.3, 0.7]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: SCREEN_W * 0.55 }}
      />

      {/* Content */}
      <View style={{
        position: "absolute", bottom: 48, left: Spacing.screenPadding, right: SCREEN_W * 0.4,
      }}>
        <Text
          numberOfLines={2}
          style={{
            color: Colors.textPrimary, ...Typography.heroTitle,
            textShadowColor: "rgba(0,0,0,0.8)",
            textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
          }}
        >
          {item.Name}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: Spacing.titleToMeta }}>
          {year && <Text style={{ color: Colors.textSecondary, ...Typography.meta }}>{year}</Text>}
          {genres.map((g, i) => (
            <View key={g} style={{ flexDirection: "row", alignItems: "center" }}>
              {i > 0 && <Text style={{ color: Colors.textTertiary, marginRight: 10 }}>·</Text>}
              <Text style={{ color: Colors.textMuted, ...Typography.meta }}>{g}</Text>
            </View>
          ))}
          {runtime && (
            <>
              <Text style={{ color: Colors.textTertiary }}>·</Text>
              <Text style={{ color: Colors.textMuted, ...Typography.meta }}>{runtime}</Text>
            </>
          )}
          {rating && (
            <>
              <Text style={{ color: Colors.textTertiary }}>·</Text>
              <Text style={{ color: Colors.ratingGold, ...Typography.meta }}>★ {rating}</Text>
            </>
          )}
        </View>

        {item.Overview && (
          <Text
            numberOfLines={2}
            style={{
              color: Colors.textSecondary, ...Typography.synopsis,
              lineHeight: 20, marginTop: Spacing.metaToSynopsis,
            }}
          >
            {item.Overview}
          </Text>
        )}

        <View style={{ flexDirection: "row", gap: Spacing.buttonGap, marginTop: Spacing.synopsisToButtons }}>
          <Focusable onPress={() => onPlay(item)}>
            <View style={{
              backgroundColor: Colors.accentPurple,
              paddingHorizontal: 24, paddingVertical: 10,
              borderRadius: Radius.buttonLarge,
              flexDirection: "row", alignItems: "center", gap: 8,
            }}>
              <PlayIcon size={14} color={Colors.textPrimary} />
              <Text style={{ color: Colors.textPrimary, ...Typography.buttonLarge }}>{t("play")}</Text>
            </View>
          </Focusable>
          <Focusable onPress={() => onDetail(item)}>
            <View style={{
              backgroundColor: Colors.glassBg,
              paddingHorizontal: 20, paddingVertical: 10,
              borderRadius: Radius.buttonLarge,
              borderWidth: 1, borderColor: Colors.glassBorder,
            }}>
              <Text style={{ color: Colors.textPrimary, ...Typography.buttonLarge }}>{t("moreInfo")}</Text>
            </View>
          </Focusable>
        </View>
      </View>

      {/* Dot indicators */}
      {items.length > 1 && (
        <View style={{
          position: "absolute", bottom: 16, alignSelf: "center",
          flexDirection: "row", gap: 6,
        }}>
          {items.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === index ? 16 : 6, height: 6, borderRadius: 3,
                backgroundColor: i === index ? Colors.accentPurple : Colors.textTertiary,
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
});
