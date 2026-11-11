/**
 * Où se pose le bandeau « Lecteur de secours » : sous le bandeau de fenêtre du bureau, puis
 * sous la rangée du haut du LECTEUR — la sortie et le titre.
 *
 * Centré à la hauteur de cette rangée, il recouvrait le titre dès que celui-ci dépassait cent
 * pixels : « Breaking Bad » et son épisode coupés au milieu (recette du lot rf2, mesuré à
 * 1440 px de large : titre de 80 à 208, bandeau à partir de 185).
 */

/** La marge haute du lecteur (`--lg-player-edge`, la même avec et sans verre). */
export const PLAYER_TOP_EDGE = 20;
/** Le bouton de sortie, la plus haute pièce de la rangée (`.pl-btn--solo`). */
export const PLAYER_BACK_BUTTON = 44;

/** Le haut du bandeau, en pixels depuis le haut de la page. */
export function fallbackBannerTop(titleBarHeight: number): number {
  return titleBarHeight + PLAYER_TOP_EDGE + PLAYER_BACK_BUTTON;
}
