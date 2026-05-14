import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from "react-native-reanimated";
import { GradientOverlay } from "@/components/ui";
import { colors, spacing, typography, BRAND, CTA, FONT_FAMILY, RADIUS, SURFACE, STATUS } from "@/theme";

const ROTATE_MS = 9000;
const FADE_MS = 900;

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

/**
 * Hero Billboard cinematic — swipe horizontal pageEnabled + crossfade backdrop
 * + auto-rotate 9s. Logo image si dispo, halo violet sur CTA Lecture.
 */
export const HeroBanner = memo(function HeroBanner({ items, onPlay, onInfo }: HeroBannerProps) {
  const { width: SCREEN_W, height: screenH } = useWindowDimensions();
  const BANNER_H = Math.min(720, Math.round(screenH * 0.82));
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<MediaItem>>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [index, setIndex] = useState(0);
  const userScrollingRef = useRef(false);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (items.length <= 1) return;
    timerRef.current = setInterval(() => {
      if (userScrollingRef.current) return;
      setIndex((p) => {
        const next = (p + 1) % items.length;
        listRef.current?.scrollToOffset({ offset: next * SCREEN_W, animated: true });
        return next;
      });
    }, ROTATE_MS);
  }, [items.length, SCREEN_W]);

  useEffect(() => { startTimer(); return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, [startTimer]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setIndex(newIndex);
    userScrollingRef.current = false;
    startTimer();
  };

  if (!items.length) return <View style={{ height: BANNER_H }} />;

  return (
    <View style={{ width: SCREEN_W, height: BANNER_H, overflow: "hidden", backgroundColor: SURFACE.s0 }}>
      {/* Backdrop crossfade entre tous les slides (en arrière-plan, derrière la list scrollable) */}
      <BackdropStack items={items} activeIndex={index} />

      {/* Triple gradient cinema overlay */}
      <GradientOverlay direction="top" height={120 + insets.top} color="#000000" intensity="soft" />
      <GradientOverlay direction="bottom" height={BANNER_H * 0.62} color="#000000" intensity="strong" />

      {/* FlatList horizontal pageEnabled pour le swipe — content uniquement, backdrop derrière */}
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(it) => it.Id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onScrollBeginDrag={() => { userScrollingRef.current = true; if (timerRef.current) clearInterval(timerRef.current); }}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
        style={StyleSheet.absoluteFillObject}
        renderItem={({ item }) => (
          <View style={[st.slide, { width: SCREEN_W, height: BANNER_H, paddingTop: insets.top + 28 }]}>
            <View style={st.contentInner}>
              <HeroContent item={item} onPlay={onPlay} onInfo={onInfo} />
            </View>
          </View>
        )}
      />

      {/* Dots indicateurs */}
      {items.length > 1 && (
        <View style={[st.dots, { bottom: BANNER_H * 0.04 }]} pointerEvents="none">
          {items.map((_, i) => (
            <View key={i} style={[st.dot, i === index ? st.dotOn : st.dotOff]} />
          ))}
        </View>
      )}
    </View>
  );
});

/* ── Backdrop stack (crossfade) ─────────────────────────────────────────── */

function BackdropStack({ items, activeIndex }: { items: MediaItem[]; activeIndex: number }) {
  const client = useJellyfinClient();
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {items.map((it, i) => {
        const isEp = it.Type === "Episode";
        const hasParentBackdrop = (it.ParentBackdropImageTags?.length ?? 0) > 0;
        const hasOwnBackdrop = (it.BackdropImageTags?.length ?? 0) > 0;
        if (!hasParentBackdrop && !hasOwnBackdrop && !it.ImageTags?.Primary) return null;
        const backdropId = isEp
          ? (hasParentBackdrop ? (it.ParentBackdropItemId ?? it.SeriesId ?? it.Id) : it.Id)
          : it.Id;
        const url = (hasParentBackdrop || hasOwnBackdrop)
          ? client.getImageUrl(backdropId, "Backdrop", { width: 1280, quality: 85 })
          : client.getImageUrl(it.Id, "Primary", { width: 1280, quality: 85 });
        return <CrossfadeImage key={it.Id} url={url} active={i === activeIndex} />;
      })}
    </View>
  );
}

