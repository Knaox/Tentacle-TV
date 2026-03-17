import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions, type ViewToken } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedReaction,
  withDelay, withTiming, type SharedValue,
} from "react-native-reanimated";
import { GradientOverlay } from "@/components/ui";
import { colors, spacing, typography } from "@/theme";

const ROTATE_MS = 6000;

interface HeroBannerProps {
  items: MediaItem[];
  onPlay: (item: MediaItem) => void;
  onInfo: (item: MediaItem) => void;
}

function formatRuntime(ticks: number): string {
  const mins = Math.round(ticks / 600_000_000);
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${m}` : `${h}h`;
}

export const HeroBanner = memo(function HeroBanner({ items, onPlay, onInfo }: HeroBannerProps) {
  const { t } = useTranslation("common");
  const { width: SCREEN_W, height: screenH } = useWindowDimensions();
  const BANNER_H = Math.min(420, Math.round(screenH * 0.45));
  const insets = useSafeAreaInsets();
  const client = useJellyfinClient();
  const listRef = useRef<FlatList<MediaItem>>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [active, setActive] = useState(0);
  const activeShared = useSharedValue(0);
  useEffect(() => { activeShared.value = active; }, [active, activeShared]);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (items.length <= 1) return;
    timerRef.current = setInterval(() => {
      setActive((p) => {
        const n = (p + 1) % items.length;
        listRef.current?.scrollToOffset({ offset: n * SCREEN_W, animated: true });
        return n;
      });
    }, ROTATE_MS);
  }, [items.length, SCREEN_W]);

  useEffect(() => { startTimer(); return () => clearInterval(timerRef.current); }, [startTimer]);

  const viewCfg = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setActive(viewableItems[0].index);
  }).current;

  const [bgErrors, setBgErrors] = useState<Set<string>>(new Set());
  const onBgError = useCallback((id: string) => {
    setBgErrors((prev) => new Set(prev).add(id));
  }, []);

  const renderSlide = useCallback(({ item, index }: { item: MediaItem; index: number }) => {
    const isEpisode = item.Type === "Episode";
    const useParentBackdrop = isEpisode && item.ParentBackdropItemId && (item.ParentBackdropImageTags?.length ?? 0) > 0;
    const bgId = useParentBackdrop ? item.ParentBackdropItemId! : item.Id;
    const hasBackdrop = useParentBackdrop || (item.BackdropImageTags && item.BackdropImageTags.length > 0);
    const hasPrimary = !!item.ImageTags?.Primary;
    const hasBgError = bgErrors.has(item.Id);

    let bgUrl: string | null = null;
    if (!hasBgError) {
      if (hasBackdrop) {
        bgUrl = client.getImageUrl(bgId, "Backdrop", { width: 800, quality: 80 });
      } else if (isEpisode && item.SeriesId) {
        bgUrl = client.getImageUrl(item.SeriesId, "Primary", { width: 800, quality: 80 });
      } else if (hasPrimary) {
        bgUrl = client.getImageUrl(item.Id, "Primary", { width: 800, quality: 80 });
      }
    }

    const progress = item.UserData?.PlayedPercentage ?? 0;
    const hasProgress = progress > 0 && progress < 100;
    const isWatched = item.UserData?.Played === true;
    const genres = item.Genres?.slice(0, 2) ?? [];
    const runtime = item.RunTimeTicks ? formatRuntime(item.RunTimeTicks) : null;

    return (
      <View style={[s.slide, { width: SCREEN_W, height: BANNER_H, paddingTop: insets.top }]}>
        {bgUrl ? (
          <Image
            source={{ uri: bgUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            onError={() => onBgError(item.Id)}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceElevated }]} />
        )}
        <GradientOverlay direction="bottom" height={BANNER_H * 0.85} color={colors.background} />
        <GradientOverlay direction="top" height={100 + insets.top} color="rgba(0,0,0,0.6)" />
        <AnimatedSlideContent activeIndex={activeShared} slideIndex={index}>
          <View style={[s.content, { paddingBottom: Math.min(40, Math.round(screenH * 0.05)) }]}>
            {hasProgress && (
              <View style={s.continueBadge}>
                <Text style={s.continueTxt}>{t("continueLabel")}</Text>
              </View>
            )}
            {isWatched && !hasProgress && (
              <View style={s.watchedBadge}>
                <Feather name="check" size={12} color="#fff" />
                <Text style={s.continueTxt}>{t("watched")}</Text>
              </View>
            )}
            <View style={s.meta}>
              {item.ProductionYear != null && <Text style={s.metaTxt}>{item.ProductionYear}</Text>}
              {item.CommunityRating != null && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <Feather name="star" size={12} color={colors.gold} />
                  <Text style={s.rating}>{item.CommunityRating.toFixed(1)}</Text>
                </View>
              )}
              {item.OfficialRating != null && (
                <View style={s.rBadge}><Text style={s.rBadgeTxt}>{item.OfficialRating}</Text></View>
              )}
              {genres.map((g) => <Text key={g} style={s.metaTxt}>{g}</Text>)}
              {runtime && <Text style={s.metaTxt}>{runtime}</Text>}
            </View>
            {isEpisode && item.SeriesName != null && (
              <Text numberOfLines={1} style={s.metaTxt}>{item.SeriesName}</Text>
            )}
            <Text style={s.title} numberOfLines={2} maxFontSizeMultiplier={1.2}>
              {isEpisode && item.IndexNumber != null
                ? `S${String(item.ParentIndexNumber ?? 1).padStart(2, "0")}E${String(item.IndexNumber).padStart(2, "0")} \u00b7 `
                : ""}{item.Name}
            </Text>
            {item.Overview != null && <Text style={s.overview} numberOfLines={2}>{item.Overview}</Text>}
            {hasProgress && (
              <View style={[s.progRow, { maxWidth: Math.min(200, Math.round(SCREEN_W * 0.5)) }]}>
                <View style={s.progTrack}>
                  <View style={[s.progFill, { width: `${progress}%` as unknown as number }]} />
                </View>
                <Text style={s.progLbl}>{Math.round(progress)}%</Text>
              </View>
            )}
            <View style={s.btns}>
              <Pressable style={s.playBtn} onPress={() => onPlay(item)} accessibilityRole="button" accessibilityLabel={`${hasProgress ? t("resume") : t("play")} ${item.Name}`}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Feather name="play" size={16} color={colors.textPrimary} />
                  <Text style={s.playTxt}>{hasProgress ? t("resume") : t("play")}</Text>
                </View>
              </Pressable>
              <Pressable style={s.infoBtn} onPress={() => onInfo(item)} accessibilityRole="button" accessibilityLabel={`${t("moreInfo")} ${item.Name}`}>
                <Text style={s.infoTxt}>{t("moreInfo")}</Text>
              </Pressable>
            </View>
          </View>
        </AnimatedSlideContent>
      </View>
    );
  }, [client, insets.top, onPlay, onInfo, t, bgErrors, onBgError, activeShared, SCREEN_W, BANNER_H, screenH]);

  if (!items.length) return <View style={{ height: BANNER_H }} />;

  return (
    <View>
      <FlatList
        ref={listRef}
        data={items}
        renderItem={renderSlide}
        keyExtractor={(it) => it.Id}
        horizontal
        pagingEnabled
        snapToInterval={SCREEN_W}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={viewCfg}
        onScrollBeginDrag={() => clearInterval(timerRef.current)}
        onScrollEndDrag={startTimer}
        getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
      />
      {items.length > 1 && (
        <View style={s.dots}>
          {items.map((_, i) => (
            <View key={i} style={[s.dot, i === active ? s.dotOn : s.dotOff]} />
          ))}
        </View>
      )}
    </View>
  );
});

/* ── Animated slide content (fade-in + translateY on slide change) ── */

function AnimatedSlideContent({ activeIndex, slideIndex, children }: {
  activeIndex: SharedValue<number>;
  slideIndex: number;
  children: ReactNode;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  useAnimatedReaction(
    () => activeIndex.value,
    (current, previous) => {
      if (current === slideIndex && previous !== slideIndex) {
        opacity.value = 0;
        translateY.value = 16;
        opacity.value = withDelay(150, withTiming(1, { duration: 250 }));
        translateY.value = withDelay(150, withTiming(0, { duration: 250 }));
      } else if (current !== slideIndex) {
        opacity.value = 0;
        translateY.value = 16;
      }
    },
    [slideIndex],
  );

  // Premier slide animé au mount
  useEffect(() => {
    if (slideIndex === 0) {
      opacity.value = withDelay(300, withTiming(1, { duration: 300 }));
      translateY.value = withDelay(300, withTiming(0, { duration: 300 }));
    }
  }, [slideIndex, opacity, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

const s = StyleSheet.create({
  slide: { justifyContent: "flex-end" as const },
  content: { paddingHorizontal: spacing.screenPadding },
  continueBadge: {
    alignSelf: "flex-start", backgroundColor: colors.accent,
    borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8,
  },
  watchedBadge: {
    alignSelf: "flex-start", backgroundColor: "#8B5CF6",
    borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8,
    flexDirection: "row" as const, alignItems: "center" as const, gap: 4,
  },
  continueTxt: { ...typography.badge, color: "#fff", fontWeight: "800", textTransform: "uppercase" as const },
  meta: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" as const },
  metaTxt: { ...typography.caption, color: colors.textSecondary },
  rating: { ...typography.caption, color: colors.gold },
  rBadge: { borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  rBadgeTxt: { ...typography.badge, color: colors.textSecondary },
  title: { ...typography.hero, color: colors.textPrimary, marginBottom: 6 },
  overview: { ...typography.caption, color: colors.textSecondary, lineHeight: 18, marginBottom: 10 },
  progRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  progTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.1)" },
  progFill: { height: "100%", borderRadius: 2, backgroundColor: colors.accent },
  progLbl: { ...typography.badge, color: colors.textMuted },
  btns: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  playBtn: { backgroundColor: colors.accent, borderRadius: spacing.buttonRadius, paddingVertical: 12, paddingHorizontal: 22 },
  playTxt: { ...typography.bodyBold, color: colors.textPrimary },
  infoBtn: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: spacing.buttonRadius, paddingVertical: 12, paddingHorizontal: 18, borderWidth: 1, borderColor: colors.border },
  infoTxt: { ...typography.bodyBold, color: colors.textSecondary },
  dots: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, position: "absolute", bottom: 14, left: 0, right: 0 },
  dot: { height: 6, borderRadius: 3 },
  dotOn: { width: 24, backgroundColor: colors.accent },
  dotOff: { width: 6, backgroundColor: "rgba(255,255,255,0.3)" },
});
