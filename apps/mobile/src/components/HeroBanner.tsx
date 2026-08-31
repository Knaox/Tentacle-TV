import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList, StyleSheet, View,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from "react-native-reanimated";
import { GradientOverlay } from "@/components/ui";
import { motion, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";
import { HeroContent } from "./HeroBannerContent";
import { useHeroMetrics } from "./heroMetrics";

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

/**
 * Hero Billboard cinématique — désormais une CARTE, comme sur le bureau :
 * gouttières latérales, rayon 20, liseré de marque (--hero-frame-ring).
 * Swipe pagingEnabled + Ken Burns synchronisé sur l'auto-rotation.
 */
export const HeroBanner = memo(function HeroBanner({ items, onPlay, onInfo }: HeroBannerProps) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const { bannerH, slideW, margin, radius } = useHeroMetrics();
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
        listRef.current?.scrollToOffset({ offset: next * slideW, animated: true });
        return next;
      });
    }, ROTATE_MS);
  }, [items.length, slideW]);

  // Resync scroll on focus via indexRef — reading `index` directly would re-run
  // this effect on every auto-advance, killing the FlatList's animated scroll.
  useFocusEffect(useCallback(() => {
    const raf = requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: indexRef.current * slideW, animated: false }));
    startTimer();
    return () => { cancelAnimationFrame(raf); if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimer, slideW]));

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / slideW);
    setIndex(newIndex);
    userScrollingRef.current = false;
    startTimer();
  };

  if (!items.length) return <View style={{ height: bannerH }} />;

  return (
    <View style={{ paddingHorizontal: margin }}>
      {/* L'AMBILIGHT du desktop : l'affiche active, floutée UNE FOIS par le
          GPU (blurRadius natif — jamais de backdrop-filter), déborde du cadre
          en halo de lumière. `transition` d'expo-image fond le changement. */}
      <AmbilightGlow items={items} activeIndex={index} inset={margin} />
      <View
        style={{
          width: slideW,
          height: bannerH,
          borderRadius: radius,
          borderWidth: 1,
          // Le liseré du cadre desktop : rgba(brand, 0.22).
          borderColor: withAlpha(theme.colors.brand.violet, 0.22, theme.colors.border.strong),
          overflow: "hidden",
          backgroundColor: theme.colors.surface.s0,
        }}
      >
        <BackdropStack items={items} activeIndex={index} />
        {/* Les voiles du bureau (scrims.css) : la « bande noire » venait de la
            FORME de la rampe (pente qui retombait à 70 %), pas de sa couleur —
            la rampe corrigée vit dans GradientOverlay. En SOMBRE le bas rejoint
            la page (surface.s0, défaut) ; en CLAIR il plafonne à 0,70 de noir
            PUR (le plafond est dans la rampe, jamais dans la couleur). */}
        <GradientOverlay direction="top" height={110} intensity="soft" color="rgba(0, 0, 0, 0.65)" />
        <GradientOverlay
          direction="bottom"
          height={bannerH * 0.62}
          intensity="strong"
          color={theme.isDark ? undefined : `rgb(${theme.colors.onMedia.scrimRgb})`}
        />
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
          getItemLayout={(_, i) => ({ length: slideW, offset: slideW * i, index: i })}
          style={StyleSheet.absoluteFillObject}
          renderItem={({ item, index: i }) => (
            <View style={[st.slide, { width: slideW, height: bannerH }]}>
              <View style={st.contentInner}>
                <HeroContent item={item} active={i === index} onPlay={onPlay} onInfo={onInfo} />
              </View>
            </View>
          )}
        />

        {items.length > 1 && (
          <View style={[st.dots, { bottom: bannerH * 0.04 }]} pointerEvents="none">
            {items.map((_, i) =>
              i === index ? (
                // La pastille active porte le dégradé de marque et son halo
                // rose — la même encre que la barre de progression du bureau.
                <LinearGradient
                  key={i}
                  colors={[theme.colors.brand.violet, theme.colors.brand.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[st.dot, st.dotOn]}
                />
              ) : (
                <View key={i} style={[st.dot, st.dotOff]} />
              ),
            )}
          </View>
        )}
      </View>
    </View>
  );
});

