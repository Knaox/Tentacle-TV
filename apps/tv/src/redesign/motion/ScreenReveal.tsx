import { memo, useEffect, useState, type ReactNode } from "react";
import { StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue } from "react-native-reanimated";
import { motionTo } from "./motion";

/**
 * L'ARRIVÉE d'un écran qui charge : la navigation et le contenu ne paraissent
 * qu'une fois le contenu prêt (`ready`), ensemble, en un seul fondu
 * d'opacité joué sur le fil d'interface (préréglage `page`) — jamais une
 * navigation seule devant un écran vide, ni un contenu qui saute en place.
 *
 * Avant : montés pour React, mais SANS vue native (`display: none`) — rien ne
 * se dessine ni ne prend le focus (Android TV focaliserait une vue
 * transparente) ; l'écran tient le focus ailleurs (son ancre de chargement).
 * Le fondu part APRÈS le montage des vues (`useEffect`) : leur création ne
 * mange pas ses premières images. Une fois paru, l'écran le reste (un
 * rechargement se dit dans le contenu). Prêt dès le montage (données en
 * cache, retour par le rail) : aucun fondu, l'écran est là.
 */
export const ScreenReveal = memo(function ScreenReveal({ ready, children }: { ready: boolean; children: ReactNode }) {
  const reduced = useReducedMotion();
  const [readyAtMount] = useState(ready);
  const [revealed, setRevealed] = useState(ready);
  if (ready && !revealed) setRevealed(true);
  const progress = useSharedValue(readyAtMount ? 1 : 0);
  useEffect(() => {
    if (revealed && !readyAtMount) progress.value = motionTo(1, "page", reduced);
  }, [revealed, readyAtMount, reduced, progress]);
  const fade = useAnimatedStyle(() => ({ opacity: progress.value }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, revealed ? null : styles.hidden, fade]} pointerEvents="box-none">
      {children}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  hidden: { display: "none" },
});
