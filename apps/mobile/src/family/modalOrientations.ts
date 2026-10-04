/**
 * Toutes les orientations : une `Modal` iOS n'accepte que le portrait par
 * défaut, et l'iPad posé en paysage tournerait l'interface pour l'ouvrir.
 */
export const MODAL_ORIENTATIONS = ["portrait", "portrait-upside-down", "landscape", "landscape-left", "landscape-right"] as const;
