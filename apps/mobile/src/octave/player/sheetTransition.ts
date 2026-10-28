/**
 * Octave (mobile) — les règles PURES du passage mini-lecteur ↔ lecteur plein écran (`sheetTransition.test.ts`).
 *
 * Le lecteur NAÎT du mini-lecteur : à l'ouverture (progression 0 → 1), il part de la place exacte de la
 * pastille (même haut, même largeur) et grandit jusqu'à l'écran entier ; son contenu n'apparaît qu'une fois
 * la forme lancée. À la fermeture, le chemin inverse : le contenu s'efface d'abord, la forme redescend se
 * poser sur la pastille, et s'y fond. Rien que des transformations et des opacités.
 */

export interface MiniPlayerRect {
  /** Haut de la pastille depuis le haut de l'écran (pt). */
  top: number;
  left: number;
  width: number;
}

export interface SheetOrigin {
  /** Décalage vertical de départ (pt). */
  translateY: number;
  /** Échelle horizontale de départ (la largeur de la pastille). */
  scaleX: number;
  /** Décalage horizontal : la pastille n'est pas centrée (tablette, à droite de la barre latérale). */
  translateX: number;
}

/** Faute de pastille mesurée : le lecteur monte du bas de l'écran, pleine largeur (comme avant). */
export function sheetOrigin(rect: MiniPlayerRect | null, screenWidth: number, screenHeight: number): SheetOrigin {
  if (rect === null || rect.width <= 0 || rect.top <= 0 || rect.top >= screenHeight) {
    return { translateY: screenHeight, scaleX: 1, translateX: 0 };
  }
  const scaleX = Math.min(1, rect.width / Math.max(1, screenWidth));
  const center = rect.left + rect.width / 2;
  return { translateY: rect.top, scaleX, translateX: center - screenWidth / 2 };
}

/** La pastille du téléphone : posée au-dessus de la barre d'onglets, 12 pt des bords. */
export function phoneMiniRect(screenWidth: number, screenHeight: number, tabBarHeight: number, miniHeight: number, gap: number): MiniPlayerRect | null {
  if (miniHeight <= 0) return null;
  return { top: screenHeight - tabBarHeight - gap - miniHeight, left: 12, width: screenWidth - 24 };
}

/** La pastille de la tablette : en bas du contenu, à droite de la barre latérale. */
export function tabletMiniRect(
  screenWidth: number, screenHeight: number, miniHeight: number, sidebarWidth: number,
  insets: { left: number; right: number; bottom: number },
): MiniPlayerRect | null {
  if (miniHeight <= 0) return null;
  const left = sidebarWidth + insets.left + 16;
  return { top: screenHeight - Math.max(insets.bottom, 12) - miniHeight, left, width: screenWidth - left - 16 - insets.right };
}

/** Le contenu du lecteur paraît entre ces deux points de la progression (la forme est déjà lancée). */
export const CONTENT_FADE_RANGE = [0.35, 0.85] as const;
/** La forme se fond dans la pastille sous ce point (fin de fermeture) : la pastille dessous reparaît. */
export const SHAPE_FADE_RANGE = [0, 0.12] as const;
/** Coins de la forme tant qu'elle n'occupe pas l'écran entier (ceux de la pastille, puis d'une feuille). */
export const SHEET_RADIUS = 28;

function clamp01(x: number): number {
  "worklet";
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Interpolation linéaire bornée sur une plage de la progression. */
export function rangeProgress(progress: number, range: readonly [number, number]): number {
  "worklet";
  return clamp01((progress - range[0]) / Math.max(1e-6, range[1] - range[0]));
}

/** La transformation de la forme du lecteur à la progression `p` (0 : sur la pastille, 1 : plein écran). */
export function sheetFrame(origin: SheetOrigin, p: number): { translateY: number; translateX: number; scaleX: number } {
  "worklet";
  const k = 1 - clamp01(p);
  return {
    translateY: origin.translateY * k,
    translateX: origin.translateX * k,
    scaleX: 1 - (1 - origin.scaleX) * k,
  };
}
