import { memo, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue } from "react-native-reanimated";
import { motionTo, type MotionPreset } from "./motion";

/**
 * Une PILE de calques en fondu, pour un contenu qui change souvent (la
 * lumière du fond vivant, qui suit la carte focalisée) : le plus récent
 * entre, les précédents sortent chacun depuis où il en est. Rien n'attend :
 * un focus qui balaie une rangée voit chaque lumière arriver aussitôt, comme
 * avant — seulement sur le fil d'interface, sans animation de mise en page.
 *
 * Les calques forment une RÉSERVE de `size` emplacements, réutilisés : un
 * changement ne crée ni ne détruit aucune vue, il repeint l'emplacement le
 * plus anciennement éteint (ses couleurs changent, rien d'autre). Un contenu
 * qui revient pendant sa sortie (le focus revient sur la carte d'avant)
 * remonte en tête et rentre d'où il en est. Éteint, un emplacement ne
 * compose rien (opacité 0).
 */

export interface PoolLayer<T> {
  /** L'emplacement : la clé React, stable. */
  slot: number;
  key: string;
  item: T;
  present: boolean;
}

/**
 * Les emplacements utilisés, de bas en haut (le présent en dernier). `key` EST
 * l'identité du contenu (les couleurs d'une lumière, jointes) : la même clé ne
 * repeint rien, quelle que soit l'identité de `item` d'un rendu à l'autre.
 */
export function useLayerPool<T>(key: string, item: T, size = 5): PoolLayer<T>[] {
  const [layers, setLayers] = useState<PoolLayer<T>[]>(() => [{ slot: 0, key, item, present: true }]);
  const current = useRef(key);

  useLayoutEffect(() => {
    if (key === current.current) return;
    current.current = key;
    setLayers((list) => {
      const back = list.find((layer) => layer.key === key);
      const others = list.filter((layer) => layer.key !== key).map((layer) => (layer.present ? { ...layer, present: false } : layer));
      if (back) return [...others, { ...back, item, present: true }];
      if (list.length < size) return [...others, { slot: list.length, key, item, present: true }];
      // Le plus bas est le plus anciennement éteint : il reprend du service.
      const [oldest, ...rest] = others;
      return [...rest, { slot: oldest.slot, key, item, present: true }];
    });
  }, [key, item, size]);

  return layers;
}

/** Un emplacement de la réserve : plein cadre, en fondu selon `present`
 *  (0 → 1 à sa première apparition aussi). */
export const PoolLayerView = memo(function PoolLayerView({
  present,
  motion,
  children,
}: {
  present: boolean;
  motion: MotionPreset;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  useLayoutEffect(() => {
    progress.value = motionTo(present ? 1 : 0, motion, reduced);
  }, [present, motion, reduced, progress]);
  const fade = useAnimatedStyle(() => ({ opacity: progress.value }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fade]}>
      {children}
    </Animated.View>
  );
});
