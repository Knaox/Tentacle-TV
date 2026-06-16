import { useState, useEffect, useCallback, useRef, memo } from "react";
import { View, Dimensions, Image } from "react-native";
import {
  useSharedValue,
  withTiming,
  withRepeat,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { useJellyfinClient } from "@tentacle-tv/api-client";
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
  const client = useJellyfinClient();

  // La couche courante reste TOUJOURS à 1 ; on fait entrer la suivante PAR-DESSUS
  // (pas de crossfade symétrique). Évite la frame noire au swap d'index : quand
  // la suivante couvre à 100 %, on bascule la base dessous de façon atomique.
  const currentOpacity = useSharedValue(1);
  const nextOpacity = useSharedValue(0);
  const kenBurns = useSharedValue(1);

  // Précharge les backdrops des bannières → l'image suivante est déjà en cache
  // quand elle apparaît (sinon fondu sur une image vide = glitch).
  useEffect(() => {
    items.forEach((it) => {
      const id = it.Type === "Episode" && it.SeriesId ? it.SeriesId : it.Id;
      const uri = client.getImageUrl(id, "Backdrop", { width: 1920, quality: 85 });
      if (uri) Image.prefetch(uri);
    });
  }, [items, client]);

  // Ken Burns CONTINU, démarré une seule fois (pas de reset par image) : un reset
  // à chaque changement faisait sauter le scale (saccade au changement de bannière).
  // Oscille 1↔scale en boucle ; les deux couches partagent ce scale → swap fluide.
  useEffect(() => {
    kenBurns.value = withRepeat(
      withTiming(HeroConfig.kenBurnsScale, {
        duration: HeroConfig.kenBurnsDuration,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
  }, [kenBurns]);

  // Notify parent when active item changes (used by ambient backdrop in Phase 4).
  useEffect(() => {
    if (items.length > 0) onItemChange?.(items[index]);
  }, [index, items, onItemChange]);

  // Bascule atomique : base ← suivante, overlay retiré, opacité overlay remise à
  // 0 — le tout dans un même render (setState batché) alors que l'overlay couvre
  // déjà à 100 %. Les pixels affichés sont identiques avant/après → zéro flash.
  const commitNext = useCallback((next: number) => {
    setIndex(next);
    setNextIndex(null);
    nextOpacity.value = 0;
  }, [nextOpacity]);

  const doTransition = useCallback(() => {
    if (items.length <= 1) return;
    const next = (index + 1) % items.length;
    setNextIndex(next);
    nextOpacity.value = 0;
    // La couche courante NE descend PAS à 0 : la suivante monte par-dessus.
    nextOpacity.value = withTiming(
      1,
      { duration: HeroConfig.crossfadeDuration, easing: Easing.inOut(Easing.ease) },
      (finished) => {
        if (finished) runOnJS(commitNext)(next);
      },
    );
  }, [items.length, index, nextOpacity, commitNext]);

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
