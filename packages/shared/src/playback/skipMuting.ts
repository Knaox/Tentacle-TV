/**
 * Les deux règles qui décident si un bouton de saut se montre — au-delà de
 * l'arbitre, qui ne connaît que les segments et les réglages.
 *
 * Elles sont ici, pures, parce qu'elles répondent à deux demandes précises et
 * qu'un lecteur ne doit pas pouvoir les réinterpréter chacun à sa façon. Aucun
 * DOM, aucune horloge : un banc les déroule.
 */

import type { SegmentType } from "./segmentTypes";

/**
 * La CROIX a été cliquée sur ce type : le bouton sort de l'image, mais reste
 * atteignable tant que les contrôles du lecteur sont affichés.
 *
 * Autrement dit, la croix veut dire « ne me le propose plus », pas « je ne
 * veux plus pouvoir le faire » — d'où le retour du bouton dès qu'on bouge la
 * souris. `controlsVisible` absent = surface sans habillage connu : on masque
 * complètement, faute de savoir quand le rendre.
 */
export function isSegmentSilenced(
  muted: ReadonlySet<SegmentType>,
  type: SegmentType,
  controlsVisible: boolean | undefined,
): boolean {
  return muted.has(type) && controlsVisible !== true;
}

/**
 * Tolérance sur le « retour en arrière » : une position échantillonnée à 1 Hz
 * peut arriver légèrement en deçà de la cible sans qu'on ait bougé.
 */
export const REWIND_TOLERANCE_MS = 1_000;

/**
 * L'utilisateur est-il revenu DERRIÈRE la cible du dernier saut ?
 *
 * L'état `skipped` masque la pilule le temps que la position rattrape — un
 * saut peut demander plusieurs secondes. Mais qui revient en arrière n'attend
 * plus rien : il redemande son bouton. Sans cette règle, la pilule restait
 * muette jusqu'aux dix secondes du garde-fou.
 */
export function hasRewoundPastSkip(positionMs: number, targetMs: number | null): boolean {
  return targetMs !== null && positionMs < targetMs - REWIND_TOLERANCE_MS;
}
