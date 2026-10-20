import { CHROME_BOTTOM_ROW, CHROME_TOP_ROW, type SafeInsets } from "../chrome/chromeInsets";

/**
 * Où se pose un panneau du lecteur (pistes, réglages, épisodes) — la règle
 * du lecteur d'Apple : l'image reste VISIBLE et lisible, jamais un voile noir
 * plein écran ni une feuille pleine largeur sur un téléphone couché.
 *
 * - `side` : un panneau flottant contre le bord droit, à la hauteur de son
 *   contenu, posé au-dessus des outils qui l'ouvrent et sous la rangée du
 *   haut (paysage, iPad) — il ne recouvre ni « fermer » ni l'image dans l'image.
 *
 * Un panneau occupe le MILIEU de la hauteur, là où l'îlot d'un iPhone couché
 * mord sur un côté : ses côtés suivent la marge sûre RÉELLE, pas l'écart d'un
 * coin des barres (`chromeInsets`) — sinon titre et vignettes passaient sous
 * l'îlot (banc du 21/10).
 * - `bottom` : une carte flottante en bas, décollée des bords (téléphone
 *   debout), plafonnée pour laisser voir le haut de l'image.
 * - `shelf` : une étagère en bas sur toute la largeur utile, qui défile de
 *   côté (épisodes en paysage et sur iPad, comme l'app TV d'Apple).
 */
export type PanelKind = "menu" | "episodes";
export type PanelMode = "side" | "bottom" | "shelf";

export interface PanelLayoutInput {
  kind: PanelKind;
  width: number;
  height: number;
  isTablet: boolean;
  /** Les marges des commandes (`chromeInsets`). */
  edges: SafeInsets;
  /** Les marges sûres du système (îlot, encoche, indicateur d'accueil). */
  insets: SafeInsets;
}

export interface PanelFrame {
  mode: PanelMode;
  /** Distances aux bords de l'écran ; `left` absent = calé à droite (`side`). */
  left?: number;
  right: number;
  bottom: number;
  width?: number;
  maxHeight: number;
  radius: number;
}

/** Largeur d'un panneau latéral : celle d'un menu d'iOS, un peu plus sur iPad. */
export const SIDE_WIDTH = { phone: 340, tablet: 380 } as const;
/** Air entre une carte du bas et les bords d'un téléphone debout. */
export const BOTTOM_GAP = 8;
/** Part de la hauteur qu'une carte du bas laisse au minimum à l'image. */
const BOTTOM_IMAGE_SHARE = { menu: 0.38, episodes: 0.3 } as const;

export function panelLayout(input: PanelLayoutInput): PanelFrame {
  const { kind, width, height, isTablet, edges, insets } = input;
  const landscape = width > height;
  const usableHeight = Math.max(0, height - edges.top - edges.bottom);
  const left = Math.max(edges.left, insets.left);
  const right = Math.max(edges.right, insets.right);

  if (kind === "episodes" && (landscape || isTablet)) {
    return {
      mode: "shelf",
      left,
      right,
      bottom: edges.bottom,
      // L'étagère ne monte jamais au-delà des quatre cinquièmes : le haut de l'image reste.
      maxHeight: Math.round(usableHeight * 0.8),
      radius: isTablet ? 26 : 22,
    };
  }

  if (kind === "menu" && (landscape || isTablet)) {
    const target = isTablet ? SIDE_WIDTH.tablet : SIDE_WIDTH.phone;
    const sideWidth = Math.min(target, Math.round(width * (landscape ? 0.46 : 0.6)));
    const top = edges.top + CHROME_TOP_ROW + 8;
    const bottom = edges.bottom + CHROME_BOTTOM_ROW + 8;
    return {
      mode: "side",
      right,
      bottom,
      width: sideWidth,
      maxHeight: Math.max(160, height - top - bottom),
      radius: 22,
    };
  }

  const bottom = Math.max(edges.bottom, BOTTOM_GAP);
  return {
    mode: "bottom",
    left: BOTTOM_GAP,
    right: BOTTOM_GAP,
    bottom,
    maxHeight: Math.round((height - edges.top - bottom) * (1 - BOTTOM_IMAGE_SHARE[kind])),
    radius: 28,
  };
}

/** Largeur d'une carte d'épisode sur l'étagère (vignette 16:9 au-dessus du texte). */
export const EPISODE_CARD_WIDTH = { phone: 188, tablet: 248 } as const;
/** L'écart entre deux cartes de l'étagère. */
export const EPISODE_CARD_GAP = 12;
