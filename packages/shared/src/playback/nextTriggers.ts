/**
 * QUAND l'épisode suivant peut se proposer — deux questions, pas une.
 *
 * `nextCardTriggerReached` répond pour la FICHE, qui a une fenêtre : elle se
 * retire pour ne pas couvrir une scène post-générique. `nextEpisodeReachable`
 * répond pour l'ACCÈS, qui ne doit plus disparaître une fois offert. Les
 * confondre est précisément le défaut qu'on corrige ici : sauter le générique
 * d'un média à scène finale faisait disparaître la suite jusqu'au bout du
 * fichier.
 *
 * Séparé de `overlayArbiter.ts` pour tenir les 300 lignes ; l'arbitre les
 * ré-exporte, aucun appelant n'a bougé.
 */

import { findSegments, type ResolvedSegment } from "./segmentTypes";
import {
  beforeEndPositionMs,
  resolveBeforeEnd,
  type PlaybackSettings,
} from "./playbackSettings";

/**
 * Le déclencheur de la carte est-il franchi ? Sert aussi d'« éligibilité » au
 * moteur d'enchaînement — même sélecteur, aucune divergence possible.
 *
 * # L'ordre de confiance
 *
 * 1. Un SECOND générique après la scène post-générique (le modèle Plex :
 *    générique → scène → générique final). C'est la donnée la plus sûre qui
 *    existe, elle bat toute heuristique.
 * 2. Le générique principal. S'il porte une scène derrière lui, la fenêtre
 *    s'arrête à sa fin : la carte ne se pose JAMAIS par-dessus une scène que
 *    l'utilisateur a choisi de garder. (Le trou qui s'ouvre alors est comblé
 *    par la pilule « épisode suivant », pas par la carte.)
 * 3. À défaut de tout générique, le repli temporel de la bibliothèque.
 *
 * Le repli ne s'applique donc JAMAIS quand un générique est connu — c'est ce
 * qui empêche par construction les deux de se marcher dessus. Un utilisateur
 * peut passer outre avec `nextTrigger: "beforeEnd"`, et l'interface le dit.
 */
export function nextCardTriggerReached(
  positionMs: number,
  runtimeMs: number,
  segments: readonly ResolvedSegment[],
  next: PlaybackSettings["next"],
  libraryId: string | null = null,
): boolean {
  const outros = findSegments(segments, "Outro");

  if (outros.length > 0 && next.nextTrigger === "outroStart") {
    const main = outros[0];
    const final = outros.length > 1 ? outros[outros.length - 1] : null;
    if (final && positionMs >= final.startMs) return true;
    if (main.hasContentAfter) return positionMs >= main.startMs && positionMs < main.endMs;
    return positionMs >= main.startMs;
  }

  const target = resolveBeforeEnd(next, libraryId);
  if (!target) return false;
  const threshold = beforeEndPositionMs(target, runtimeMs);
  return threshold !== null && positionMs >= threshold;
}

/**
 * L'épisode suivant est-il ATTEIGNABLE à cette position ?
 *
 * Plus large que le déclencheur de la fiche, et c'est voulu : la fiche a une
 * fenêtre — elle se retire pour ne pas couvrir une scène post-générique — là
 * où l'accès à la suite, lui, ne doit plus disparaître une fois offert. Du
 * début du générique (ou du seuil « avant la fin », faute de générique) et
 * jusqu'au bout du fichier.
 */
export function nextEpisodeReachable(
  positionMs: number,
  runtimeMs: number,
  segments: readonly ResolvedSegment[],
  next: PlaybackSettings["next"],
  libraryId: string | null = null,
): boolean {
  const outro = findSegments(segments, "Outro")[0];
  if (outro && next.nextTrigger === "outroStart") return positionMs >= outro.startMs;

  const target = resolveBeforeEnd(next, libraryId);
  if (!target) return false;
  const threshold = beforeEndPositionMs(target, runtimeMs);
  return threshold !== null && positionMs >= threshold;
}
