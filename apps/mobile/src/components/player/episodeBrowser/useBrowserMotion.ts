import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

/**
 * L'arrivée d'une liste des épisodes : de 0 à 1 sur un ressort, sur le fil
 * natif — la vue n'en tire qu'une opacité et une translation. Avec le
 * mouvement réduit, elle est là tout de suite.
 */
export function useEntrance(): Animated.Value {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) return;
    Animated.spring(value, { toValue: 1, useNativeDriver: true, damping: 26, stiffness: 260, mass: 0.9 }).start();
  }, [reduced, value]);
  return value;
}

/**
 * Le passage d'une saison à l'autre : la nouvelle liste paraît en fondu et
 * glisse de quelques points depuis le côté d'où elle vient. Une clé par saison
 * remonte la valeur ; rien ne bouge au premier rendu.
 */
export function useSeasonSwap(seasonId: string | undefined, distance = 14): { opacity: Animated.Value; translate: Animated.AnimatedInterpolation<number> } {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reduced) return;
    value.setValue(0);
    Animated.timing(value, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [seasonId, reduced, value]);
  return { opacity: value, translate: value.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) };
}
