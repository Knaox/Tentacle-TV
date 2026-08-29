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
 * Ce que l'arbitre a besoin de savoir d'une sourdine : rien d'autre que
 * « ce passage-là est-il refusé ». Décrit par sa FORME, un `Set` comme une
 * `Map` y répondent — la coquille garde la POSITION du refus en valeur, pour
 * savoir quand le lever, et l'arbitre n'a pas à connaître ce détail.
 */
export interface MutedSegments {
  has(type: SegmentType): boolean;
}

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
  muted: MutedSegments,
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

/**
 * Les sourdines que le RETOUR EN ARRIÈRE lève.
 *
 * La croix vaut pour la lecture en cours — mais revenir derrière l'endroit où
 * on l'a donnée, c'est rejouer le passage : on redemande son bouton, croix
 * comprise. C'est la même règle que celle du saut ci-dessus, et la même
 * tolérance : une position échantillonnée à gros grain ne doit pas lever une
 * sourdine qu'on vient tout juste de poser.
 *
 * @param refusedAt Chaque passage refusé, et la position où il l'a été.
 * @returns Les types à relever. Vide dans le cas courant — l'appelant ne
 *          reconstruit son état que lorsqu'il y a vraiment quelque chose à faire.
 */
export function segmentsRewoundInto(
  refusedAt: ReadonlyMap<SegmentType, number>,
  positionMs: number,
): SegmentType[] {
  const out: SegmentType[] = [];
  for (const [type, at] of refusedAt) {
    if (hasRewoundPastSkip(positionMs, at)) out.push(type);
  }
  return out;
}
