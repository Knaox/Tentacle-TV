import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { useCardWidth } from "@/contexts/CardDensityContext";
import { useRailWidth } from "@/theme";

/** Écrans montés d'une rangée : celui qu'on voit, et deux de chaque côté. */
const RAIL_WINDOW_SCREENS = 5;
/** L'écart entre deux cartes d'une rangée (`gap` de la piste). */
const RAIL_GAP = 14;

/**
 * La fenêtre de virtualisation d'une rangée horizontale de cartes. Celle de
 * React Native (21 écrans) montait TOUTES les cartes d'une rangée — trente
 * pour trois visibles sur un téléphone, et « Pour vous » en aligne huit :
 * ce qui n'est pas à l'écran ne doit rien coûter. Le premier rendu se borne
 * à ce qui tient à l'écran (+1) ; la suite se monte par lots au défilement.
 */
export function useRailWindow(cardWidth?: number) {
  const { width } = useWindowDimensions();
  const railWidth = useRailWidth();
  const densityWidth = useCardWidth();
  const card = cardWidth ?? densityWidth;
  return useMemo(() => {
    const visible = Math.ceil((width - railWidth) / (card + RAIL_GAP)) + 1;
    return { initialNumToRender: visible, maxToRenderPerBatch: visible, windowSize: RAIL_WINDOW_SCREENS };
  }, [width, railWidth, card]);
}
