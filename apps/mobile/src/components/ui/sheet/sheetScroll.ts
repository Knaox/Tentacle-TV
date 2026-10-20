import { createContext, useContext, useEffect, useMemo } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

/**
 * Le lien entre une feuille du bas et la liste qu'elle contient : la liste
 * dit si elle est en HAUT, la feuille sait alors qu'un glissement vers le bas
 * la réduit au lieu de faire défiler. Une liste qui ne se branche pas garde
 * son défilement tel quel : la feuille se réduit par sa poignée et son
 * en-tête.
 */
export interface SheetScrollBridge {
  /** null : la liste ne s'est pas branchée ; true : elle est en haut. */
  readonly state: { atTop: boolean | null };
}

export const SheetScrollContext = createContext<SheetScrollBridge | null>(null);

/**
 * À poser sur la liste d'une feuille : `<FlatList {...useBottomSheetScroll()} />`.
 * Hors feuille, rien (props vides).
 */
export function useBottomSheetScroll(): {
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle?: number;
} {
  const bridge = useContext(SheetScrollContext);
  // Branchée : en haut tant qu'elle n'a pas défilé ; débranchée, plus rien n'est su.
  useEffect(() => {
    if (!bridge) return;
    const state = bridge.state;
    if (state.atTop === null) state.atTop = true;
    return () => { state.atTop = null; };
  }, [bridge]);
  return useMemo(() => {
    if (!bridge) return {};
    return {
      onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        bridge.state.atTop = e.nativeEvent.contentOffset.y <= 0.5;
      },
      scrollEventThrottle: 16,
    };
  }, [bridge]);
}
