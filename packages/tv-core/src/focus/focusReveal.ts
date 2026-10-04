/**
 * Ce qui PARAÎT au focus — partout sur l'Apple TV : l'indication de l'appui
 * maintenu (sous une carte, sur le héros), la raison d'une recommandation,
 * les badges de qualité, les astuces du rail. Décision de l'utilisateur
 * (2026-10-04) : TOUT DE SUITE, en une très brève animation d'opacité (et un
 * glissé de quelques points : `opacity` et `transform` seulement) d'au plus
 * `FOCUS_REVEAL_MAX_MS` — le jeton `TV_MOTION.reveal` de la plateforme. Les
 * temps d'arrêt d'avant (250 ms à 1,2 s) se lisaient comme un retard.
 *
 * Le focus qui « TIENT » (`FOCUS_HOLD_MS`) ne règle plus aucune apparition ;
 * il ne garde que ce qui COÛTE quand un focus balaie une rangée :
 * - la LECTURE de la qualité d'un titre que sa liste ne porte pas (une
 *   requête au serveur) : rien ne se demande pendant un défilement. Connue —
 *   dans le modèle, ou déjà lue —, elle paraît au focus, sans attendre ; à
 *   lire, dès que la lecture aboutit (`qualityBadgesShown`) ;
 * - le HALO d'un épisode, dont le flou se calcule sur le fil principal
 *   (~40 ms par montage, mesuré au simulateur : deux à trois images) : monté
 *   à chaque pas d'un focus qui parcourt les épisodes, il saccaderait.
 *
 * Module pur : la plateforme tient la minuterie et l'animation.
 */

/** L'attente avant que paraisse ce qui se révèle au focus : aucune. */
export const FOCUS_REVEAL_DELAY_MS = 0;
/** La durée d'apparition au plus (le jeton de mouvement de la plateforme s'y tient). */
export const FOCUS_REVEAL_MAX_MS = 150;
/** Le focus a TENU : de quoi lancer ce qui coûte (une lecture, un flou). Un balayage ne tient jamais aussi longtemps. */
export const FOCUS_HOLD_MS = 300;

/** Les badges de qualité paraissent-ils ? Au focus, dès qu'ils sont connus — jamais après une attente de plus. */
export function qualityBadgesShown(state: { focused: boolean; known: boolean }): boolean {
  return state.focused && state.known;
}

/** Faut-il lire la qualité du titre ? Seulement à lire, et quand le focus a tenu. */
export function qualityReadDue(state: { needsRead: boolean; held: boolean }): boolean {
  return state.needsRead && state.held;
}
