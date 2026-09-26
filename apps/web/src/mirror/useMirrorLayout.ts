import { createContext, useContext, useMemo } from "react";
import { useViewport } from "./useFormFactor";
import {
  CONTENT_MAX_WIDTH,
  contentPadding,
  gridLayout,
  heroMetrics,
  rowCardWidth,
  type CardDensity,
  type GridLayout,
  type GridOptions,
  type HeroMetrics,
} from "./responsive";

/** Largeur du rail latéral courant (iPad paysage) ; 0 ailleurs. Posée par la coquille. */
export const RailWidthContext = createContext(0);
/** Densité des cartes du compte : l'accueil l'enveloppe autour de ses rangées. */
export const CardDensityContext = createContext<CardDensity>("normal");

export function useRailWidth(): number {
  return useContext(RailWidthContext);
}

export function useIsTablet(): boolean {
  return useViewport().formFactor === "tablet";
}

export function useContentPadding(maxWidth: number = CONTENT_MAX_WIDTH): number {
  const { width } = useViewport();
  return contentPadding(width, useRailWidth(), maxWidth);
}

export function useGrid(opts: GridOptions): GridLayout {
  const { width } = useViewport();
  const rail = useRailWidth();
  const { phoneColumns, targetTablet, maxColumns, gutter, padding } = opts;
  return useMemo(
    () => gridLayout(width, rail, { phoneColumns, targetTablet, maxColumns, gutter, padding }),
    [width, rail, phoneColumns, targetTablet, maxColumns, gutter, padding],
  );
}

export function useCardWidth(): number {
  return rowCardWidth(useIsTablet(), useContext(CardDensityContext));
}

export function useHeroMetrics(): HeroMetrics {
  const { width, height, formFactor } = useViewport();
  const rail = useRailWidth();
  return useMemo(
    () => heroMetrics(width, height, rail, formFactor === "tablet"),
    [width, height, rail, formFactor],
  );
}
