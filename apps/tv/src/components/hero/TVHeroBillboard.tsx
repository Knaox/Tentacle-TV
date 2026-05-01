import { useState, useEffect, useCallback, useRef, memo } from "react";
import { View, Dimensions } from "react-native";
import {
  useSharedValue,
  withTiming,
  withRepeat,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import type { MediaItem } from "@tentacle-tv/shared";
import { Colors, HeroConfig } from "../../theme/colors";
import { TVHeroBackdrop } from "./TVHeroBackdrop";
import { TVHeroContent } from "./TVHeroContent";
import { TVHeroIndicators } from "./TVHeroIndicators";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const HERO_H = Math.round(SCREEN_H * HeroConfig.heightRatio);

interface TVHeroBillboardProps {
  items: MediaItem[];
  onPlay: (item: MediaItem) => void;
  onDetail: (item: MediaItem) => void;
  onBannerFocus?: () => void;
  /** Called whenever the active item changes (auto-rotate or manual). */
  onItemChange?: (item: MediaItem) => void;
}

/**
 * Cinematic hero billboard for the TV home screen.
 * Replaces TVHeroBanner.tsx — same auto-rotate + Ken Burns mechanics, but
 * delegates rendering to TVHeroBackdrop / TVHeroContent / TVHeroIndicators
 * (each < 200L) and uses Jellyfin Logo images + Tagline + brand-aligned CTAs.
 */
export const TVHeroBillboard = memo(function TVHeroBillboard({
  items,
  onPlay,
  onDetail,
  onBannerFocus,
  onItemChange,
}: TVHeroBillboardProps) {
  const [index, setIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState<number | null>(null);

  const currentOpacity = useSharedValue(1);
  const nextOpacity = useSharedValue(0);
  const kenBurns = useSharedValue(1);

  // Restart Ken Burns when the active backdrop changes.
  useEffect(() => {
    kenBurns.value = 1;
    kenBurns.value = withRepeat(
      withTiming(HeroConfig.kenBurnsScale, {
        duration: HeroConfig.kenBurnsDuration,
        easing: Easing.linear,
      }),
      -1,
      true,
    );
  }, [index, kenBurns]);

  // Notify parent when active item changes (used by ambient backdrop in Phase 4).
  useEffect(() => {
    if (items.length > 0) onItemChange?.(items[index]);
  }, [index, items, onItemChange]);

  const doTransition = useCallback(() => {
    if (items.length <= 1) return;
    const next = (index + 1) % items.length;
    setNextIndex(next);
    nextOpacity.value = 0;
    currentOpacity.value = withTiming(0, { duration: HeroConfig.crossfadeDuration });
    nextOpacity.value = withTiming(1, { duration: HeroConfig.crossfadeDuration }, () => {
      runOnJS(setIndex)(next);
      runOnJS(setNextIndex)(null);
    });
  }, [items.length, index, currentOpacity, nextOpacity]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userInteracting = useRef(false);

  useEffect(() => {
    if (items.length <= 1) return;
    timerRef.current = setInterval(() => {
      if (userInteracting.current) return;
      doTransition();
    }, HeroConfig.rotateInterval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [items.length, doTransition]);

  const handleButtonFocus = useCallback(() => {
    userInteracting.current = true;
    onBannerFocus?.();
  }, [onBannerFocus]);

  const handleButtonBlur = useCallback(() => {
    userInteracting.current = false;
  }, []);

  // Reset opacity when index settles after a transition.
  useEffect(() => {
    currentOpacity.value = 1;
  }, [index, currentOpacity]);

  if (items.length === 0) return null;

  const item = items[index];
  const next = nextIndex != null ? items[nextIndex] : null;

  return (
    <View
      style={{
        width: SCREEN_W,
        height: HERO_H,
        overflow: "hidden",
        backgroundColor: Colors.bgDeep,
      }}
    >
      <TVHeroBackdrop
        current={item}
        next={next}
        currentOpacity={currentOpacity}
        nextOpacity={nextOpacity}
        kenBurns={kenBurns}
        height={HERO_H}
      />

      <TVHeroContent
        item={item}
        onPlay={onPlay}
        onDetail={onDetail}
        onButtonFocus={handleButtonFocus}
        onButtonBlur={handleButtonBlur}
      />

      <TVHeroIndicators count={items.length} activeIndex={index} />
    </View>
  );
});
