import { useState, useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import { View, Text, Pressable, FlatList, type ScrollView } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useSeasons, useEpisodes, useJellyfinClient, useWatchedToggle, useBatchWatchedToggle } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, useTheme, withAlpha } from "@/theme";
import { MetaTokens } from "./detail/MetaTokens";

let Haptics: { impactAsync: (style: any) => void; ImpactFeedbackStyle: any } | null = null;
try { Haptics = require("expo-haptics"); } catch { /* native module not available */ }

interface Props {
  seriesId: string;
  onPlay: (episode: MediaItem) => void;
  /** Épisode à surligner (« épisode actuel » / à reprendre). */
  currentEpisodeId?: string;
  /** Saison à présélectionner (saison de l'épisode courant). */
  initialSeasonId?: string;
  /**
   * ScrollView porteur : la ligne de l'épisode courant s'y amène d'elle-même à
   * l'ouverture — une saison longue ne se parcourt plus à la main.
   */
  scrollTargetRef?: RefObject<ScrollView | null>;
}

export function MobileEpisodeList({ seriesId, onPlay, currentEpisodeId, initialSeasonId, scrollTargetRef }: Props) {
  const { colors, isDark } = useTheme();
  const { data: seasons } = useSeasons(seriesId);
  const [selectedSeason, setSelectedSeason] = useState<string | undefined>(undefined);

  const activeSeason = selectedSeason ?? initialSeasonId ?? seasons?.[0]?.Id;
  // La sélection parle ROSE désormais — même langage que l'épisode courant du
  // desktop (accent-soft / accent-light).
  const accentText = isDark ? colors.brand.accentLight : colors.brand.accent;

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
          renderItem={({ item: season }) => {
            const isActive = activeSeason === season.Id;
            return (
              <Pressable
                onPress={() => setSelectedSeason(season.Id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                style={{
                  backgroundColor: isActive ? withAlpha(colors.brand.accent, 0.15, colors.brand.soft) : colors.fill.subtle,
                  borderWidth: 1,
                  borderColor: isActive ? withAlpha(colors.brand.accent, 0.45, colors.brand.glow) : colors.border.subtle,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: RADIUS.pill,
                  minHeight: 36,
                  justifyContent: "center",
                }}
              >
                <Text style={{
                  color: isActive ? accentText : colors.text.tertiary,
                  fontSize: 13,
                  fontFamily: isActive ? FONT_FAMILY.semibold : FONT_FAMILY.medium,
                  letterSpacing: 0.1,
                }}>
                  {season.Name}
                </Text>
              </Pressable>
            );
          }}
        />
      )}

      {activeSeason && (
        <EpisodeItems
          seriesId={seriesId}
          seasonId={activeSeason}
          onPlay={onPlay}
          currentEpisodeId={currentEpisodeId}
          // Le ciblage ne vaut que pour la saison de l'épisode courant — changer
          // d'onglet à la main ne doit pas re-scroller.
          scrollTargetRef={selectedSeason === undefined ? scrollTargetRef : undefined}
        />
      )}
    </View>
  );
}

/* ── Season action bar ──────────────────────────── */

function SeasonActionBar({ seriesId, seasonId, episodes }: {
  seriesId: string; seasonId: string; episodes: MediaItem[];
}) {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
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
        backgroundColor: colors.fill.subtle,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        opacity: isBusy ? 0.4 : 1,
      }}
    >
      <Feather name={allWatched ? "eye-off" : "eye"} size={14} color={colors.text.tertiary} />
      <Text style={{ color: colors.text.tertiary, fontSize: 12, fontWeight: "600" }}>
        {allWatched ? t("markSeasonUnwatched") : t("markSeasonWatched")}
      </Text>
    </Pressable>
  );
}

/* ── Episode thumbnail ──────────────────────────── */

