import { memo, useEffect, useState, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import type { Motion } from "./motion";
import { usePresence } from "./useMotion";

/**
 * Ce qui PARAÎT au focus et s'en va avec lui — une ligne sous une carte, une
 * aide : monté seulement quand il se montre, en fondu (et, `rise`, en montant
 * de quelques points), puis retiré en fondu plus bref, et démonté.
 *
 * `delayMs` : le temps que `shown` doit TENIR avant que rien ne se monte. Un
 * focus qui balaie une rangée ne monte pas une ligne sous chaque carte pour la
 * défaire aussitôt : rien n'est créé tant qu'il ne s'arrête pas. (Une
 * animation d'entrée retardée, elle, montait la vue tout de suite.)
 */

function useDwell(on: boolean, delayMs: number): boolean {
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

export const Reveal = memo(function Reveal({
  shown,
  delayMs = 0,
  motion = "reveal",
  rise = 0,
  style,
  children,
}: {
  shown: boolean;
  delayMs?: number;
  motion?: Motion;
  /** Les points dont il monte en entrant (et redescend en sortant). */
  rise?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { mounted, progress } = usePresence(useDwell(shown, delayMs), motion);
  const appear = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: rise * (1 - progress.value) }],
  }));
  if (!mounted) return null;
  return (
    <Animated.View pointerEvents="none" style={[style, appear]}>
      {children}
    </Animated.View>
  );
});
