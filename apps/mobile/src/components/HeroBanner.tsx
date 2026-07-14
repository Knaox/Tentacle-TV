import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList, StyleSheet, View, useWindowDimensions,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from "react-native-reanimated";
import { GradientOverlay } from "@/components/ui";
import { spacing, TABLET_MIN_WIDTH, useRailWidth, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { HeroContent } from "./HeroBannerContent";

// Synced with web/HeroBackdrop : the new slide arrives exactly when the
// scale 1 → 1.06 zoom cycle ends, so the carousel feels like an uninterrupted
// camera travel rather than a snapping slideshow.
const ROTATE_MS = 8000;
const FADE_MS = 1200;
const ZOOM_TARGET = 1.06;

interface HeroBannerProps {
  items: MediaItem[];
  onPlay: (item: MediaItem) => void;
  onInfo: (item: MediaItem) => void;
}

/** Hero Billboard cinematic — swipe pageEnabled + Ken Burns backdrop synced with auto-rotate (see ROTATE_MS). */
export const HeroBanner = memo(function HeroBanner({ items, onPlay, onInfo }: HeroBannerProps) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const { width: SCREEN_W, height: screenH } = useWindowDimensions();
  const isTablet = Math.min(SCREEN_W, screenH) >= TABLET_MIN_WIDTH;
  // Largeur RÉELLE du viewport hero : fenêtre − rail latéral (iPad paysage).
  // Sans ça, les slides paginent sur la largeur fenêtre et dérivent du viewport.
  const SLIDE_W = SCREEN_W - useRailWidth();
  // 0.74 instead of 0.82 — leaves room below the hero for "Reprendre la lecture"
  // section header to be fully visible above the floating tab bar on iPhone 17.
  // Cap relevé sur tablette pour un hero plus immersif.
  const BANNER_H = Math.min(isTablet ? 820 : 660, Math.round(screenH * 0.74));
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<MediaItem>>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(index);
  useEffect(() => { indexRef.current = index; }, [index]);
  const userScrollingRef = useRef(false);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (items.length <= 1) return;
    timerRef.current = setInterval(() => {
      if (userScrollingRef.current) return;
      setIndex((p) => {
        const next = (p + 1) % items.length;
        listRef.current?.scrollToOffset({ offset: next * SLIDE_W, animated: true });
        return next;
      });
    }, ROTATE_MS);
  }, [items.length, SLIDE_W]);

  // Resync scroll on focus via indexRef — reading `index` directly would re-run
  // this effect on every auto-advance, killing the FlatList's animated scroll.
  useFocusEffect(useCallback(() => {
    const raf = requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: indexRef.current * SLIDE_W, animated: false }));
    startTimer();
    return () => { cancelAnimationFrame(raf); if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimer, SLIDE_W]));

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / SLIDE_W);
    setIndex(newIndex);
    userScrollingRef.current = false;
    startTimer();
  };

  if (!items.length) return <View style={{ height: BANNER_H }} />;

  return (
    <View style={{ width: SLIDE_W, height: BANNER_H, overflow: "hidden", backgroundColor: theme.colors.surface.s0 }}>
      <BackdropStack items={items} activeIndex={index} />
      {/* Fades suivant le thème (défaut surface.s0) : noir pur en sombre —
          identiques à l'ancien "#000000" —, clairs en light pour fondre le
          hero dans la page et garder le statut/haut lisibles. */}
      <GradientOverlay direction="top" height={120 + insets.top} intensity="soft" />
      <GradientOverlay direction="bottom" height={BANNER_H * 0.62} intensity="strong" />
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
        getItemLayout={(_, i) => ({ length: SLIDE_W, offset: SLIDE_W * i, index: i })}
        style={StyleSheet.absoluteFillObject}
        renderItem={({ item }) => (
          <View style={[st.slide, { width: SLIDE_W, height: BANNER_H, paddingTop: Math.max(insets.top, 24) + 28 }]}>
            <View style={st.contentInner}>
              <HeroContent item={item} onPlay={onPlay} onInfo={onInfo} />
            </View>
          </View>
        )}
      />

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
  // Linear scale 1 → 1.06 over ROTATE_MS — perceived as constant-speed travel.
  // No reset when becoming inactive: the image fades to opacity 0 first, then
  // the next activation snaps scale back to 1 *while invisible*, avoiding the
  // visible "scale pop" that would happen otherwise.
  const opacity = useSharedValue(active ? 1 : 0);
  const scale = useSharedValue(active ? ZOOM_TARGET : 1);
  useEffect(() => {
    opacity.value = withTiming(active ? 1 : 0, { duration: FADE_MS, easing: Easing.out(Easing.cubic) });
    if (active) { scale.value = 1; scale.value = withTiming(ZOOM_TARGET, { duration: ROTATE_MS, easing: Easing.linear }); }
  }, [active, opacity, scale]);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, animStyle]}>
      <Image source={{ uri: url }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={0} />
    </Animated.View>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  slide: { justifyContent: "flex-end" as const, paddingHorizontal: spacing.screenPadding, paddingBottom: 56 },
  contentInner: { width: "100%" as const, maxWidth: 640 },
  dots: { position: "absolute" as const, left: 0, right: 0, flexDirection: "row" as const, justifyContent: "center" as const, alignItems: "center" as const, gap: 5 },
  dot: { height: 3, borderRadius: 2 },
  dotOn: { width: 22, backgroundColor: t.colors.brand.violet, shadowColor: t.colors.brand.violet, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 8 },
  dotOff: { width: 6, backgroundColor: t.colors.text.quaternary },
});
