/**
 * Les marges des commandes du lecteur : collées aux bords, juste assez
 * écartées pour éviter ce qui mange l'écran — coins arrondis, encoche,
 * Dynamic Island, indicateur d'accueil —, jamais une marge fixe généreuse.
 *
 * Ce que dit la géométrie d'un iPhone (retour de l'alpha, 21/10) :
 * - en paysage, la marge sûre latérale (≈ 59 pt) est SYMÉTRIQUE et ne vaut que
 *   pour l'îlot, centré verticalement sur un côté. Les barres du haut et du bas
 *   vivent aux COINS : il ne leur faut que l'écart d'un coin arrondi ;
 * - en paysage, iOS ne montre jamais sa barre d'état : la marge du haut est
 *   nulle. La marge sûre lue pendant la rotation est souvent encore celle du
 *   portrait (dimensions et marges n'arrivent pas ensemble) ; la retenir
 *   faisait flotter la barre du haut à 59 pt du bord. On ne la lit donc pas.
 *
 * Android rend des marges RÉELLES (découpe de la caméra du seul côté où elle
 * est, parfois dans un coin) : elles sont suivies telles quelles.
 */
export interface SafeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ChromeInsetsInput {
  os: "ios" | "android" | string;
  isTablet: boolean;
  landscape: boolean;
  /** Les marges sûres du moment. */
  insets: SafeInsets;
  /** La marge du haut stable de l'orientation (`stableTopInset`), barre d'état comprise. */
  stableTop: number;
}

/** Le minimum d'air entre une commande et un bord droit (écran sans coins arrondis). */
export const CHROME_EDGE = 16;
/** L'écart qui sort une commande de la courbe d'un coin arrondi d'iPhone. */
export const CHROME_CORNER = 24;
/** L'air sous la barre d'état, ou sous le bord quand il n'y en a pas. */
export const CHROME_TOP_GAP = 6;
/** L'air au-dessus du bord bas quand rien ne l'occupe. */
export const CHROME_BOTTOM_GAP = 10;

/**
 * Un écran aux coins arrondis : sur iOS, tout appareil à Face ID (indicateur
 * d'accueil, encoche ou îlot) — c'est-à-dire une marge sûre non nulle quelque
 * part. Un iPhone SE (bouton d'accueil) a des coins droits et aucune marge.
 */
function roundedScreen(insets: SafeInsets): boolean {
  return insets.bottom > 0 || insets.left > 0 || insets.right > 0 || insets.top > 20;
}

export function chromeInsets(input: ChromeInsetsInput): SafeInsets {
  const { os, isTablet, landscape, insets, stableTop } = input;
  if (os !== "ios") {
    return {
      top: Math.max(stableTop, 0) + CHROME_TOP_GAP,
      left: Math.max(CHROME_EDGE, insets.left),
      right: Math.max(CHROME_EDGE, insets.right),
      bottom: Math.max(insets.bottom, CHROME_BOTTOM_GAP),
    };
  }
  const rounded = roundedScreen(insets);
  if (isTablet) {
    // iPad : la barre d'état paraît avec les commandes, dans les deux sens.
    const side = rounded ? CHROME_CORNER : CHROME_EDGE;
    return {
      top: stableTop + CHROME_TOP_GAP,
      left: Math.max(side, insets.left),
      right: Math.max(side, insets.right),
      bottom: Math.max(insets.bottom, CHROME_BOTTOM_GAP),
    };
  }
  if (landscape) {
    // iPhone couché : pas de barre d'état, l'îlot au milieu d'un côté.
    const side = rounded ? CHROME_CORNER : CHROME_EDGE;
    return {
      top: rounded ? CHROME_TOP_GAP + 4 : CHROME_TOP_GAP,
      left: side,
      right: side,
      bottom: Math.max(insets.bottom, CHROME_BOTTOM_GAP),
    };
  }
  // iPhone debout : sous la barre d'état (ou l'îlot), les côtés sont libres.
  return {
    top: stableTop + CHROME_TOP_GAP,
    left: Math.max(CHROME_EDGE, insets.left),
    right: Math.max(CHROME_EDGE, insets.right),
    bottom: Math.max(insets.bottom, CHROME_BOTTOM_GAP),
  };
}
