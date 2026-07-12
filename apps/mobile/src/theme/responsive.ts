/**
 * Helpers responsive — adaptation iPad / tablette.
 *
 * Principe directeur : **l'iPhone ne bouge JAMAIS**. `useGrid` conserve à
 * l'identique le nombre de colonnes téléphone existant et ne fait grossir que
 * la tablette (largeur courante >= TABLET_MIN_WIDTH). Toutes les dimensions
 * sont réactives à la rotation via `useWindowDimensions` — la rotation est
 * fréquente sur iPad, contrairement au téléphone verrouillé portrait.
 */

import { createContext, useContext, useMemo } from "react";
import { Dimensions, Platform, useWindowDimensions } from "react-native";
import { spacing } from "./spacing";

/**
 * Largeur occupée par le rail de navigation latéral (iPad paysage). Fournie
 * par le layout des tabs ; 0 partout ailleurs (iPhone, portrait, écrans hors
 * tabs). Les helpers ci-dessous la soustraient de la largeur fenêtre pour
 * raisonner sur la largeur RÉELLEMENT disponible pour le contenu.
 */
export const RailWidthContext = createContext(0);

/** Largeur du rail latéral courant (0 hors tabs / téléphone / portrait). */
export function useRailWidth(): number {
  return useContext(RailWidthContext);
}

/**
 * Seuil « tablette » basé sur le petit côté (largeur en portrait).
 * iPad mini ≈ 744, iPad ≈ 768–834, iPad Pro ≈ 1024. iPhone Pro Max ≈ 430 →
 * toujours exclu. Fondé sur la largeur courante (et non le device) pour gérer
 * correctement le Split View / Slide Over : une app iPad réduite à ~400pt doit
 * retomber sur la mise en page téléphone.
 */
export const TABLET_MIN_WIDTH = 700;

/**
 * Device statique : vrai iPad, indépendant de la rotation et du multitâche.
 * Réservé aux valeurs NON réactives (ex. `orientation` d'un écran expo-router,
 * évaluée hors composant). Pour la mise en page, préférer `useResponsive`.
 */
export const IS_PAD_DEVICE =
  Platform.OS === "ios" && Boolean((Platform as { isPad?: boolean }).isPad);

/**
 * Device de classe tablette — iPad OU tablette Android — stable en rotation
 * (petit côté mesuré au lancement, plein écran). Pour les options NON réactives
 * partagées entre plateformes (ex. orientation d'un écran expo-router).
 */
export const IS_TABLET_DEVICE =
  IS_PAD_DEVICE ||
  Math.min(Dimensions.get("window").width, Dimensions.get("window").height) >=
    TABLET_MIN_WIDTH;

/** Largeur de lecture confortable (réglages, blocs de texte long). */
export const CONTENT_MAX_WIDTH = 640;
/** Largeur max de la fiche détail centrée sur grand écran. */
export const DETAIL_MAX_WIDTH = 920;
/** Largeur max d'une modale « form-sheet » centrée. */
export const SHEET_MAX_WIDTH = 520;

export interface Responsive {
  width: number;
  height: number;
  /** Écran de classe tablette (petit côté courant >= seuil). */
  isTablet: boolean;
  isLandscape: boolean;
}

/** Dimensions + classe d'appareil, réactif à la rotation. */
export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  return useMemo(() => {
    const shortest = Math.min(width, height);
    return {
      width,
      height,
      isTablet: shortest >= TABLET_MIN_WIDTH,
      isLandscape: width > height,
    };
  }, [width, height]);
}

/**
 * Padding horizontal qui centre le contenu sous une largeur max sur grand écran.
 * Téléphone (largeur ≤ maxWidth + marges) : renvoie `screenPadding` (inchangé).
 * Tablette : renvoie de grosses marges latérales → colonne centrée `maxWidth`.
 * Idéal pour les écrans de réglages / texte long, sans envelopper le JSX.
 */
export function useContentPadding(maxWidth: number = CONTENT_MAX_WIDTH): number {
  const { width } = useWindowDimensions();
  const avail = width - useRailWidth();
  const min = spacing.screenPadding;
  if (avail <= maxWidth + min * 2) return min;
  return Math.round((avail - maxWidth) / 2);
}

export interface GridOptions {
  /** Colonnes sur téléphone — reproduit l'existant, jamais modifié. */
  phoneColumns: number;
  /** Largeur de carte cible sur tablette (dérive le nombre de colonnes). */
  targetTablet?: number;
  /** Plafond de colonnes sur tablette. */
  maxColumns?: number;
  /** Espace entre cartes (défaut `spacing.sm`). */
  gutter?: number;
  /** Padding horizontal du conteneur (défaut `spacing.screenPadding`). */
  padding?: number;
}

export interface GridLayout {
  numColumns: number;
  /** Largeur d'une carte, cohérente avec `padding`/`gutter` retournés. */
  itemWidth: number;
  gutter: number;
  padding: number;
  isTablet: boolean;
}

/**
 * Calcule colonnes + largeur de carte, réactif à la rotation.
 *
 * Téléphone : garde `phoneColumns` à l'identique (aucune régression iPhone).
 * Tablette : dérive les colonnes d'une largeur de carte cible, borné à
 * `[phoneColumns, maxColumns]`.
 *
 * ⚠️ Le conteneur DOIT appliquer le `padding` retourné (et non une constante
 * locale) pour que `itemWidth` reste exact.
 */
export function useGrid(opts: GridOptions): GridLayout {
  const { width } = useWindowDimensions();
  const railWidth = useRailWidth();
  const {
    phoneColumns,
    targetTablet = 150,
    maxColumns = 8,
    gutter = spacing.sm,
    padding = spacing.screenPadding,
  } = opts;

  return useMemo(() => {
    const isTablet = width >= TABLET_MIN_WIDTH;
    const usable = width - railWidth - padding * 2;
    let numColumns = phoneColumns;
    if (isTablet) {
      const derived = Math.floor((usable + gutter) / (targetTablet + gutter));
      numColumns = Math.min(maxColumns, Math.max(phoneColumns, derived));
    }
    const itemWidth = (usable - gutter * (numColumns - 1)) / numColumns;
    return { numColumns, itemWidth, gutter, padding, isTablet };
  }, [width, railWidth, phoneColumns, targetTablet, maxColumns, gutter, padding]);
}
