import { useState, useCallback, useMemo } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { Image } from "expo-image";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useSeasons, useEpisodes, useJellyfinClient, useWatchedToggle, useBatchWatchedToggle } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { colors } from "@/theme";

let Haptics: { impactAsync: (style: any) => void; ImpactFeedbackStyle: any } | null = null;
try { Haptics = require("expo-haptics"); } catch { /* native module not available */ }

interface Props {
  seriesId: string;
  onPlay: (episode: MediaItem) => void;
}

export function MobileEpisodeList({ seriesId, onPlay }: Props) {
  const { data: seasons } = useSeasons(seriesId);
  const [selectedSeason, setSelectedSeason] = useState<string | undefined>(undefined);

  const activeSeason = selectedSeason ?? seasons?.[0]?.Id;

  return (
    <View style={{ marginTop: 24 }}>
      {/* Season tabs */}
      {seasons && seasons.length > 0 && (
        <FlatList
          horizontal
          data={seasons}
          keyExtractor={(s) => s.Id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginBottom: 12 }}
          renderItem={({ item: season }) => (
            <Pressable
              onPress={() => setSelectedSeason(season.Id)}
              style={{
                backgroundColor: activeSeason === season.Id ? colors.accent : "rgba(255,255,255,0.05)",
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
              }}
            >
              <Text style={{
                color: activeSeason === season.Id ? "#fff" : "rgba(255,255,255,0.6)",
                fontSize: 13, fontWeight: "600",
              }}>
                {season.Name}
              </Text>
            </Pressable>
          )}
        />
      )}

      {activeSeason && (
        <EpisodeItems seriesId={seriesId} seasonId={activeSeason} onPlay={onPlay} />
      )}
    </View>
  );
}

/* ── Season action bar ──────────────────────────── */

function SeasonActionBar({ seriesId, seasonId, episodes }: {
  seriesId: string; seasonId: string; episodes: MediaItem[];
}) {
  const { t } = useTranslation("common");
  const batchCtx = useMemo(() => ({ seriesId, seasonId }), [seriesId, seasonId]);
  const { markWatched, markUnwatched } = useBatchWatchedToggle(batchCtx);
  const allWatched = useMemo(() => episodes.every((ep) => ep.UserData?.Played), [episodes]);
  const episodeIds = useMemo(() => episodes.map((ep) => ep.Id), [episodes]);
  const isBusy = markWatched.isPending || markUnwatched.isPending;

  const handleToggle = useCallback(() => {
    Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (allWatched) {
      markUnwatched.mutate(episodeIds);
    } else {
      markWatched.mutate(episodeIds);
    }
  }, [allWatched, episodeIds, markWatched, markUnwatched]);

  return (
    <Pressable
      onPress={handleToggle}
      disabled={isBusy}
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 6,
        marginHorizontal: 16,
        marginBottom: 10,
        backgroundColor: "rgba(255,255,255,0.05)",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        opacity: isBusy ? 0.4 : 1,
      }}
    >
      <Feather name={allWatched ? "eye-off" : "eye"} size={14} color="rgba(255,255,255,0.6)" />
      <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "600" }}>
        {allWatched ? t("markSeasonUnwatched") : t("markSeasonWatched")}
      </Text>
    </Pressable>
  );
}

/* ── Episode thumbnail ──────────────────────────── */

function EpisodeThumb({ ep, seriesId, client }: {
  ep: MediaItem; seriesId: string; client: ReturnType<typeof useJellyfinClient>;
}) {
  const hasPrimary = !!ep.ImageTags?.Primary;
  const thumbUrl = hasPrimary
    ? client.getImageUrl(ep.Id, "Primary", { width: 300, quality: 70 })
    : client.getImageUrl(seriesId, "Backdrop", { width: 300, quality: 70 });
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <View style={{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceElevated }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textMuted }}>
          {ep.IndexNumber != null ? `E${ep.IndexNumber}` : ep.Name?.charAt(0).toUpperCase() ?? "?"}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: thumbUrl }}
      style={{ width: "100%", height: "100%" }}
      contentFit="cover"
      onError={() => setImgError(true)}
    />
  );
}

