import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import type { LayoutChangeEvent } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { BELOW_ZONE_VIEWPORT, gridVisibleLines, type GridLineRange } from "@tentacle-tv/tv-core";
import type { GridMotion } from "./gridMotion";

/**
 * Le PORT de la grille POSÉE (`gridMotion` : ni focus ni défilement depuis
 * `GRID_PREVIEW_SETTLE_MS`), ou qui RALENTIT au bout d'un défilement rapide
 * (`onSlowed`) : la vue le sait — elle seule voit défiler sa liste —,
 * l'intégration en a besoin pour rendre la colonne après un défilement
 * accéléré (tv-core `gridColumnHold`). Au ralenti, la vue dit aussi les lignes
 * à l'écran (`visible`) : un focus connu hors d'elles est périmé. Sans
 * fournisseur (le banc) : rien.
 */
export type GridSettle = (visible?: GridLineRange) => void;

const GridSettleContext = createContext<GridSettle | null>(null);

export const GridSettleProvider = GridSettleContext.Provider;

/**
 * Branche la grille sur le port : posée, puis ralentie (avec ses lignes à
 * l'écran, d'après `stride` et la hauteur de son en-tête). Rend ce que
 * l'en-tête appelle à sa mise en page.
 */
export function useGridSettleSignals(motion: GridMotion, stride: number): (event: LayoutChangeEvent) => void {
  const settled = useContext(GridSettleContext);
  const headerHeight = useRef(0);
  const liveStride = useRef(stride);
  liveStride.current = stride;
  useEffect(() => {
    if (!settled) return undefined;
    const stopSettled = motion.onSettled(() => settled());
    const stopSlowed = motion.onSlowed(() =>
      settled(
        gridVisibleLines({
          scrollY: motion.position(),
          // La marge du haut de la liste (`PosterGrid`), puis l'en-tête.
          firstLineTop: TV_STAGE.safe.y + headerHeight.current,
          stride: liveStride.current,
          viewport: BELOW_ZONE_VIEWPORT,
        }),
      ),
    );
    return () => {
      stopSettled();
      stopSlowed();
    };
  }, [motion, settled]);
  return useCallback((event: LayoutChangeEvent) => {
    headerHeight.current = event.nativeEvent.layout.height;
  }, []);
}
