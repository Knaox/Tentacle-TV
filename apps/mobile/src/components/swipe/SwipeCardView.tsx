import { memo, useEffect, useMemo, useRef } from "react";
import { PanResponder, Pressable, StyleSheet } from "react-native";
import Animated, {
  Easing, ReduceMotion, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from "react-native-reanimated";
import { exitTarget, verdictFromDrag } from "@tentacle-tv/api-client";
import type { SwipeCard, SwipeCardDetails, SwipeVerdict } from "@tentacle-tv/api-client";
import { SwipeCardFace } from "./SwipeCardFace";
import { SwipeStampsNative } from "./SwipeStampsNative";

interface Props {
  card: SwipeCard;
  depth: number;
  /** Place dans l'empilement (`swipeStackZ`) : la carte qui part la garde. */
  zIndex: number;
  posterUri: string | null;
  infoOpen: boolean;
  details: SwipeCardDetails | undefined;
  reducedMotion: boolean;
  label: string;
  screenWidth: number;
  /** Carte jugée : elle finit son mouvement, puis prévient (`onExited`). */
  exit?: { id: number; verdict: SwipeVerdict };
  /** Verdict par glisser. */
  onRelease: (verdict: SwipeVerdict) => void;
  onExited: (id: number) => void;
  onToggleInfo: () => void;
  accessibilityActions: Array<{ name: string; label: string }>;
  onAccessibilityAction: (name: string) => void;
}

const SPRING = { damping: 18, stiffness: 220 };
/** Mouvement réduit : une carte lâchée avant le seuil revient, vite et sans
 *  rebond. `ReduceMotion.Never` : c'est NOTRE version réduite — sans lui,
 *  Reanimated (réglage système lu au lancement) la sauterait d'un coup. */
const RETURN_REDUCED = { duration: 150, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never };
/** Le fondu du mouvement réduit : un fondu enchaîné n'est pas un mouvement. */
const FADE_REDUCED = { duration: 120, reduceMotion: ReduceMotion.Never };
/** Rendue par « annuler » en pleine course, la carte revient sans dépasser sa
 *  place : un ressort passait le centre et allumait le tampon opposé. */
const RETURN_UNDO = { duration: 260, easing: Easing.out(Easing.cubic) };

/** Le retour d'une carte à sa place (lâchée avant le seuil, ou rendue). */
function toRest(reduced: boolean) {
  return reduced ? withTiming(0, RETURN_REDUCED) : withSpring(0, SPRING);
}

/**
 * Une carte de la pile. Celle du dessus suit le doigt (PanResponder : pas de
 * dépendance native de plus ; les valeurs vivent dans Reanimated, le rendu
 * reste sur le thread UI) ; les autres attendent, plus petites et plus bas.
 * Transform et opacity seulement. Un appui (sans glisser) retourne la carte.
 *
 * Jugée, c'est CETTE vue qui s'en va, du point où le doigt l'a lâchée : une
 * copie remontait son affiche (fondu d'expo-image depuis le vide) et perdait
 * son tampon — la carte partait noire.
 */
export const SwipeCardView = memo(function SwipeCardView({
  card, depth, zIndex, posterUri, infoOpen, details, reducedMotion, label, screenWidth, exit,
  onRelease, onExited, onToggleInfo, accessibilityActions, onAccessibilityAction,
}: Props) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const fade = useSharedValue(1);
  const depthSV = useSharedValue(depth);
  const appear = useSharedValue(reducedMotion ? 1 : 0);
  const top = depth === 0 && !exit;

  useEffect(() => {
    depthSV.value = reducedMotion ? depth : withSpring(depth, SPRING);
  }, [depth, depthSV, reducedMotion]);
  useEffect(() => {
    appear.value = withTiming(1, { duration: reducedMotion ? 0 : 220 });
  }, [appear, reducedMotion]);

  // Les rappels changent à chaque rendu : le PanResponder, lui, est créé une fois.
  const latest = useRef({ onRelease, onExited, top, infoOpen, reducedMotion });
  latest.current = { onRelease, onExited, top, infoOpen, reducedMotion };

  const pan = useMemo(() => {
    const back = () => {
      tx.value = toRest(latest.current.reducedMotion);
      ty.value = toRest(latest.current.reducedMotion);
    };
    return PanResponder.create({
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
        if (verdict) latest.current.onRelease(verdict);
        else back();
      },
      onPanResponderTerminate: back,
    });
  }, [tx, ty]);

  // La sortie : du point de lâcher vers l'extérieur, dans la direction du
  // verdict. Rendue par « annuler » en pleine course, la carte revient.
  const leaving = useRef(false);
  const exitId = exit?.id;
  const exitVerdict = exit?.verdict;
  useEffect(() => {
    if (exitId === undefined || exitVerdict === undefined) {
      if (!leaving.current) return;
      leaving.current = false;
      tx.value = withTiming(0, reducedMotion ? RETURN_REDUCED : RETURN_UNDO);
      ty.value = withTiming(0, reducedMotion ? RETURN_REDUCED : RETURN_UNDO);
      fade.value = withTiming(1, { ...FADE_REDUCED, duration: 150 });
      return;
    }
    leaving.current = true;
    const done = () => latest.current.onExited(exitId);
    if (reducedMotion) {
      fade.value = withTiming(0, FADE_REDUCED, (ok) => { if (ok) runOnJS(done)(); });
      return;
    }
    const target = exitTarget(exitVerdict, screenWidth, { x: tx.value, y: ty.value });
    const timing = { duration: 280, easing: Easing.in(Easing.quad) };
    tx.value = withTiming(target.x, timing);
    ty.value = withTiming(target.y, timing);
    fade.value = withTiming(0, timing, (ok) => { if (ok) runOnJS(done)(); });
    // Lancée une fois par verdict : ni la largeur ni le mouvement réduit ne la relancent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exitId, exitVerdict]);

  const style = useAnimatedStyle(() => ({
    opacity: appear.value * fade.value,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value + depthSV.value * 12 },
      { rotate: `${interpolate(tx.value, [-320, 320], [-14, 14])}deg` },
      { scale: (1 - depthSV.value * 0.05) * (0.96 + appear.value * 0.04) },
    ],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { zIndex }, style]}
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
        {/* La carte qui part garde sa face : verso ouvert au verdict, il le reste. */}
        <SwipeCardFace card={card} posterUri={posterUri} interactive={depth === 0} infoOpen={depth === 0 && infoOpen} details={details} />
      </Pressable>
      {depth === 0 && <SwipeStampsNative tx={tx} ty={ty} />}
    </Animated.View>
  );
});

const st = StyleSheet.create({ fill: { flex: 1 } });