/* ── Single episode row with watched toggle ──────── */

function EpisodeItemRow({ ep, seriesId, seasonId, client, onPlay }: {
  ep: MediaItem; seriesId: string; seasonId: string;
  client: ReturnType<typeof useJellyfinClient>; onPlay: (ep: MediaItem) => void;
}) {
  const { t } = useTranslation("common");
  const { markWatched, markUnwatched } = useWatchedToggle(ep.Id, { seriesId, seasonId });
  const played = ep.UserData?.Played === true;
  const progress = ep.UserData?.PlayedPercentage;
  const runtime = ep.RunTimeTicks ? Math.round(ep.RunTimeTicks / 600_000_000) : null;
  const epLabel = ep.IndexNumber != null
    ? `S${String(ep.ParentIndexNumber ?? 1).padStart(2, "0")}E${String(ep.IndexNumber).padStart(2, "0")} \u00b7 `
    : "";

  const thumbW = 110;
  const thumbH = 62;

  // Animated scale for toggle button
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handleToggle = useCallback(() => {
    Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(0.7, { damping: 8, stiffness: 300 }, () => {
      scale.value = withSpring(1, { damping: 8, stiffness: 300 });
    });
    if (played) {
      markUnwatched.mutate();
    } else {
      markWatched.mutate();
    }
  }, [played, markWatched, markUnwatched, scale]);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 10, overflow: "hidden", minHeight: thumbH }}>
      <Pressable onPress={() => onPlay(ep)} style={{ flexDirection: "row", flex: 1 }}>
        <View style={{ width: thumbW, height: thumbH, alignSelf: "center", backgroundColor: colors.surfaceElevated, borderRadius: 6, overflow: "hidden" }}>
          <EpisodeThumb ep={ep} seriesId={seriesId} client={client} />
          {progress != null && progress > 0 && (
            <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, backgroundColor: "rgba(255,255,255,0.2)" }}>
              <View style={{ height: "100%", width: `${progress}%`, backgroundColor: colors.accent }} />
            </View>
          )}
        </View>
        <View style={{ flex: 1, padding: 10, justifyContent: "center" }}>
          <Text numberOfLines={1} style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>
            {epLabel}{ep.Name}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
            {runtime && <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{t("minutesShort", { count: runtime })}</Text>}
          </View>
          {ep.Overview && (
            <Text numberOfLines={2} style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 4, lineHeight: 15 }}>
              {ep.Overview}
            </Text>
          )}
        </View>
      </Pressable>

      {/* Watched toggle button */}
      <Pressable
        onPress={handleToggle}
        hitSlop={12}
        accessibilityLabel={played ? t("markUnwatched") : t("markWatched")}
        style={{ paddingRight: 12, paddingLeft: 4 }}
      >
        <Animated.View
          style={[
            animStyle,
            {
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: played ? colors.accent : "rgba(255,255,255,0.06)",
            },
          ]}
        >
          <Feather name="check" size={16} color={played ? "#fff" : "rgba(255,255,255,0.25)"} />
        </Animated.View>
      </Pressable>
    </View>
  );
}

/* ── Episode list for a season ──────────────────── */

function EpisodeItems({ seriesId, seasonId, onPlay }: {
  seriesId: string; seasonId: string; onPlay: (ep: MediaItem) => void;
}) {
  const client = useJellyfinClient();
  const { data: episodes } = useEpisodes(seriesId, seasonId);

  if (!episodes || episodes.length === 0) return null;

  return (
    <View>
      <SeasonActionBar seriesId={seriesId} seasonId={seasonId} episodes={episodes} />
      <View style={{ paddingHorizontal: 16, gap: 8 }}>
        {episodes.map((ep) => (
          <EpisodeItemRow key={ep.Id} ep={ep} seriesId={seriesId} seasonId={seasonId} client={client} onPlay={onPlay} />
        ))}
      </View>
    </View>
  );
}
