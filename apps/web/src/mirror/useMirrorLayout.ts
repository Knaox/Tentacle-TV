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
import { HEADER_TOTAL, TAB_BAR_TOTAL } from "./shell/metrics";

/** Largeur du rail latéral courant (iPad paysage) ; 0 ailleurs. Posée par la coquille. */
export const RailWidthContext = createContext(0);
/**
 * Le chrome qui entoure l'écran courant : la barre d'onglets en bas (`tabs`),
 * le rail de l'iPad en paysage (`rail`), ou rien — un écran empilé par-dessus
 * les onglets, comme une bibliothèque ou Ma liste dans l'app (`stacked`).
 */
export type MirrorChrome = "tabs" | "rail" | "stacked";
export const MirrorChromeContext = createContext<MirrorChrome>("tabs");

export function useMirrorChrome(): MirrorChrome {
  return useContext(MirrorChromeContext);
}

/**
 * Ce que la coquille réserve autour de l'écran courant, en CSS : `top` = la
 * marge haute qu'elle a posée (l'en-tête, ou la zone sûre d'un écran empilé),
 * `bottom` = la hauteur du chrome bas qu'un élément fixe doit enjamber.
 */
export function useChromeInsets(): { top: string; bottom: string } {
  const chrome = useMirrorChrome();
  if (chrome === "tabs") return { top: HEADER_TOTAL, bottom: TAB_BAR_TOTAL };
  if (chrome === "rail") return { top: HEADER_TOTAL, bottom: "env(safe-area-inset-bottom, 0px)" };
  return { top: "max(env(safe-area-inset-top, 0px), 24px)", bottom: "env(safe-area-inset-bottom, 0px)" };
}

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
