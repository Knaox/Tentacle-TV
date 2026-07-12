import { useEffect, useRef } from "react";
import {
  useSharedValue, useAnimatedStyle, useAnimatedScrollHandler,
  withSpring, withDelay, withTiming, Easing, interpolate, Extrapolation,
} from "react-native-reanimated";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * Animations de la fiche détail — extraites pour garder l'écran sous 300 lignes.
 * Parallax + Ken Burns du backdrop (piloté par le scroll) + cascade d'entrée
 * (poster/titre/meta/actions/contenu). Le `scrollHandler` s'attache au ScrollView
 * en portrait ; en paysage 2 colonnes le backdrop est statique (handler ignoré).
 */
export function useMediaDetailAnimations(itemId: string, item: MediaItem | undefined, backdropH: number) {
  // Parallax + one-shot Ken Burns zoom (scale 1 → 1.06 over 8s, then frozen).
  const scrollY = useSharedValue(0);
  const zoomScale = useSharedValue(1);
  const scrollHandler = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
  useEffect(() => { zoomScale.value = 1; zoomScale.value = withTiming(1.06, { duration: 8000, easing: Easing.linear }); }, [zoomScale]);
  const backdropStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [0, backdropH], [0, -backdropH * 0.45], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-backdropH, 0], [1.4, 1], Extrapolation.CLAMP) * zoomScale.value },
    ],
  }));

  // Cascade d'entrée
  const animatedForId = useRef<string | null>(null);
  const posterAnim = useSharedValue(0);
  const titleAnim = useSharedValue(0);
  const metaAnim = useSharedValue(0);
  const actionsAnim = useSharedValue(0);
  const contentAnim = useSharedValue(0);

  useEffect(() => {
    if (!item || animatedForId.current === itemId) return;
    animatedForId.current = itemId;
    posterAnim.value = 0; titleAnim.value = 0; metaAnim.value = 0; actionsAnim.value = 0; contentAnim.value = 0;
    posterAnim.value = withDelay(16, withSpring(1, { damping: 18, stiffness: 140, mass: 0.9 }));
    titleAnim.value = withDelay(120, withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }));
    metaAnim.value = withDelay(220, withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }));
    actionsAnim.value = withDelay(320, withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }));
    contentAnim.value = withDelay(440, withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }));
  }, [item, itemId, posterAnim, titleAnim, metaAnim, actionsAnim, contentAnim]);

  const posterStyle = useAnimatedStyle(() => ({
    opacity: posterAnim.value,
    transform: [{ scale: 0.85 + 0.15 * posterAnim.value }, { translateY: (1 - posterAnim.value) * 12 }],
  }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: titleAnim.value, transform: [{ translateY: (1 - titleAnim.value) * 18 }] }));
  const metaStyle = useAnimatedStyle(() => ({ opacity: metaAnim.value, transform: [{ translateY: (1 - metaAnim.value) * 14 }] }));
  const actionsStyle = useAnimatedStyle(() => ({ opacity: actionsAnim.value, transform: [{ translateY: (1 - actionsAnim.value) * 14 }] }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentAnim.value }));

  return { scrollHandler, backdropStyle, posterStyle, titleStyle, metaStyle, actionsStyle, contentStyle };
}
