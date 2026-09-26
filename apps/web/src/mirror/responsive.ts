/**
 * Les mesures responsives de l'app mobile (`apps/mobile/src/theme/responsive.ts`),
 * recopiées À L'IDENTIQUE : colonnes de grille, colonne de lecture centrée,
 * largeur des cartes de rangée, géométrie du hero. Les fonctions sont pures ;
 * les hooks de `useMirrorLayout.ts` les nourrissent du viewport.
 */

export const SCREEN_PADDING = 16;
/** Largeur de lecture confortable (réglages, blocs de texte long). */
export const CONTENT_MAX_WIDTH = 640;
/** Largeur max de la fiche détail centrée sur grand écran. */
export const DETAIL_MAX_WIDTH = 920;
/** Largeur max d'une feuille centrée. */
export const SHEET_MAX_WIDTH = 520;
/** Largeur du rail de navigation de l'iPad en paysage. */
export const RAIL_WIDTH = 76;
/** Seuil de largeur des grilles (l'app raisonne ici sur la largeur, pas le petit côté). */
export const GRID_TABLET_MIN_WIDTH = 700;

/** Marge latérale qui centre une colonne `maxWidth` ; 16 tant qu'elle tient. */
export function contentPadding(width: number, railWidth: number, maxWidth = CONTENT_MAX_WIDTH): number {
  const avail = width - railWidth;
  if (avail <= maxWidth + SCREEN_PADDING * 2) return SCREEN_PADDING;
  return Math.round((avail - maxWidth) / 2);
}

export interface GridOptions {
  phoneColumns: number;
  targetTablet?: number;
  maxColumns?: number;
  gutter?: number;
  padding?: number;
}

export interface GridLayout {
  numColumns: number;
  itemWidth: number;
  gutter: number;
  padding: number;
  isTablet: boolean;
}

export function gridLayout(width: number, railWidth: number, opts: GridOptions): GridLayout {
  const { phoneColumns, targetTablet = 150, maxColumns = 8, gutter = 8, padding = SCREEN_PADDING } = opts;
  const isTablet = width >= GRID_TABLET_MIN_WIDTH;
  const usable = width - railWidth - padding * 2;
  let numColumns = phoneColumns;
  if (isTablet) {
    const derived = Math.floor((usable + gutter) / (targetTablet + gutter));
    numColumns = Math.min(maxColumns, Math.max(phoneColumns, derived));
  }
  const itemWidth = (usable - gutter * (numColumns - 1)) / numColumns;
  return { numColumns, itemWidth, gutter, padding, isTablet };
}

export type CardDensity = "compact" | "normal" | "large";
const CARD_BASE = { phone: 130, tablet: 168 } as const;
const DENSITY_FACTOR: Record<CardDensity, number> = { compact: 0.85, normal: 1, large: 1.2 };

/** LA largeur d'une carte de rangée : base de l'appareil × facteur du compte. */
export function rowCardWidth(isTablet: boolean, density: CardDensity = "normal"): number {
  return Math.round((isTablet ? CARD_BASE.tablet : CARD_BASE.phone) * DENSITY_FACTOR[density]);
}

export interface HeroMetrics {
  bannerH: number;
  slideW: number;
  margin: number;
  radius: number;
  isTablet: boolean;
  /** Carte plus haute que large : l'affiche plutôt qu'un 16/9 rogné. */
  portrait: boolean;
}

const PORTRAIT_CARD_RATIO = 0.8;

export function heroMetrics(width: number, height: number, railWidth: number, isTablet: boolean): HeroMetrics {
  const margin = SCREEN_PADDING;
  // 0.74 : laisse la tête de « Reprendre » visible au-dessus de la barre d'onglets.
  const bannerH = Math.min(isTablet ? 820 : 660, Math.round(height * 0.74));
  const slideW = width - railWidth - margin * 2;
  return { bannerH, slideW, margin, radius: 20, isTablet, portrait: slideW / bannerH < PORTRAIT_CARD_RATIO };
}
