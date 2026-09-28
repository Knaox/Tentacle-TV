import { memo, useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming,
} from "react-native-reanimated";
import { exitTarget } from "@tentacle-tv/api-client";
import type { SwipeCard, SwipeVerdict } from "@tentacle-tv/api-client";
import { SwipeCardFace } from "./SwipeCardFace";

interface Props {
  card: SwipeCard;
  verdict: SwipeVerdict;
  from: { x: number; y: number };
  posterUri: string | null;
  screenWidth: number;
  reducedMotion: boolean;
  onDone: () => void;
}

/**
 * La carte qui part. Le verdict est DÉJÀ posé (la suivante est jouable) :
 * cette copie ne fait que finir le mouvement, du point où le doigt l'a
 * lâchée vers la sortie — rien n'attend la fin de l'animation.
 */
export const SwipeExitingCard = memo(function SwipeExitingCard({
  card, verdict, from, posterUri, screenWidth, reducedMotion, onDone,
}: Props) {
  const tx = useSharedValue(from.x);
  const ty = useSharedValue(from.y);
  const fade = useSharedValue(1);

  useEffect(() => {
    const target = exitTarget(verdict, screenWidth);
    const done = () => onDone();
    if (reducedMotion) {
      fade.value = withTiming(0, { duration: 120 }, (ok) => { if (ok) runOnJS(done)(); });
      return;
    }
    const timing = { duration: 280, easing: Easing.in(Easing.quad) };
    tx.value = withTiming(target.x, timing);
    ty.value = withTiming(target.y, timing);
    fade.value = withTiming(0, timing, (ok) => { if (ok) runOnJS(done)(); });
    // Montée une fois : le trajet ne se relance jamais.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${interpolate(tx.value, [-320, 320], [-14, 14])}deg` },
    ],
  }));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 20 }, style]}>
      <SwipeCardFace card={card} posterUri={posterUri} interactive={false} infoOpen={false} details={undefined} />
    </Animated.View>
  );
});
