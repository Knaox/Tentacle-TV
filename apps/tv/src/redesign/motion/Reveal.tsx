import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue } from "react-native-reanimated";
import { motionTo, type Motion } from "./motion";

/**
 * Ce qui PARAÎT au focus et s'en va avec lui — une ligne sous une carte, une
 * aide : monté seulement quand il se montre, en fondu (et, `rise`, en montant
 * de quelques points), puis retiré en fondu plus bref, et démonté.
 *
 * `delayMs` : le temps que `shown` doit TENIR avant que rien ne se monte. Un
 * focus qui balaie une rangée ne monte pas une ligne sous chaque carte pour la
 * défaire aussitôt : rien n'est créé tant qu'il ne s'arrête pas. (Une
 * animation d'entrée retardée, elle, montait la vue tout de suite.)
 *
 * Au repos, RIEN : ni vue, ni valeur partagée, ni style animé. Chaque carte en
 * porte deux (la phrase de focus, « Maintenir OK ») — dans une grille, des
 * centaines, dont aucune ne se montre : leur valeur et leur style naissaient
 * pourtant au montage de la carte (le gros du coût de Reanimated d'une
 * affiche, mesuré au profileur). Le corps animé ne naît qu'avec ce qui paraît,
 * et meurt avec sa sortie.
 */

/** Vrai quand `on` a TENU `delayMs` ; retombe avec lui, sans attendre. */
export function useDwell(on: boolean, delayMs: number): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!on || delayMs <= 0) {
      setHeld(false);
      return undefined;
    }
    const timer = setTimeout(() => setHeld(true), delayMs);
    return () => clearTimeout(timer);
  }, [on, delayMs]);
  return on && (delayMs <= 0 || held);
}

interface RevealProps {
  shown: boolean;
  delayMs?: number;
  motion?: Motion;
  /** Les points dont il monte en entrant (et redescend en sortant). */
  rise?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

export const Reveal = memo(function Reveal({ shown, delayMs = 0, ...body }: RevealProps) {
  const held = useDwell(shown, delayMs);
  // Monté pendant `held`, et le temps de la sortie.
  const [present, setPresent] = useState(held);
  if (held && !present) setPresent(true);
  const heldRef = useRef(held);
  heldRef.current = held;
  // Une sortie finie ne démonte que si rien ne l'a fait revenir depuis.
  const onGone = useCallback(() => {
    if (!heldRef.current) setPresent(false);
  }, []);
  if (!present) return null;
  return <RevealBody shown={held} onGone={onGone} {...body} />;
});

/** Le fondu lui-même : né à l'entrée, il prévient à la fin de sa sortie. */
function RevealBody({
  shown,
  motion = "reveal",
  rise = 0,
  style,
  children,
  onGone,
}: Omit<RevealProps, "delayMs"> & { onGone: () => void }) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  useLayoutEffect(() => {
    if (shown) {
      progress.value = motionTo(1, motion, reduced);
      return;
    }
    progress.value = motionTo(0, motion, reduced, (finished) => {
      "worklet";
      if (finished) runOnJS(onGone)();
    });
    // `motion` : lu au moment du geste, il ne relance rien.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, reduced, progress, onGone]);
  const appear = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: rise * (1 - progress.value) }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[style, appear]}>
      {children}
    </Animated.View>
  );
}
