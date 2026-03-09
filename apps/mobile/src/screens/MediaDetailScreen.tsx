import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { View, Text, ScrollView, Dimensions, RefreshControl, InteractionManager } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMediaItem, useSimilarItems, useJellyfinClient } from "@tentacle-tv/api-client";
import { ticksToSeconds } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { colors, spacing, typography } from "../theme";
import { Badge, Button, GradientOverlay, ProgressBar, Skeleton, IconButton } from "../components/ui";
import { MobileMediaCard } from "../components/MobileMediaCard";
import { MediaRow } from "../components/MediaRow";
import { MobileEpisodeList } from "../components/MobileEpisodeList";
import { CastRow } from "../components/CastRow";
import { ENABLE_SHARED_POSTER_TRANSITION } from "../constants/featureFlags";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const BACKDROP_H = Math.round(SCREEN_HEIGHT * 0.45);
const POSTER_W = 130;
const POSTER_H = 195;

interface Props { itemId: string }

export function MediaDetailScreen({ itemId }: Props) {
  const { t } = useTranslation("common");
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const client = useJellyfinClient();
  const { data: item, refetch, isRefetching } = useMediaItem(itemId);
  const isEpisode = item?.Type === "Episode";
  const { data: parentSeries } = useMediaItem(isEpisode ? item?.SeriesId : undefined);
  const similarId = isEpisode ? (item?.SeriesId ?? itemId) : itemId;
  const similarParentId = isEpisode ? parentSeries?.ParentId : item?.ParentId;
  const { data: similar } = useSimilarItems(similarId, similarParentId);
  const [expanded, setExpanded] = useState(false);
  const onRefresh = useCallback(() => { refetch(); }, [refetch]);
  const badges = useMemo(() => computeBadges(item), [item]);

  // Cascade entry animations — only run once per itemId (not on data refetch)
  const animatedForId = useRef<string | null>(null);
  const posterAnim = useSharedValue(0);
  const titleAnim = useSharedValue(0);
  const metaAnim = useSharedValue(0);
  const actionsAnim = useSharedValue(0);
  const contentAnim = useSharedValue(0);

  useEffect(() => {
    if (!item || animatedForId.current === itemId) return;
    animatedForId.current = itemId;
    // Reset to 0 before animating (handles cached data + navigation reuse)
    posterAnim.value = 0;
    titleAnim.value = 0;
    metaAnim.value = 0;
    actionsAnim.value = 0;
    contentAnim.value = 0;
    // Wait for screen push transition to finish before starting cascade
    const handle = InteractionManager.runAfterInteractions(() => {
      posterAnim.value = withSpring(1, { damping: 15, stiffness: 120 });
      titleAnim.value = withDelay(100, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
      metaAnim.value = withDelay(200, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
      actionsAnim.value = withDelay(300, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
      contentAnim.value = withDelay(400, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
    });
    return () => handle.cancel();
  }, [item, itemId, posterAnim, titleAnim, metaAnim, actionsAnim, contentAnim]);

  const posterStyle = useAnimatedStyle(() => ({
    opacity: posterAnim.value,
    transform: [{ scale: 0.85 + 0.15 * posterAnim.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleAnim.value,
    transform: [{ translateY: (1 - titleAnim.value) * 20 }],
  }));
  const metaStyle = useAnimatedStyle(() => ({
    opacity: metaAnim.value,
    transform: [{ translateY: (1 - metaAnim.value) * 15 }],
  }));
  const actionsStyle = useAnimatedStyle(() => ({
    opacity: actionsAnim.value,
    transform: [{ translateY: (1 - actionsAnim.value) * 15 }],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentAnim.value,
  }));

  if (!item) return <LoadingSkeleton top={insets.top} />;

  const backdrop = client.getImageUrl(item.ParentBackdropItemId ?? item.Id, "Backdrop", { width: 800, quality: 80 });
  const posterId = item.Type === "Episode" ? (item.SeriesId ?? item.Id) : item.Id;
  const poster = client.getImageUrl(posterId, "Primary", { height: 400, quality: 85 });
  const isSeries = item.Type === "Series";
  const year = item.ProductionYear;
  const rating = item.CommunityRating?.toFixed(1);
  const runtimeMin = item.RunTimeTicks ? Math.round(ticksToSeconds(item.RunTimeTicks) / 60) : null;
  const posTicks = item.UserData?.PlaybackPositionTicks ?? 0;
  const hasResume = posTicks > 0;
  const resumeSec = ticksToSeconds(posTicks);
  const playLabel = hasResume ? t("resumeAt", { time: fmtTime(resumeSec) }) : t("play");
  const progress = item.UserData?.PlayedPercentage ? item.UserData.PlayedPercentage / 100 : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: spacing.xxxl }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* Backdrop */}
      <View style={{ width: SCREEN_WIDTH, height: BACKDROP_H }}>
        <Image source={{ uri: backdrop }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        <GradientOverlay direction="bottom" height={280} color={colors.background} />
        <GradientOverlay direction="top" height={100} color="rgba(0,0,0,0.4)" />
        <IconButton
          icon="←" onPress={() => router.back()}
          accessibilityLabel={t("back")}
          style={{ position: "absolute", top: insets.top + spacing.sm, left: spacing.screenPadding }}
        />
      </View>

      {/* Poster + Metadata */}
      <View style={{ flexDirection: "row", paddingHorizontal: spacing.screenPadding, marginTop: -(POSTER_H / 2) }}>
        <Animated.Image
          source={{ uri: poster }}
          style={[
            {
              width: POSTER_W, height: POSTER_H, borderRadius: spacing.cardRadius, backgroundColor: colors.surfaceElevated,
              shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16,
            },
            ENABLE_SHARED_POSTER_TRANSITION ? undefined : posterStyle,
          ]}
          resizeMode="cover"
          {...(ENABLE_SHARED_POSTER_TRANSITION ? { sharedTransitionTag: `poster-${posterId}` } : {})}
        />
        <Animated.View style={[{ flex: 1, marginLeft: spacing.lg, justifyContent: "flex-end" }, titleStyle]}>
          <Text style={{ fontSize: 24, fontWeight: "700", color: colors.textPrimary }}>{item.Name}</Text>
          <Animated.View style={[{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs, flexWrap: "wrap", alignItems: "center" }, metaStyle]}>
            {year && <Text style={{ ...typography.caption, color: colors.textSecondary }}>{year}</Text>}
            {year && (runtimeMin != null && runtimeMin > 0 || rating) && <Text style={{ ...typography.caption, color: colors.textMuted }}>·</Text>}
            {runtimeMin != null && runtimeMin > 0 && (
              <Text style={{ ...typography.caption, color: colors.textMuted }}>{t("minutesShort", { count: runtimeMin })}</Text>
            )}
            {runtimeMin != null && runtimeMin > 0 && rating && <Text style={{ ...typography.caption, color: colors.textMuted }}>·</Text>}
            {rating && <Text style={{ ...typography.caption, color: colors.gold }}>★ {rating}</Text>}
            {isSeries && item.ChildCount && (
              <Text style={{ ...typography.caption, color: colors.textMuted }}>{t("seasonsCount", { count: item.ChildCount })}</Text>
            )}
          </Animated.View>
          {badges.length > 0 && (
            <Animated.View style={[{ flexDirection: "row", gap: spacing.xs, marginTop: spacing.sm, flexWrap: "wrap" }, metaStyle]}>
              {badges.map((b) => <Badge key={b} label={b} variant="accent" />)}
            </Animated.View>
          )}
        </Animated.View>
      </View>

      {/* Play / Resume */}
      {!isSeries && (
        <Animated.View style={[{ paddingHorizontal: spacing.screenPadding, marginTop: spacing.lg }, actionsStyle]}>
          <Button title={playLabel} onPress={() => router.push(`/watch/${item.Id}`)} fullWidth style={{ borderRadius: 12, height: 52 }} accessibilityLabel={`${playLabel} ${item.Name}`} />
          {hasResume && <ProgressBar progress={progress} style={{ marginTop: spacing.sm }} />}
        </Animated.View>
      )}

      {/* Content — fades in last */}
      <Animated.View style={contentStyle}>
        {/* Separator */}
        <View style={{ height: 1, backgroundColor: "rgba(139,92,246,0.1)", marginHorizontal: spacing.screenPadding, marginTop: spacing.lg }} />

        {/* Genres */}
        {item.Genres && item.Genres.length > 0 && (
          <View style={{ flexDirection: "row", gap: spacing.xs, marginTop: spacing.md, paddingHorizontal: spacing.screenPadding, flexWrap: "wrap" }}>
            {item.Genres.map((g) => <Badge key={g} label={g} variant="muted" />)}
          </View>
        )}

        {/* Overview (expandable) */}
        {item.Overview && (
          <View style={{ paddingHorizontal: spacing.screenPadding, marginTop: spacing.md }}>
            <Text
              numberOfLines={expanded ? undefined : 3}
              style={{ ...typography.body, color: colors.textSecondary, lineHeight: 22 }}
            >
              {item.Overview}
            </Text>
            <Text
              onPress={() => setExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={expanded ? t("showLess") : t("showMore")}
              style={{ ...typography.caption, color: colors.accent, marginTop: spacing.xs }}
            >
              {expanded ? t("showLess") : t("showMore")}
            </Text>
          </View>
        )}

        {/* Cast */}
        {item.People && item.People.length > 0 && (
          <>
            <View style={{ height: 1, backgroundColor: "rgba(139,92,246,0.1)", marginHorizontal: spacing.screenPadding, marginTop: spacing.lg }} />
            <CastRow people={item.People} />
          </>
        )}

        {/* Episodes */}
        {isSeries && <MobileEpisodeList seriesId={item.Id} onPlay={(ep) => router.push(`/watch/${ep.Id}`)} />}

        {/* Similar */}
        {similar && similar.length > 0 && (
          <MediaRow
            title={t("recommendations")}
            data={similar}
            renderItem={(s: MediaItem) => <MobileMediaCard item={s} onPress={() => router.push(`/media/${s.Id}`)} />}
          />
        )}
      </Animated.View>
    </ScrollView>
  );
}

/* --- Loading skeleton --- */

function LoadingSkeleton({ top }: { top: number }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: top }}>
      <Skeleton width="100%" height={BACKDROP_H} radius={0} />
      <View style={{ flexDirection: "row", paddingHorizontal: spacing.screenPadding, marginTop: -90 }}>
        <Skeleton width={POSTER_W} height={POSTER_H} radius={spacing.cardRadius} />
        <View style={{ flex: 1, marginLeft: spacing.lg, justifyContent: "flex-end", gap: spacing.sm }}>
          <Skeleton width="80%" height={22} />
          <Skeleton width="50%" height={14} />
          <Skeleton width="40%" height={14} />
        </View>
      </View>
      <View style={{ paddingHorizontal: spacing.screenPadding, marginTop: spacing.lg }}>
        <Skeleton width="100%" height={48} radius={spacing.buttonRadius} />
      </View>
      <View style={{ paddingHorizontal: spacing.screenPadding, marginTop: spacing.lg, gap: spacing.sm }}>
        <Skeleton width="100%" height={14} />
        <Skeleton width="90%" height={14} />
        <Skeleton width="70%" height={14} />
      </View>
    </View>
  );
}

/* --- Helpers --- */

function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

interface StreamLike { Type?: string; Width?: number; Codec?: string; Channels?: number; DisplayTitle?: string }

function computeBadges(item: MediaItem | undefined): string[] {
  if (!item?.MediaSources?.[0]?.MediaStreams) return [];
  const streams = item.MediaSources[0].MediaStreams as StreamLike[];
  const out: string[] = [];
  const video = streams.find((s) => s.Type === "Video");
  if (video) {
    if (video.Width && video.Width >= 3840) out.push("4K");
    else if (video.Width && video.Width >= 1920) out.push("1080p");
    else if (video.Width && video.Width >= 1280) out.push("720p");
    const c = video.Codec?.toLowerCase();
    if (c === "hevc") out.push("HEVC");
    else if (c === "h264") out.push("H.264");
    else if (c === "av1") out.push("AV1");
  }
  const audio = streams.find((s) => s.Type === "Audio");
  if (audio) {
    const dt = audio.DisplayTitle?.toLowerCase() ?? "";
    if (dt.includes("atmos")) out.push("Atmos");
    else if (audio.Channels && audio.Channels >= 8) out.push("7.1");
    else if (audio.Channels && audio.Channels >= 6) out.push("5.1");
  }
  return out;
}
