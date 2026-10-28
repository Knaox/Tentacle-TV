/**
 * Octave mobile — les mesures des pages, tirées de la mise en page de la
 * coquille (`useOctaveLayout`, m1 : marges, barre latérale d'une tablette,
 * barre d'onglets et mini-lecteur mesurés) : largeur des cartes d'étagère,
 * rythme vertical. Une tablette n'est pas un téléphone étiré.
 */

import { useMemo } from "react";
import type { AppTheme } from "@/theme";
import { useOctaveLayout } from "../../layout/useOctaveLayout";

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
  /** Ce qu'une page laisse en haut (zone sûre) et en bas (onglets, mini-lecteur) : rien sous le chrome. */
  topInset: number;
  bottomInset: number;
}

export function usePageMetrics(): PageMetrics {
  const layout = useOctaveLayout();
  return useMemo(
    () => ({
      isTablet: layout.isTablet,
      gutter: layout.gutter,
      card: layout.shelfItemWidth,
      sectionGap: layout.isTablet ? 36 : 28,
      contentWidth: layout.contentWidth,
      topInset: layout.topInset,
      bottomInset: layout.bottomInset,
    }),
    [layout],
  );
}

/** Le rose LISIBLE en texte et en petit glyphe (≥ 4,5:1), comme les jetons d'Octave : clair en sombre, foncé en clair. */
export function accentTextOf(theme: AppTheme): string {
  return theme.isDark ? theme.colors.brand.accentLight : theme.colors.brand.accentDark;
}
