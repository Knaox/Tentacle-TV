import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from "react-native-reanimated";
import { slideVisual, type HeroSlide } from "./heroSlides";

// Synced with web/HeroBackdrop : the new slide arrives exactly when the
// scale 1 → 1.06 zoom cycle ends, so the carousel feels like an uninterrupted
// camera travel rather than a snapping slideshow.
export const HERO_ROTATE_MS = 8000;
export const HERO_FADE_MS = 1200;
export const HERO_ZOOM_TARGET = 1.06;

interface HeroBackdropStackProps {
  slides: HeroSlide[];
  activeIndex: number;
  /** Carte portrait : l'affiche de chaque diapositive plutôt que son 16/9. */
  portrait: boolean;
}

/** La pile des visuels plein cadre, en fondu croisé : un calque par diapositive. */
export function HeroBackdropStack({ slides, activeIndex, portrait }: HeroBackdropStackProps) {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {slides.map((slide, i) => {
        const url = slideVisual(slide, portrait);
        if (!url) return null;
        const fallbackUrl = url === slide.backdropUri ? null : slide.backdropUri;
        return <CrossfadeImage key={slide.id} url={url} fallbackUrl={fallbackUrl} active={i === activeIndex} />;
      })}
    </View>
  );
}

interface CrossfadeImageProps {
  url: string;
  /** Le visuel large, si l'affiche demandée n'existe pas. */
  fallbackUrl?: string | null;
  active: boolean;
}

function CrossfadeImage({ url, fallbackUrl, active }: CrossfadeImageProps) {
  // Linear scale 1 → 1.06 over HERO_ROTATE_MS — perceived as constant-speed travel.
  // No reset when becoming inactive: the image fades to opacity 0 first, then
  // the next activation snaps scale back to 1 *while invisible*, avoiding the
  // visible "scale pop" that would happen otherwise.
  const opacity = useSharedValue(active ? 1 : 0);
  const scale = useSharedValue(active ? HERO_ZOOM_TARGET : 1);
  useEffect(() => {
    opacity.value = withTiming(active ? 1 : 0, { duration: HERO_FADE_MS, easing: Easing.out(Easing.cubic) });
    if (active) { scale.value = 1; scale.value = withTiming(HERO_ZOOM_TARGET, { duration: HERO_ROTATE_MS, easing: Easing.linear }); }
  }, [active, opacity, scale]);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  // Image introuvable (affiche ou backdrop Jellyfin absent) : on retombe sur
  // le visuel large, puis sur l'aplat et les voiles du cadre — jamais d'icône
  // cassée.
  const [failed, setFailed] = useState<readonly string[]>([]);
  const src = [url, fallbackUrl].find((u): u is string => !!u && !failed.includes(u)) ?? null;
  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, animStyle]}>
      {src && (
        <Image
          source={{ uri: src }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={0}
          onError={() => setFailed((prev) => [...prev, src])}
        />
      )}
    </Animated.View>
  );
}
