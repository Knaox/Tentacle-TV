/**
 * Les mesures du chrome de l'app, partagées par la coquille et les écrans.
 */

/** Barre de contenu de l'en-tête, hors zone sûre (`HEADER_BAR_HEIGHT` de l'app). */
export const HEADER_BAR_HEIGHT = 44;
/** Hauteur totale de l'en-tête : `max(inset haut, 24) + 44`. */
export const HEADER_TOTAL = `calc(max(env(safe-area-inset-top, 0px), 24px) + ${HEADER_BAR_HEIGHT}px)`;

/** Géométrie de la barre d'onglets (`GlassTabItem`, `GlassTabBar`). */
export const TAB_PILL_W = 52;
export const TAB_PILL_H = 32;
export const TAB_ROW_PAD_V = 8;
export const TAB_LABEL_GAP = 2;
export const TAB_LABEL_LINE_HEIGHT = 13;
/** Hauteur de la pilule, dérivée de sa géométrie (63). */
export const TAB_BAR_HEIGHT = 2 * TAB_ROW_PAD_V + TAB_PILL_H + TAB_LABEL_GAP + TAB_LABEL_LINE_HEIGHT;
export const TAB_MIN_BOTTOM_INSET = 10;
/** Hauteur totale occupée par la barre flottante, marge basse comprise. */
export const TAB_BAR_TOTAL = `calc(${TAB_BAR_HEIGHT}px + max(env(safe-area-inset-bottom, 0px), ${TAB_MIN_BOTTOM_INSET}px))`;
