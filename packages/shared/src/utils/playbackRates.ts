/**
 * Paliers de vitesse de lecture proposés par le lecteur.
 *
 * Même liste sur le web (`video.playbackRate`) et sur le desktop (propriété
 * mpv `speed`) : c'est la même promesse à l'écran, elle n'a pas à dépendre du
 * moteur qui l'exécute.
 *
 * Bornes : 0,5× en bas, 4× en haut. Le haut n'est pas arbitraire — Chromium
 * coupe le son au-delà de 4×, et un menu qui proposerait une vitesse muette
 * serait un piège. mpv, lui, corrige le pitch tout seul
 * (`audio-pitch-correction=yes` par défaut).
 */

export const TAUX_LECTURE = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4] as const;

/** Vitesse normale — celle qu'on repose au changement de média. */
export const TAUX_NORMAL = 1;

/**
 * Libellé d'un palier : « 0.5x », « 1x », « 1.25x », « 4x ».
 *
 * `toFixed(2)` puis `Number` retire les zéros de queue : on veut « 1x » et non
 * « 1.00x », mais « 0.75x » doit garder ses deux décimales.
 */
export function formaterTaux(taux: number): string {
  return `${Number(taux.toFixed(2))}x`;
}

/** Le palier est-il la vitesse normale ? (aucune comparaison flottante ailleurs) */
export function estTauxNormal(taux: number): boolean {
  return Math.abs(taux - TAUX_NORMAL) < 0.001;
}
