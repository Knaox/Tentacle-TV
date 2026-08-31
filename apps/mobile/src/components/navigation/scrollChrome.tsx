import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useFocusEffect } from "expo-router";
import {
  useAnimatedScrollHandler, useSharedValue, withTiming, type SharedValue,
} from "react-native-reanimated";
import { motion } from "@/theme";

/**
 * Le signal de défilement partagé du chrome de navigation — la transposition
 * du `useScrollScrim` web : UNE SharedValue (`collapsed`, 0 → 1), écrite par
 * les écrans qui défilent, lue par la tab bar et l'en-tête. Aucun re-rendu
 * React par frame : tout vit sur le fil UI.
 *
 * Hystérésis directionnelle : près du haut (< 64 pt) le chrome est toujours
 * plein ; douze points vers le bas le replient, douze points vers le haut le
 * déploient. Le focus d'un écran le redéploie (changer d'onglet remet à zéro).
 * En mouvement réduit, les bascules sont sèches (durée 0).
 */

const SHOW_NEAR_TOP = 64;
const DELTA = 12;
const DURATION_MS = 250;

interface ScrollChrome {
  collapsed: SharedValue<number>;
}

const ScrollChromeContext = createContext<ScrollChrome | null>(null);

export function ScrollChromeProvider({ children }: { children: ReactNode }) {
  const collapsed = useSharedValue(0);
  const value = useMemo(() => ({ collapsed }), [collapsed]);
  return <ScrollChromeContext.Provider value={value}>{children}</ScrollChromeContext.Provider>;
}

/** La valeur 0..1 à consommer par le chrome ; `null` hors provider. */
export function useScrollChromeValue(): SharedValue<number> | null {
  return useContext(ScrollChromeContext)?.collapsed ?? null;
}

/**
 * Le handler à poser sur l'`Animated.ScrollView`/`FlatList` d'un écran
 * d'onglet (avec `scrollEventThrottle={16}`). Redéploie le chrome quand
 * l'écran reprend le focus. Hors provider : no-op inoffensif.
 */
export function useScrollChromeHandler() {
  const chrome = useContext(ScrollChromeContext);
  const collapsed = chrome?.collapsed ?? null;
  const lastY = useSharedValue(0);
  const target = useSharedValue(0);
  const duration = motion.isReducedMotion() ? 0 : DURATION_MS;

  useFocusEffect(
    useCallback(() => {
      if (collapsed) {
        target.value = 0;
        collapsed.value = withTiming(0, { duration });
      }
    }, [collapsed, target, duration]),
  );

  return useAnimatedScrollHandler({
    onScroll: (event) => {
      if (!collapsed) return;
      const y = event.contentOffset.y;
      const dy = y - lastY.value;
      lastY.value = y;
      // Près du haut : chrome plein, toujours.
      if (y < SHOW_NEAR_TOP) {
        if (target.value !== 0) {
          target.value = 0;
          collapsed.value = withTiming(0, { duration });
        }
        return;
      }
      if (dy > DELTA && target.value !== 1) {
        target.value = 1;
        collapsed.value = withTiming(1, { duration });
      } else if (dy < -DELTA && target.value !== 0) {
        target.value = 0;
        collapsed.value = withTiming(0, { duration });
      }
    },
  });
}
