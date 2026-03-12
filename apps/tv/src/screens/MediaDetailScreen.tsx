import { useEffect, useRef, useCallback } from "react";
import { View, Text, Image, ScrollView, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import LinearGradient from "react-native-linear-gradient";
import { useMediaItem, useSimilarItems, useJellyfinClient, useToggleWatchlist } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { formatDuration, ticksToSeconds } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Focusable } from "../components/focus/Focusable";
import { FocusableRow } from "../components/focus/FocusableRow";
import { TVMediaCard } from "../components/TVMediaCard";
import { TVEpisodeList } from "../components/TVEpisodeList";
import { PlayIcon, BookmarkIcon, BookmarkFilledIcon } from "../components/icons/TVIcons";
import { useTVRemote } from "../components/focus/useTVRemote";
import { useTVScrollToFocused } from "../hooks/useTVScrollToFocused";
import { Colors, Spacing, Typography, Radius, CardConfig } from "../theme/colors";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
type Props = NativeStackScreenProps<RootStackParamList, "MediaDetail">;

export function MediaDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation("common");
  const { itemId } = route.params;
  const client = useJellyfinClient();
  const { data: item } = useMediaItem(itemId);
  const isEpisode = item?.Type === "Episode";
  const { data: parentSeries } = useMediaItem(isEpisode ? item?.SeriesId : undefined);
  const similarId = isEpisode ? (item?.SeriesId ?? itemId) : itemId;
  const similarParentId = isEpisode ? parentSeries?.ParentId : item?.ParentId;
  const { data: similar } = useSimilarItems(similarId, similarParentId);
  const { add: addToWatchlist, remove: removeFromWatchlist } = useToggleWatchlist(itemId);

  const scrollRef = useRef<ScrollView>(null);
  useTVRemote({ onBack: () => navigation.goBack() });

  const scrollToButtons = useCallback(() => {
    // Scroll to top area so buttons are visible within the backdrop zone
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  // Cascade entry animations
  const titleAnim = useSharedValue(0);
  const metaAnim = useSharedValue(0);
  const synopsisAnim = useSharedValue(0);
  const buttonsAnim = useSharedValue(0);

  useEffect(() => {
    if (!item) return;
    titleAnim.value = withDelay(100, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
    metaAnim.value = withDelay(200, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
    synopsisAnim.value = withDelay(300, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
    buttonsAnim.value = withDelay(400, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
  }, [item, titleAnim, metaAnim, synopsisAnim, buttonsAnim]);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleAnim.value,
    transform: [{ translateX: (1 - titleAnim.value) * -30 }],
  }));
  const metaStyle = useAnimatedStyle(() => ({
    opacity: metaAnim.value,
    transform: [{ translateX: (1 - metaAnim.value) * -20 }],
  }));
  const synopsisStyle = useAnimatedStyle(() => ({
    opacity: synopsisAnim.value,
    transform: [{ translateX: (1 - synopsisAnim.value) * -20 }],
  }));
  const buttonsStyle = useAnimatedStyle(() => ({
    opacity: buttonsAnim.value,
    transform: [{ translateY: (1 - buttonsAnim.value) * 20 }],
  }));

  if (!item) return <View style={{ flex: 1, backgroundColor: Colors.bgDeep }} />;

  const hasParentBackdrop = isEpisode && (item.ParentBackdropImageTags?.length ?? 0) > 0;
  const backdropId = isEpisode
    ? (hasParentBackdrop ? (item.ParentBackdropItemId ?? item.SeriesId ?? item.Id) : item.Id)
    : item.Id;
  const backdrop = client.getImageUrl(backdropId, "Backdrop", { width: 1920, quality: 80 });
  const isSeries = item.Type === "Series";
  const year = item.ProductionYear;
  const rating = item.CommunityRating?.toFixed(1);
  const runtime = item.RunTimeTicks ? formatDuration(item.RunTimeTicks) : null;
  const resumePosition = item.UserData?.PlaybackPositionTicks;
  const resumeLabel = resumePosition
    ? `${t("resume")} ${Math.floor(ticksToSeconds(resumePosition) / 60)}:${String(Math.floor(ticksToSeconds(resumePosition) % 60)).padStart(2, "0")}`
    : t("play");

  // Detect media info tags
  const videoStream = item.MediaSources?.[0]?.MediaStreams?.find(
    (s: { Type: string }) => s.Type === "Video"
  );
  const tags: string[] = [];
  if (videoStream) {
    const h = (videoStream as { Height?: number }).Height;
    if (h && h >= 2160) tags.push("4K");
    else if (h && h >= 1080) tags.push("1080p");
    else if (h && h >= 720) tags.push("720p");
  }

  return (
    <ScrollView ref={scrollRef} style={{ flex: 1, backgroundColor: Colors.bgDeep }} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Full-screen backdrop */}
      <View style={{ width: SCREEN_W, height: SCREEN_H * 0.6 }}>
        <Image
          source={{ uri: backdrop }}
          style={{ width: "100%", height: "100%", position: "absolute" }}
          resizeMode="cover"
        />
        <LinearGradient
          colors={["transparent", "rgba(6,6,10,0.5)", Colors.bgDeep]}
          locations={[0, 0.5, 1]}
          style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "70%" }}
        />
        <LinearGradient
          colors={[Colors.bgDeep, "rgba(6,6,10,0.7)", "transparent"]}
          locations={[0, 0.4, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: SCREEN_W * 0.5 }}
        />
      </View>

      {/* Content zone */}
      <View style={{
        paddingHorizontal: Spacing.screenPadding,
        marginTop: -Math.round(SCREEN_H * 0.22),
      }}>
        {/* Title */}
        <Animated.View style={titleStyle}>
          <Text style={{ color: Colors.textPrimary, ...Typography.detailTitle }}>
            {item.Name}
          </Text>
        </Animated.View>

        {/* Metadata */}
        <Animated.View style={[{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: Spacing.titleToMeta }, metaStyle]}>
          {year && <Text style={{ color: Colors.textSecondary, ...Typography.meta }}>{year}</Text>}
          {rating && (
            <>
              <Text style={{ color: Colors.textTertiary }}>·</Text>
              <Text style={{ color: Colors.ratingGold, ...Typography.meta }}>★ {rating}</Text>
            </>
          )}
          {runtime && !isSeries && (
            <>
              <Text style={{ color: Colors.textTertiary }}>·</Text>
              <Text style={{ color: Colors.textMuted, ...Typography.meta }}>{runtime}</Text>
            </>
          )}
          {isSeries && item.ChildCount && (
            <>
              <Text style={{ color: Colors.textTertiary }}>·</Text>
              <Text style={{ color: Colors.textMuted, ...Typography.meta }}>
                {item.ChildCount} {t("seasons")}
              </Text>
            </>
          )}
        </Animated.View>

        {/* Genre pills + tags */}
        <Animated.View style={[{ flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" }, metaStyle]}>
          {tags.map((tag) => (
            <View key={tag} style={{
              backgroundColor: "rgba(139, 92, 246, 0.2)",
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
              borderWidth: 1, borderColor: "rgba(139, 92, 246, 0.3)",
            }}>
              <Text style={{ color: Colors.accentPurpleLight, fontSize: 14, fontWeight: "700" }}>{tag}</Text>
            </View>
          ))}
          {item.Genres?.map((g) => (
            <View key={g} style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6,
            }}>
              <Text style={{ color: Colors.textMuted, fontSize: 14 }}>{g}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Synopsis — not focusable, content scrolls via nestedScrollEnabled */}
        {item.Overview && (
          <Animated.View style={[{ marginTop: Spacing.metaToSynopsis, maxWidth: SCREEN_W * 0.55 }, synopsisStyle]}>
            <ScrollView style={{ maxHeight: 120 }} nestedScrollEnabled>
              <Text style={{ color: Colors.textSecondary, ...Typography.synopsis, lineHeight: 28 }}>
                {item.Overview}
              </Text>
            </ScrollView>
          </Animated.View>
        )}

        {/* Buttons */}
        <Animated.View style={[{ flexDirection: "row", gap: Spacing.buttonGap, marginTop: Spacing.synopsisToButtons }, buttonsStyle]}>
          <Focusable variant="button" onPress={() => navigation.navigate("Player", { itemId: item.Id })} hasTVPreferredFocus onFocus={scrollToButtons}>
            <View style={{
              backgroundColor: Colors.accentPurple,
              paddingHorizontal: 40, paddingVertical: 16,
              borderRadius: Radius.buttonLarge,
              flexDirection: "row", alignItems: "center", gap: 10,
            }}>
              <PlayIcon size={20} color={Colors.textPrimary} />
              <Text style={{ color: Colors.textPrimary, ...Typography.buttonLarge }}>{resumeLabel}</Text>
            </View>
          </Focusable>
          <Focusable variant="button" onPress={() => item.UserData?.Likes ? removeFromWatchlist.mutate() : addToWatchlist.mutate()} onFocus={scrollToButtons}>
            <View style={{
              backgroundColor: Colors.glassBg,
              paddingHorizontal: 28, paddingVertical: 16,
              borderRadius: Radius.buttonLarge,
              borderWidth: 1, borderColor: Colors.glassBorder,
              flexDirection: "row", alignItems: "center", gap: 10,
            }}>
              {item.UserData?.Likes
                ? <BookmarkFilledIcon size={18} color={Colors.accentPurple} />
                : <BookmarkIcon size={18} color={Colors.textSecondary} />
              }
              <Text style={{ color: Colors.textPrimary, ...Typography.buttonLarge }}>
                {item.UserData?.Likes ? t("removeFromMyList") : t("addToMyList")}
              </Text>
            </View>
          </Focusable>
        </Animated.View>
      </View>

      {/* Episodes for series */}
      {isSeries && (
        <View style={{ marginTop: Spacing.sectionGap }}>
          <TVEpisodeList seriesId={item.Id} onPlay={(ep) => navigation.navigate("Player", { itemId: ep.Id })} />
        </View>
      )}

      {/* Similar items */}
      {similar && similar.length > 0 && (
        <FocusableRow
          title={t("similarTitles")}
          data={similar}
          renderItem={(s: MediaItem) => <TVMediaCard item={s} />}
          keyExtractor={(s) => s.Id}
          itemWidth={CardConfig.portrait.width}
          style={{ marginTop: Spacing.sectionGap }}
          onItemPress={(s: MediaItem) => navigation.push("MediaDetail", { itemId: s.Id })}
          onRowFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
        />
      )}
    </ScrollView>
  );
}
