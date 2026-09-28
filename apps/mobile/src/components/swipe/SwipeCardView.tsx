import { memo, useEffect, useMemo, useRef } from "react";
import { PanResponder, Pressable, StyleSheet } from "react-native";
import Animated, {
  interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from "react-native-reanimated";
import { verdictFromDrag } from "@tentacle-tv/api-client";
import type { SwipeCard, SwipeCardDetails, SwipeVerdict } from "@tentacle-tv/api-client";
import { SwipeCardFace } from "./SwipeCardFace";
import { SwipeStampsNative } from "./SwipeStampsNative";

interface Props {
  card: SwipeCard;
  depth: number;
  posterUri: string | null;
  infoOpen: boolean;
  details: SwipeCardDetails | undefined;
  reducedMotion: boolean;
  label: string;
  /** Verdict par glisser, avec le point où la carte a été lâchée. */
  onRelease: (verdict: SwipeVerdict, from: { x: number; y: number }) => void;
  onToggleInfo: () => void;
  accessibilityActions: Array<{ name: string; label: string }>;
  onAccessibilityAction: (name: string) => void;
}

const SPRING = { damping: 18, stiffness: 220 };

/**
 * Une carte de la pile. Celle du dessus suit le doigt (PanResponder : pas de
 * dépendance native de plus ; les valeurs vivent dans Reanimated, le rendu
 * reste sur le thread UI) ; les autres attendent, plus petites et plus bas.
 * Transform et opacity seulement. Un appui (sans glisser) retourne la carte.
 */
export const SwipeCardView = memo(function SwipeCardView({
  card, depth, posterUri, infoOpen, details, reducedMotion, label, onRelease, onToggleInfo,
  accessibilityActions, onAccessibilityAction,
}: Props) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const depthSV = useSharedValue(depth);
  const appear = useSharedValue(reducedMotion ? 1 : 0);
  const top = depth === 0;

  useEffect(() => {
    depthSV.value = reducedMotion ? depth : withSpring(depth, SPRING);
  }, [depth, depthSV, reducedMotion]);
  useEffect(() => {
    appear.value = withTiming(1, { duration: reducedMotion ? 0 : 220 });
  }, [appear, reducedMotion]);

  // Les rappels changent à chaque rendu : le PanResponder, lui, est créé une fois.
  const latest = useRef({ onRelease, top, infoOpen });
  latest.current = { onRelease, top, infoOpen };

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    // Verso ouvert : le doigt fait défiler le synopsis, il ne jette pas la carte.
    onMoveShouldSetPanResponder: (_, g) =>
      latest.current.top && !latest.current.infoOpen && (Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8),
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => {
      tx.value = g.dx;
      ty.value = g.dy;
    },
    onPanResponderRelease: (_, g) => {
      // PanResponder mesure la vitesse en px/ms ; la règle partagée, en px/s.
      const verdict = verdictFromDrag(g.dx, g.dy, g.vx * 1000, g.vy * 1000);
      if (verdict) {
        latest.current.onRelease(verdict, { x: g.dx, y: g.dy });
        return;
      }
      tx.value = withSpring(0, SPRING);
      ty.value = withSpring(0, SPRING);
    },
    onPanResponderTerminate: () => {
      tx.value = withSpring(0, SPRING);
      ty.value = withSpring(0, SPRING);
    },
  }), [tx, ty]);

  const style = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value + depthSV.value * 12 },
      { rotate: `${interpolate(tx.value, [-320, 320], [-14, 14])}deg` },
      { scale: (1 - depthSV.value * 0.05) * (0.96 + appear.value * 0.04) },
    ],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { zIndex: 10 - depth }, style]}
      {...(top ? pan.panHandlers : {})}
      pointerEvents={top ? "auto" : "none"}
      importantForAccessibility={top ? "auto" : "no-hide-descendants"}
      accessibilityElementsHidden={!top}
    >
      <Pressable
        style={st.fill}
        onPress={top ? onToggleInfo : undefined}
        accessible={top}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityActions={top ? accessibilityActions : undefined}
        onAccessibilityAction={(e) => onAccessibilityAction(e.nativeEvent.actionName)}
      >
        <SwipeCardFace card={card} posterUri={posterUri} interactive={top} infoOpen={top && infoOpen} details={details} />
      </Pressable>
      {top && <SwipeStampsNative tx={tx} ty={ty} />}
    </Animated.View>
  );
});

const st = StyleSheet.create({ fill: { flex: 1 } });