function CrossfadeImage({ url, active }: { url: string; active: boolean }) {
  const opacity = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    opacity.value = withTiming(active ? 1 : 0, { duration: FADE_MS, easing: Easing.out(Easing.cubic) });
  }, [active, opacity]);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, animStyle]}>
      <Image source={{ uri: url }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={0} />
    </Animated.View>
  );
}

/* ── Hero content (logo / titre + CTAs avec halo brand) ─────────────────── */

interface HeroContentProps {
  item: MediaItem;
  onPlay: (item: MediaItem) => void;
  onInfo: (item: MediaItem) => void;
}

function HeroContent({ item, onPlay, onInfo }: HeroContentProps): ReactNode {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const isEpisode = item.Type === "Episode";
  const logoId = isEpisode && item.SeriesId ? item.SeriesId : item.Id;
  const hasLogo = item.ImageTags?.Logo != null;
  const logoUrl = hasLogo ? client.getImageUrl(logoId, "Logo", { width: 500, quality: 90 }) : null;
  const displayName = isEpisode ? (item.SeriesName ?? item.Name) : item.Name;
  const episodeLabel = isEpisode
    ? `S${String(item.ParentIndexNumber ?? 1).padStart(2, "0")}E${String(item.IndexNumber ?? 1).padStart(2, "0")} · ${item.Name}`
    : null;
  const progress = item.UserData?.PlayedPercentage ?? 0;
  const hasProgress = progress > 0 && progress < 100;
  const isWatched = item.UserData?.Played === true;
  const genres = item.Genres?.slice(0, 2) ?? [];
  const runtime = item.RunTimeTicks ? formatRuntime(item.RunTimeTicks) : null;

  return (
    <View>
      {(hasProgress || isWatched || episodeLabel) && (
        <View style={st.tagRow}>
          {hasProgress && (
            <View style={st.continueTag}>
              <Feather name="play" size={9} color="#fff" fill="#fff" />
              <Text style={st.continueTagTxt}>{t("continueLabel")}</Text>
            </View>
          )}
          {isWatched && !hasProgress && (
            <View style={st.continueTag}>
              <Feather name="check" size={10} color="#000" />
              <Text style={st.continueTagTxt}>{t("watched")}</Text>
            </View>
          )}
          {episodeLabel && <Text style={st.epLabel} numberOfLines={1}>{episodeLabel}</Text>}
        </View>
      )}

      {logoUrl ? (
        <Image source={{ uri: logoUrl }} style={st.logo} contentFit="contain" />
      ) : (
        <Text style={st.title} numberOfLines={2} maxFontSizeMultiplier={1.2}>{displayName}</Text>
      )}

      <View style={st.meta}>
        {item.ProductionYear != null && <Text style={st.metaTxt}>{item.ProductionYear}</Text>}
        {item.OfficialRating != null && (
          <View style={st.rBadge}><Text style={st.rBadgeTxt}>{item.OfficialRating}</Text></View>
        )}
        {item.CommunityRating != null && (
          <View style={st.ratingBox}>
            <Feather name="star" size={11} color={STATUS.rating} />
            <Text style={st.rating}>{item.CommunityRating.toFixed(1)}</Text>
          </View>
        )}
        {runtime && <Text style={st.metaTxt}>{runtime}</Text>}
        {genres.map((g) => <Text key={g} style={st.metaTxtMuted}>· {g}</Text>)}
      </View>

      {item.Overview != null && <Text style={st.overview} numberOfLines={2}>{item.Overview}</Text>}

      {hasProgress && (
        <View style={st.progRow}>
          <View style={st.progTrack}>
            <View style={[st.progFill, { width: `${progress}%` as unknown as number }]} />
          </View>
          <Text style={st.progLbl}>{Math.round(progress)}%</Text>
        </View>
      )}

      <View style={st.btns}>
        <Pressable
          style={({ pressed }) => [st.playBtn, pressed && { opacity: 0.88 }]}
          onPress={() => onPlay(item)}
          accessibilityRole="button"
          accessibilityLabel={`${hasProgress ? t("resume") : t("play")} ${item.Name}`}
        >
          <Feather name="play" size={20} color={CTA.primaryFg} fill={CTA.primaryFg} />
          <Text style={st.playTxt}>{hasProgress ? t("resume") : t("play")}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [st.infoBtn, pressed && { opacity: 0.88 }]}
          onPress={() => onInfo(item)}
          accessibilityRole="button"
          accessibilityLabel={`${t("moreInfo")} ${item.Name}`}
        >
          <Feather name="info" size={16} color="#fff" />
          <Text style={st.infoTxt}>{t("moreInfo")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  slide: { justifyContent: "flex-end" as const, paddingHorizontal: spacing.screenPadding, paddingBottom: 56 },
  contentInner: { width: "100%" as const },
  tagRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, marginBottom: 12, flexWrap: "wrap" as const },
  continueTag: { flexDirection: "row" as const, alignItems: "center" as const, gap: 5, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 3, paddingHorizontal: 7, paddingVertical: 3 },
  continueTagTxt: { fontSize: 9.5, fontFamily: FONT_FAMILY.extrabold, color: "#000", letterSpacing: 1.6, textTransform: "uppercase" as const },
  epLabel: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: "rgba(255,255,255,0.6)", letterSpacing: 0.2 },
  logo: { width: 280, maxWidth: "85%", height: 92, marginBottom: 14 },
  title: { fontSize: 38, fontFamily: FONT_FAMILY.extrabold, color: colors.textPrimary, marginBottom: 14, letterSpacing: -0.8, lineHeight: 42, textShadowColor: "rgba(0,0,0,0.7)", textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 12 },
  meta: { flexDirection: "row" as const, alignItems: "center" as const, gap: 9, marginBottom: 10, flexWrap: "wrap" as const },
  metaTxt: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: "rgba(255,255,255,0.88)" },
  metaTxtMuted: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: "rgba(255,255,255,0.6)" },
  rBadge: { borderWidth: 1, borderColor: "rgba(255,255,255,0.45)", borderRadius: 3, paddingHorizontal: 5, paddingVertical: 0.5 },
  rBadgeTxt: { fontSize: 9, fontFamily: FONT_FAMILY.bold, color: "rgba(255,255,255,0.85)", letterSpacing: 0.6 },
  ratingBox: { flexDirection: "row" as const, alignItems: "center" as const, gap: 3 },
  rating: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: STATUS.rating },
  overview: { ...typography.body, fontFamily: FONT_FAMILY.regular, color: "rgba(255,255,255,0.85)", lineHeight: 21, marginBottom: 18, textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  progRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, marginBottom: 18, maxWidth: 280 },
  progTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.22)", overflow: "hidden" as const },
  progFill: { height: "100%" as const, borderRadius: 2, backgroundColor: BRAND.violet },
  progLbl: { fontSize: 11, fontFamily: FONT_FAMILY.bold, color: "rgba(255,255,255,0.65)" },
  btns: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10 },
  playBtn: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 9,
    backgroundColor: CTA.primaryBg, borderRadius: RADIUS.md, paddingVertical: 13, paddingHorizontal: 26,
    shadowColor: BRAND.violet, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.55, shadowRadius: 22, elevation: 12,
  },
  playTxt: { fontSize: 16, fontFamily: FONT_FAMILY.bold, color: CTA.primaryFg, letterSpacing: 0.1 },
  infoBtn: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 6,
    backgroundColor: BRAND.ghost, borderRadius: RADIUS.md, paddingVertical: 13, paddingHorizontal: 18,
    borderWidth: 1, borderColor: "rgba(139,92,246,0.4)",
  },
  infoTxt: { fontSize: 15, fontFamily: FONT_FAMILY.semibold, color: "#fff" },
  dots: { position: "absolute" as const, left: 0, right: 0, flexDirection: "row" as const, justifyContent: "center" as const, alignItems: "center" as const, gap: 5 },
  dot: { height: 3, borderRadius: 2 },
  dotOn: { width: 22, backgroundColor: BRAND.violet, shadowColor: BRAND.violet, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 8 },
  dotOff: { width: 6, backgroundColor: "rgba(255,255,255,0.32)" },
});
