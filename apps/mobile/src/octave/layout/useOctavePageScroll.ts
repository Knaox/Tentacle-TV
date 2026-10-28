/**
 * Octave (mobile) — le DÉFILEMENT d'une page du mode, à brancher sur n'importe
 * quelle liste animée (`Animated.ScrollView`, `Animated.FlatList`) :
 * - `scrollY` (fil d'interface) pour l'en-tête qui se replie en verre ;
 * - les marges : sous l'en-tête en haut, au-dessus des barres et du
 *   mini-lecteur en bas — rien n'est jamais caché sous le chrome ;
 * - la PAGE GARDÉE : le défilement se mémorise à la fin d'un geste, et se
 *   rejoue une fois au lancement en Octave sur la page où l'on était.
 */

import { useCallback, useMemo } from "react";
import { usePathname } from "expo-router";
import { runOnJS, useAnimatedScrollHandler, useSharedValue, type SharedValue } from "react-native-reanimated";
import { rememberOctaveScroll, takeLaunchScroll } from "../cache/octavePageStore";
import { useOctaveLayout } from "./useOctaveLayout";

/** Hauteur de la barre compacte de l'en-tête (sous la zone sûre). */
export const OCTAVE_TOP_BAR_HEIGHT = 52;

export interface OctavePageScroll {
  scrollY: SharedValue<number>;
  /** À étaler sur la liste animée. */
  scrollProps: {
    onScroll: ReturnType<typeof useAnimatedScrollHandler>;
    scrollEventThrottle: number;
    contentOffset?: { x: number; y: number };
    contentInsetAdjustmentBehavior: "never";
    contentContainerStyle: { paddingTop: number; paddingBottom: number };
  };
}

/** Le doigt pose la page en mouvement (`onMove`), son arrêt (`onSettle`) : le préchargement des albums visibles. */
export interface PageScrollMotion {
  onMove(): void;
  onSettle(): void;
}

const STILL: PageScrollMotion = { onMove: () => undefined, onSettle: () => undefined };

export function useOctavePageScroll(motion: PageScrollMotion = STILL): OctavePageScroll {
  const scrollY = useSharedValue(0);
  const pathname = usePathname();
  const layout = useOctaveLayout();
  // Lu une fois au montage : le défilement gardé ne vaut que pour le premier rendu de la page gardée.
  const initial = useMemo(() => takeLaunchScroll(pathname), [pathname]);
  const { onMove, onSettle } = motion;
  const remember = useCallback(
    (y: number) => {
      rememberOctaveScroll(pathname, y);
      onSettle();
    },
    [pathname, onSettle],
  );
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
    onBeginDrag: () => {
      runOnJS(onMove)();
    },
    onMomentumBegin: () => {
      runOnJS(onMove)();
    },
    onEndDrag: (e) => {
      runOnJS(remember)(e.contentOffset.y);
    },
    onMomentumEnd: (e) => {
      runOnJS(remember)(e.contentOffset.y);
    },
  });
  return {
    scrollY,
    scrollProps: {
      onScroll,
      scrollEventThrottle: 16,
      contentOffset: initial !== null ? { x: 0, y: initial } : undefined,
      contentInsetAdjustmentBehavior: "never",
      contentContainerStyle: { paddingTop: layout.topInset + OCTAVE_TOP_BAR_HEIGHT, paddingBottom: layout.bottomInset },
    },
  };
}
