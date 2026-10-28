/**
 * Octave mobile — les mesures des pages : largeur des cartes (téléphone,
 * tablette), gouttière, rythme vertical. Une tablette n'est pas un téléphone
 * étiré : cartes plus grandes, marges plus larges, colonnes en plus.
 */

import { useMemo } from "react";
import { useRailWidth, useResponsive } from "@/theme";

export interface PageMetrics {
  isTablet: boolean;
  /** Marge latérale de la page. */
  gutter: number;
  /** Largeur d'une carte d'étagère (album, artiste, playlist). */
  card: number;
  /** Espace entre deux sections. */
  sectionGap: number;
  /** La largeur du contenu (l'écran, moins la barre latérale d'une tablette). */
  contentWidth: number;
}

export function usePageMetrics(): PageMetrics {
  const { isTablet, width: screen } = useResponsive();
  const rail = useRailWidth();
  return useMemo(() => {
    const width = screen - rail;
    const gutter = isTablet ? 32 : 16;
    // Téléphone : deux cartes et demie à l'écran (la suite se devine) ; tablette : des cartes plus grandes.
    const card = isTablet ? 184 : Math.round(Math.min(168, (width - gutter) / 2.4));
    return { isTablet, gutter, card, sectionGap: isTablet ? 36 : 28, contentWidth: width };
  }, [isTablet, screen, rail]);
}