/* ── Halo ambilight ─────────────────────────────────────────────────────── */

function heroImageUrl(
  client: ReturnType<typeof useJellyfinClient>,
  it: MediaItem,
  width = 1280,
  quality = 85,
): string | null {
  const isEp = it.Type === "Episode";
  const hasParentBackdrop = (it.ParentBackdropImageTags?.length ?? 0) > 0;
  const hasOwnBackdrop = (it.BackdropImageTags?.length ?? 0) > 0;
  if (!hasParentBackdrop && !hasOwnBackdrop && !it.ImageTags?.Primary) return null;
  const backdropId = isEp
    ? (hasParentBackdrop ? (it.ParentBackdropItemId ?? it.SeriesId ?? it.Id) : it.Id)
    : it.Id;
  return (hasParentBackdrop || hasOwnBackdrop)
    ? client.getImageUrl(backdropId, "Backdrop", { width, quality })
    : client.getImageUrl(it.Id, "Primary", { width, quality });
}

/**
 * Le halo de LUMIÈRE derrière la carte (parité HeroAmbilight desktop) : une
 * miniature de l'affiche active (128 px — le flou mange les détails), floutée
 * nativement, qui déborde largement du cadre. `blurRadius` garde des bords
 * NETS en natif — un rectangle flou lirait comme une seconde bordure : quatre
 * fondus vers le fond de page évanouissent donc la lueur, sans contour. Une
 * seule image montée ; le changement de slide fond par la `transition`
 * d'expo-image. Nul en mouvement réduit, comme sur le bureau.
 */
function AmbilightGlow({ items, activeIndex, inset }: { items: MediaItem[]; activeIndex: number; inset: number }) {
  const client = useJellyfinClient();
  const theme = useTheme();
  if (motion.isReducedMotion()) return null;
  const it = items[activeIndex];
  if (!it) return null;
  const small = heroImageUrl(client, it, 128, 60);
  if (!small) return null;
  const bg = theme.colors.surface.s0;
  const fade = (deg: "toTop" | "toBottom" | "toLeft" | "toRight") => {
    const axis = {
      toTop: { start: { x: 0, y: 1 }, end: { x: 0, y: 0 } },
      toBottom: { start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
      toLeft: { start: { x: 1, y: 0 }, end: { x: 0, y: 0 } },
      toRight: { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
    }[deg];
    return (
      <LinearGradient
        colors={[withAlpha(bg, 0, "rgba(0,0,0,0)"), bg]}
        start={axis.start}
        end={axis.end}
        style={[
          { position: "absolute" },
          deg === "toTop" && { top: 0, left: 0, right: 0, height: "34%" },
          deg === "toBottom" && { bottom: 0, left: 0, right: 0, height: "34%" },
          deg === "toLeft" && { left: 0, top: 0, bottom: 0, width: "26%" },
          deg === "toRight" && { right: 0, top: 0, bottom: 0, width: "26%" },
        ]}
      />
    );
  };
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: inset - 34,
        right: inset - 34,
        top: -30,
        bottom: -30,
      }}
    >
      <Image
        source={{ uri: small }}
        blurRadius={55}
        transition={600}
        contentFit="cover"
        style={{ flex: 1, opacity: theme.isDark ? 0.8 : 0.5 }}
      />
      {fade("toTop")}
      {fade("toBottom")}
      {fade("toLeft")}
      {fade("toRight")}
    </View>
  );
}

/* ── Backdrop stack (crossfade) ─────────────────────────────────────────── */

function BackdropStack({ items, activeIndex }: { items: MediaItem[]; activeIndex: number }) {
  const client = useJellyfinClient();
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {items.map((it, i) => {
        const url = heroImageUrl(client, it);
        if (!url) return null;
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
  slide: { justifyContent: "flex-end" as const, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 52 },
  contentInner: { width: "100%" as const, maxWidth: 640 },
  dots: { position: "absolute" as const, left: 0, right: 0, flexDirection: "row" as const, justifyContent: "center" as const, alignItems: "center" as const, gap: 5 },
  dot: { height: 3, borderRadius: 2 },
  dotOn: { width: 22, shadowColor: t.colors.brand.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 8 },
  dotOff: { width: 6, backgroundColor: t.colors.text.quaternary },
});
