/**
 * Octave (mobile) — les règles PURES du passage mini-lecteur ↔ lecteur plein écran (`sheetTransition.test.ts`).
 *
 * Le lecteur NAÎT du mini-lecteur : à l'ouverture (progression 0 → 1), il part du rectangle exact de la
 * pastille (même haut, même largeur, même HAUTEUR) et grandit jusqu'à l'écran entier ; son contenu n'apparaît
 * qu'une fois la forme presque ouverte. À la fermeture, le chemin inverse : le contenu s'efface d'abord, la forme redescend se
 * poser sur la pastille, et s'y fond. Rien que des transformations et des opacités.
 */

export interface MiniPlayerRect {
  /** Haut de la pastille depuis le haut de l'écran (pt). */
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface SheetOrigin {
  /** Décalages de départ (pt) : le centre de la forme sur celui de la pastille. */
  translateX: number;
  translateY: number;
  /** Échelles de départ : la largeur et la hauteur de la pastille. */
  scaleX: number;
  scaleY: number;
}

/**
 * La forme est l'écran entier, mise à l'échelle autour de son centre : au départ, ses échelles sont celles
 * de la pastille et son centre est posé sur le sien. Faute de pastille mesurée : le lecteur monte du bas de
 * l'écran, pleine taille (comme avant).
 */
export function sheetOrigin(rect: MiniPlayerRect | null, screenWidth: number, screenHeight: number): SheetOrigin {
  if (rect === null || rect.width <= 0 || rect.height <= 0 || rect.top <= 0 || rect.top >= screenHeight) {
    return { translateX: 0, translateY: screenHeight, scaleX: 1, scaleY: 1 };
  }
  return {
    translateX: rect.left + rect.width / 2 - screenWidth / 2,
    translateY: rect.top + rect.height / 2 - screenHeight / 2,
    scaleX: Math.min(1, rect.width / Math.max(1, screenWidth)),
    scaleY: Math.min(1, rect.height / Math.max(1, screenHeight)),
  };
}

/** La pastille du téléphone : posée au-dessus de la barre d'onglets, 12 pt des bords. */
export function phoneMiniRect(screenWidth: number, screenHeight: number, tabBarHeight: number, miniHeight: number, gap: number): MiniPlayerRect | null {
  if (miniHeight <= 0) return null;
  return { top: screenHeight - tabBarHeight - gap - miniHeight, left: 12, width: screenWidth - 24, height: miniHeight };
}

/** La pastille de la tablette : en bas du contenu, à droite de la barre latérale. */
export function tabletMiniRect(
  screenWidth: number, screenHeight: number, miniHeight: number, sidebarWidth: number,
  insets: { left: number; right: number; bottom: number },
): MiniPlayerRect | null {
  if (miniHeight <= 0) return null;
  const left = sidebarWidth + insets.left + 16;
  return { top: screenHeight - Math.max(insets.bottom, 12) - miniHeight, left, width: screenWidth - left - 16 - insets.right, height: miniHeight };
}

/** Le contenu du lecteur paraît entre ces deux points de la progression (la forme est presque ouverte). */
export const CONTENT_FADE_RANGE = [0.6, 0.95] as const;
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

/** La transformation de la forme du lecteur à la progression `p` (0 : la pastille, 1 : plein écran). */
export function sheetFrame(origin: SheetOrigin, p: number): SheetOrigin {
  "worklet";
  const k = 1 - clamp01(p);
  return {
    translateX: origin.translateX * k,
    translateY: origin.translateY * k,
    scaleX: 1 - (1 - origin.scaleX) * k,
    scaleY: 1 - (1 - origin.scaleY) * k,
  };
}

/**
 * Les coins de la forme : ceux d'une feuille tant qu'elle n'occupe pas l'écran, aucun plein écran. Jamais
 * compensés de l'échelle : largeur et hauteur ne s'échelonnent pas pareil, un rayon compensé ferait des
 * coins en ellipse (la forme ne reste écrasée que les premières images, sous la pastille qui s'efface).
 */
export function sheetRadius(p: number): number {
  "worklet";
  return p >= 0.995 ? 0 : SHEET_RADIUS;
}
