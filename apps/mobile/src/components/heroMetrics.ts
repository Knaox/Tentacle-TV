import { useWindowDimensions } from "react-native";
import { spacing, TABLET_MIN_WIDTH, useRailWidth } from "@/theme";

export interface HeroMetrics {
  /** Hauteur de la carte hero. */
  bannerH: number;
  /** Largeur d'un slide = viewport − rail iPad − gouttières de la carte. */
  slideW: number;
  /** Gouttière latérale de la carte (la même que les rangées). */
  margin: number;
  /** Rayon du cadre — la valeur du desktop (--hero-frame-radius). */
  radius: number;
  isTablet: boolean;
}

/**
 * LA géométrie de la bannière d'accueil — partagée entre `HeroBanner` et son
 * squelette : les deux DOIVENT mesurer pareil, sinon l'arrivée des données
 * fait sauter toute la page (le squelette faisait 420 px pour un hero à ~620).
 */
export function useHeroMetrics(): HeroMetrics {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const railWidth = useRailWidth();
  const isTablet = Math.min(screenW, screenH) >= TABLET_MIN_WIDTH;
  const margin = spacing.screenPadding;
  return {
    // 0.74 : laisse la tête de « Reprendre » visible au-dessus de la tab bar.
    bannerH: Math.min(isTablet ? 820 : 660, Math.round(screenH * 0.74)),
    slideW: screenW - railWidth - margin * 2,
    margin,
    radius: 20,
    isTablet,
  };
}
