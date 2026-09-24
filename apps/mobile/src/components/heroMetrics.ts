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
  /** Carte nettement plus haute que large (téléphone en portrait) : elle
   *  montre l'affiche plutôt qu'un 16/9 rogné aux deux tiers. */
  portrait: boolean;
}

/** Sous ce rapport largeur/hauteur, un visuel 16/9 ne garde qu'un tiers de sa
 *  largeur : l'affiche (2/3) cadre mieux. L'iPad portrait (~0,98) garde le
 *  visuel large, le téléphone (~0,57) prend l'affiche. */
const PORTRAIT_CARD_RATIO = 0.8;

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
  // 0.74 : laisse la tête de « Reprendre » visible au-dessus de la tab bar.
  const bannerH = Math.min(isTablet ? 820 : 660, Math.round(screenH * 0.74));
  const slideW = screenW - railWidth - margin * 2;
  return {
    bannerH,
    slideW,
    margin,
    radius: 20,
    isTablet,
    portrait: slideW / bannerH < PORTRAIT_CARD_RATIO,
  };
}
