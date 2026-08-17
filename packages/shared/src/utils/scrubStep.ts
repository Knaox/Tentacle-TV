/**
 * Pas de scrub PROPORTIONNEL à la durée du média.
 *
 * Le pas fixe de dix secondes faisait deux poids deux mesures : 5 % de la
 * barre par pas sur un épisode de trois minutes, 0,3 % sur un film de
 * cinquante — traverser un long métrage devenait interminable, au maintien
 * comme à l'appui simple. Le COMPORTEMENT ne change pas (mêmes paliers
 * d'accélération ×1/2/4/8, même moteur, même visée) : seul le pas de base
 * s'adapte, à ~0,8 % de la durée par pas.
 *
 * Bornes : plancher à dix secondes — les contenus courts gardent le réglage
 * historique à l'identique (rien ne bouge sous ~26 min) — et plafond à
 * soixante, pour qu'un appui simple reste un geste de visée même sur un
 * documentaire-fleuve. Au palier maximal, traverser N'IMPORTE quelle durée
 * prend ainsi le même ordre de grandeur de maintien (~4 s), c'est le but.
 */

/** Plancher historique : le pas des contenus courts, inchangé. */
export const SCRUB_STEP_MIN_S = 10;
/** Plafond : au-delà, l'appui simple ne viserait plus rien. */
export const SCRUB_STEP_MAX_S = 60;
/** Part de la durée couverte par un pas de base (~0,8 %). */
const PART_DE_DUREE = 1 / 125;

/** Pas de base (s) pour un média d'une durée donnée — arrondi au multiple de
 *  cinq (valeur lisible), borné [10..60]. Durée inconnue → plancher. */
export function pasDeScrub(dureeSec: number | null | undefined): number {
  if (!dureeSec || dureeSec <= 0) return SCRUB_STEP_MIN_S;
  const arrondi = Math.round((dureeSec * PART_DE_DUREE) / 5) * 5;
  return Math.min(SCRUB_STEP_MAX_S, Math.max(SCRUB_STEP_MIN_S, arrondi));
}
