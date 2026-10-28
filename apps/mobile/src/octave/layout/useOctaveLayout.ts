/**
 * Octave (mobile) — la MISE EN PAGE, une règle pour tous les écrans du mode :
 * téléphone ou tablette, largeur utile (barre latérale déduite), marges qui
 * grandissent avec l'écran, nombre de colonnes d'une grille et largeur d'une
 * carte d'étagère. Une tablette n'est jamais un téléphone étiré : plus de
 * colonnes, des marges plus larges, une mesure de lecture bornée.
 */

import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOctaveChrome } from "../shell/octaveChrome";

export interface OctaveLayout {
  isTablet: boolean;
  /** Largeur utile des pages (fenêtre moins la barre latérale). */
  contentWidth: number;
  /** Marge horizontale des pages (16 téléphone, 24 tablette, 32 grand écran). */
  gutter: number;
  /** Écart entre deux cartes. */
  gap: number;
  /** Ce qu'une page laisse en haut (zone sûre) et en bas (barres, mini-lecteur). */
  topInset: number;
  bottomInset: number;
  /** Largeur maximale d'un texte long (lecture confortable sur tablette). */
  readableWidth: number;
  /** Colonnes d'une grille dont les cartes font au moins `minItem` pt. */
  columns: (minItem: number) => number;
  /** Largeur d'une carte de grille pour `columns` colonnes. */
  itemWidth: (columns: number) => number;
  /** Largeur d'une carte d'étagère horizontale (pochette carrée) : ~2,3 cartes sur téléphone. */
  shelfItemWidth: number;
}

/** Règle pure, testée sans React Native. */
export function octaveLayoutOf(width: number, sidebarWidth: number, tablet: boolean, topInset: number, bottomInset: number): OctaveLayout {
  const contentWidth = Math.max(0, width - sidebarWidth);
  const gutter = !tablet ? 16 : contentWidth >= 1000 ? 32 : 24;
  const gap = tablet ? 16 : 12;
  const inner = contentWidth - gutter * 2;
  const columns = (minItem: number) => Math.max(2, Math.floor((inner + gap) / (minItem + gap)));
  const itemWidth = (count: number) => Math.floor((inner - gap * (count - 1)) / Math.max(1, count));
  const shelfItemWidth = tablet ? Math.min(200, Math.max(160, Math.floor(inner / 5))) : Math.floor((inner - gap * 2) / 2.3);
  return { isTablet: tablet, contentWidth, gutter, gap, topInset, bottomInset, readableWidth: Math.min(inner, 640), columns, itemWidth, shelfItemWidth };
}

export function useOctaveLayout(): OctaveLayout {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const chrome = useOctaveChrome();
  return useMemo(
    () => octaveLayoutOf(width, chrome.sidebarWidth, chrome.layout === "tablet", insets.top, chrome.bottomInset),
    [width, chrome.sidebarWidth, chrome.layout, insets.top, chrome.bottomInset],
  );
}