function EpisodeThumb({ ep, seriesId, client }: {
  ep: MediaItem; seriesId: string; client: ReturnType<typeof useJellyfinClient>;
}) {
  const { colors } = useTheme();
  const hasPrimary = !!ep.ImageTags?.Primary;
  const thumbUrl = hasPrimary
    ? client.getImageUrl(ep.Id, "Primary", { width: 300, quality: 70 })
    : client.getImageUrl(seriesId, "Backdrop", { width: 300, quality: 70 });
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <View style={{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center", backgroundColor: colors.surface.s2 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text.tertiary }}>
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

function EpisodeItemRow({ ep, seriesId, seasonId, client, onPlay, isCurrent }: {
  ep: MediaItem; seriesId: string; seasonId: string;
  client: ReturnType<typeof useJellyfinClient>; onPlay: (ep: MediaItem) => void; isCurrent?: boolean;
}) {
  const { t } = useTranslation("common");
  const { colors, isDark } = useTheme();
  // Texte d'accent lisible : la nuance vive en sombre, la foncée en clair —
  // même arbitrage que le web (accent-light / accent).
  const accentText = isDark ? colors.brand.accentLight : colors.brand.accent;
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
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.fill.faint, borderRadius: 10, overflow: "hidden", minHeight: thumbH }}>
      <Pressable onPress={() => onPlay(ep)} style={{ flexDirection: "row", flex: 1 }}>
        <View style={{ width: thumbW, height: thumbH, alignSelf: "center", backgroundColor: colors.surface.s2, borderRadius: 6, overflow: "hidden" }}>
          <EpisodeThumb ep={ep} seriesId={seriesId} client={client} />
          {progress != null && progress > 0 && (
            <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, backgroundColor: colors.fill.strong }}>
              <LinearGradient
                colors={[colors.brand.violet, colors.brand.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ height: "100%", width: `${progress}%` }}
              />
            </View>
          )}
        </View>
        <View style={{ flex: 1, padding: 10, justifyContent: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {isCurrent && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brand.accent }} />}
            <Text numberOfLines={1} style={{ flex: 1, color: colors.text.primary, fontSize: 13, fontWeight: isCurrent ? "800" : "600" }}>
              {epLabel}{ep.Name}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
            {isCurrent && (
              <Text style={{ color: accentText, fontSize: 10, fontFamily: FONT_FAMILY.bold, letterSpacing: 0.6, textTransform: "uppercase" }}>
                {t("currentEpisode")}
              </Text>
            )}
            {runtime && <Text style={{ color: colors.text.quaternary, fontSize: 11 }}>{t("minutesShort", { count: runtime })}</Text>}
          </View>
          <MetaTokens item={ep} compact />
          {ep.Overview && (
            <Text numberOfLines={2} style={{ color: colors.text.quaternary, fontSize: 11, marginTop: 4, lineHeight: 15 }}>
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
              width: 30,
              height: 30,
              borderRadius: 15,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: played ? withAlpha(colors.brand.accent, 0.15, colors.brand.soft) : colors.fill.subtle,
              borderWidth: 1,
              borderColor: played ? withAlpha(colors.brand.accent, 0.45, colors.brand.glow) : colors.border.subtle,
            },
          ]}
        >
          <Feather name="check" size={16} color={played ? accentText : colors.text.disabled} />
        </Animated.View>
      </Pressable>
    </View>
  );
}

/* ── Episode list for a season ──────────────────── */

function EpisodeItems({ seriesId, seasonId, onPlay, currentEpisodeId, scrollTargetRef }: {
  seriesId: string; seasonId: string; onPlay: (ep: MediaItem) => void; currentEpisodeId?: string;
  scrollTargetRef?: RefObject<ScrollView | null>;
}) {
  const client = useJellyfinClient();
  const { data: episodes } = useEpisodes(seriesId, seasonId);

  // L'épisode courant s'amène à l'écran DE LUI-MÊME, une seule fois par
  // ouverture : une saison de quarante épisodes ne se parcourt plus au doigt.
  const currentRowRef = useRef<View | null>(null);
  const didAutoScrollRef = useRef(false);
  const hasCurrent = !!currentEpisodeId && !!episodes?.some((ep) => ep.Id === currentEpisodeId);
  useEffect(() => {
    if (!hasCurrent || didAutoScrollRef.current) return;
    const scroll = scrollTargetRef?.current;
    const row = currentRowRef.current;
    if (!scroll || !row) return;
    // Un tick pour laisser le layout se poser avant de mesurer. La position se
    // calcule en coordonnées FENÊTRE (delta ligne − scroll) : `measureLayout`
    // exigerait une ref native que le wrapper ScrollView n'expose pas.
    const timer = setTimeout(() => {
      const host = (scroll as unknown as {
        getNativeScrollRef?: () => { measureInWindow?: (cb: (x: number, y: number) => void) => void } | null;
      }).getNativeScrollRef?.();
      if (!host?.measureInWindow) return;
      row.measureInWindow((_rowX, rowY) => {
        host.measureInWindow!((_scrollX, scrollY) => {
          didAutoScrollRef.current = true;
          scroll.scrollTo({ y: Math.max(0, rowY - scrollY - 96), animated: false });
        });
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [hasCurrent, scrollTargetRef]);

  if (!episodes || episodes.length === 0) return null;

  return (
    <View style={{ maxWidth: 640, width: "100%" }}>
      <SeasonActionBar seriesId={seriesId} seasonId={seasonId} episodes={episodes} />
      <View style={{ paddingHorizontal: 16, gap: 8 }}>
        {episodes.map((ep) => {
          const isCurrent = ep.Id === currentEpisodeId;
          return (
            <View key={ep.Id} ref={isCurrent ? currentRowRef : undefined} collapsable={false}>
              <EpisodeItemRow ep={ep} seriesId={seriesId} seasonId={seasonId} client={client} onPlay={onPlay} isCurrent={isCurrent} />
            </View>
          );
        })}
      </View>
    </View>
  );
}
