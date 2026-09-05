import { useCallback, useEffect, useRef } from "react";
import type { LayoutChangeEvent } from "react-native";
import { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { motion } from "@/theme";

interface Size {
  width: number;
  height: number;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Options extends Size {
  /** `top` : l'indicateur s'aligne sur le haut de l'item (l'icône y est) ;
   *  `center` : il occupe l'item (rail, menu). */
  align?: "top" | "center";
}

/** Miroir de `springSoft` du web (320/32) : ~250 ms, sans rebond visible. */
const INDICATOR_SPRING = { damping: 28, stiffness: 320, mass: 0.8 };
const SHOW_MS = 120;

/**
 * La position de l'indicateur d'onglet, mesurée sur les items (`onLayout`,
 * par CLÉ de route — un onglet masqué par `href: null` décale l'index, pas
 * la clé). Première mesure, rotation, onglet qui apparaît : sauts secs ;
 * changement d'onglet : ressort. Invisible tant qu'aucune mesure n'existe
 * (pas de glissement depuis l'origine au premier rendu) ou sans onglet actif.
 * Aucune valeur React par image : tout est partagé avec le fil UI.
 */
export function useSlidingIndicator(activeKey: string | undefined, { width, height, align = "top" }: Options) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const shown = useSharedValue(0);
  const layouts = useRef<Record<string, Box>>({});
  const activeRef = useRef(activeKey);
  const placed = useRef(false);

  const moveTo = useCallback(
    (box: Box, animated: boolean) => {
      const tx = box.x + (box.width - width) / 2;
      const ty = align === "center" ? box.y + (box.height - height) / 2 : box.y;
      if (animated && !motion.isReducedMotion()) {
        x.value = withSpring(tx, INDICATOR_SPRING);
        y.value = withSpring(ty, INDICATOR_SPRING);
      } else {
        x.value = tx;
        y.value = ty;
      }
      placed.current = true;
      shown.value = withTiming(1, { duration: motion.respectReducedMotion(SHOW_MS) });
    },
    [width, height, align, x, y, shown],
  );

  const onItemLayout = useCallback(
    (key: string) => (e: LayoutChangeEvent) => {
      const { x: bx, y: by, width: bw, height: bh } = e.nativeEvent.layout;
      layouts.current[key] = { x: bx, y: by, width: bw, height: bh };
      // Relayout de l'item actif (première mesure, rotation) : à sa place, sec.
      if (key === activeRef.current) moveTo(layouts.current[key], false);
    },
    [moveTo],
  );

  useEffect(() => {
    activeRef.current = activeKey;
    if (!activeKey) {
      shown.value = withTiming(0, { duration: motion.respectReducedMotion(SHOW_MS) });
      return;
    }
    const box = layouts.current[activeKey];
    if (box) moveTo(box, placed.current);
    // Sinon : l'onglet vient d'apparaître, son `onLayout` posera l'indicateur.
  }, [activeKey, moveTo, shown]);

  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  return { onItemLayout, style };
}
