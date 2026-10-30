/**
 * Octave mobile — la CASE d'une rangée de `ReorderList` : posée à sa place (`top`, hauteur fixe), elle porte
 * seule le mouvement du glisser (fil d'interface) — la rangée elle-même ne sait rien du geste. Tenue, elle
 * suit le pouce et se soulève (ombre, échelle 1,02) ; sinon elle s'écarte en ressort quand la place visée la
 * franchit. Une case d'une AUTRE liste que celle du geste (l'ordre lâché arrivé) ne se décale jamais : son
 * style se calcule au rendu, aucune image n'est vue décalée.
 */

import { memo, useLayoutEffect, type ReactElement } from "react";
import { StyleSheet, type GestureResponderHandlers } from "react-native";
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from "react-native-reanimated";
import type { ReorderDragValues } from "./useReorderDrag";
import { shiftOf } from "./reorderWorklets";

const SPRING = { damping: 24, stiffness: 320, mass: 0.6 } as const;

/** Ce que reçoit la rangée : sa poignée (absente si l'ordre ne se change pas ici) et « Monter / Descendre ». */
export interface ReorderSlot {
  handle?: GestureResponderHandlers;
  onStep: (delta: -1 | 1) => void;
  /** La rangée est tenue (la poignée s'allume). */
  lifted: boolean;
}

interface Props<T> {
  item: T;
  index: number;
  rowHeight: number;
  version: number;
  values: ReorderDragValues;
  /** La case tenue : elle lit le déplacement ; les autres lisent une valeur fixe (aucun calcul par image). */
  lift: SharedValue<number>;
  lifted: boolean;
  reduced: boolean;
  liftedBackground: string;
  handle?: GestureResponderHandlers;
  onStep: (index: number, delta: -1 | 1) => void;
  renderRow: (item: T, index: number, slot: ReorderSlot) => ReactElement;
  /** Ce qui, hors de l'élément, change le rendu de la rangée (sélection, titre en cours…). */
  extraData: unknown;
}

function CellImpl<T>({ item, index, rowHeight, version, values, lift, lifted, reduced, liftedBackground, handle, onStep, renderRow }: Props<T>) {
  const { from, over, version: dragVersion } = values;
  const offset = useSharedValue(0);
  const raised = useSharedValue(0);

  // L'écart, seulement quand la place visée change (jamais à chaque image du geste).
  useAnimatedReaction(
    () => (from.value < 0 || dragVersion.value !== version ? 0 : shiftOf(index, from.value, over.value, rowHeight)),
    (target, prev) => {
      if (target === prev) return;
      offset.value = from.value < 0 || reduced ? target : withSpring(target, SPRING);
    },
    [index, rowHeight, version, reduced],
  );
  useLayoutEffect(() => {
    raised.value = reduced ? (lifted ? 1 : 0) : withTiming(lifted ? 1 : 0, { duration: lifted ? 140 : 100 });
  }, [lifted, raised, reduced]);

  const style = useAnimatedStyle(() => {
    const mine = dragVersion.value === version && from.value >= 0;
    const y = !mine ? 0 : from.value === index ? lift.value : offset.value;
    return {
      transform: [{ translateY: y }, { scale: 1 + raised.value * 0.02 }],
      shadowOpacity: raised.value * 0.4,
      elevation: raised.value * 8,
    };
  }, [index, version, lift]);

  return (
    <Animated.View
      style={[styles.cell, { top: index * rowHeight, height: rowHeight, zIndex: lifted ? 10 : 0, backgroundColor: lifted ? liftedBackground : "transparent" }, style]}
    >
      {renderRow(item, index, { handle, onStep: (delta) => onStep(index, delta), lifted })}
    </Animated.View>
  );
}

export const ReorderCell = memo(CellImpl) as typeof CellImpl;

const styles = StyleSheet.create({
  cell: { position: "absolute", left: 0, right: 0, shadowColor: "#000", shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
});
