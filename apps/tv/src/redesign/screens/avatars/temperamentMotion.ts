import { useEffect } from "react";
import { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import type { AvatarTemperament } from "@tentacle-tv/shared";
import { MOTION_ENABLED } from "../../motion/motion";

/**
 * Le TEMPÉRAMENT d'un personnage (catalogue partagé) : le geste qu'il fait
 * quand il entre dans le panneau — flotter, frétiller, sursauter, rebondir,
 * se dandiner, somnoler. UN geste, à l'arrivée, puis il se tient tranquille :
 * aucune boucle. `transform` seul, sur le fil d'interface ; sans mouvement
 * (Android TV, animations réduites), il ne bouge pas.
 */

const DURATION: Record<AvatarTemperament, number> = {
  float: 1100,
  wiggle: 700,
  shiver: 520,
  bounce: 760,
  sway: 1100,
  doze: 1400,
};

/** `key` : le personnage — un nouveau rejoue le geste. */
export function useTemperamentMotion(temperament: AvatarTemperament, key: string) {
  const t = useSharedValue(1);
  useEffect(() => {
    if (!MOTION_ENABLED) return;
    t.value = 0;
    t.value = withTiming(1, { duration: DURATION[temperament], easing: Easing.out(Easing.quad) });
  }, [key, temperament, t]);
  return useAnimatedStyle(() => {
    const v = t.value;
    const fade = 1 - v;
    switch (temperament) {
      case "float":
        return { transform: [{ translateY: -14 * Math.sin(v * Math.PI) }] };
      case "wiggle":
        return { transform: [{ rotate: `${7 * Math.sin(v * Math.PI * 4) * fade}deg` }] };
      case "shiver":
        return { transform: [{ translateX: 5 * Math.sin(v * Math.PI * 10) * fade }] };
      case "bounce":
        return {
          transform: [
            { translateY: -16 * Math.abs(Math.sin(v * Math.PI * 2)) * fade },
            { scale: 1 + 0.05 * Math.sin(v * Math.PI) },
          ],
        };
      case "sway":
        return { transform: [{ rotate: `${5 * Math.sin(v * Math.PI * 2) * fade}deg` }] };
      default:
        // Somnoler : la tête penche, puis se redresse.
        return { transform: [{ rotate: `${9 * Math.sin(v * Math.PI)}deg` }] };
    }
  });
}
