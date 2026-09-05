import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from "react-native-reanimated";
import type { HeroSlide } from "./heroSlides";

// Synced with web/HeroBackdrop : the new slide arrives exactly when the
// scale 1 → 1.06 zoom cycle ends, so the carousel feels like an uninterrupted
// camera travel rather than a snapping slideshow.
export const HERO_ROTATE_MS = 8000;
export const HERO_FADE_MS = 1200;
export const HERO_ZOOM_TARGET = 1.06;

/** La pile des visuels plein cadre, en fondu croisé : un calque par diapositive. */
export function HeroBackdropStack({ slides, activeIndex }: { slides: HeroSlide[]; activeIndex: number }) {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {slides.map((slide, i) => {
        if (!slide.backdropUri) return null;
        return <CrossfadeImage key={slide.id} url={slide.backdropUri} active={i === activeIndex} />;
      })}
    </View>
  );
}

function CrossfadeImage({ url, active }: { url: string; active: boolean }) {
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
  // Image introuvable (backdrop Jellyfin absent) : l'aplat et les voiles
  // du cadre tiennent le décor, jamais d'icône cassée.
  const [failed, setFailed] = useState(false);
  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, animStyle]}>
      {!failed && (
        <Image
          source={{ uri: url }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={0}
          onError={() => setFailed(true)}
        />
      )}
    </Animated.View>
  );
}
