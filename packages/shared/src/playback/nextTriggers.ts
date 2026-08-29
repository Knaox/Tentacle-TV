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

import { findSegments, type ResolvedSegment, type SegmentType } from "./segmentTypes";
import { WINDOW_TAIL_MS } from "./segmentWindow";
import { findSkipCandidate, type SkipCandidateInput } from "./skipCandidate";
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
    // La fenêtre se ferme au MÊME endroit que celle du bouton de saut
    // (`WINDOW_TAIL_MS`), et c'est tout l'enjeu : le bouton cède sa dernière
    // seconde, et la carte s'y engouffrait. Pire, le saut « aller à la scène »
    // vise `endMs` — le bord même de la fenêtre — et tout atterrissage
    // imprécis (image-clé mpv, hls.js, décalage de flux, échantillonnage à
    // 1 Hz) reposait la position DEDANS, bouton effacé : la carte paraissait
    // par-dessus la scène qu'on venait justement de choisir de regarder.
    if (main.hasContentAfter) {
      return positionMs >= main.startMs && positionMs < main.endMs - WINDOW_TAIL_MS;
    }
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

/**
 * L'enchaînement d'épisode est-il ÉLIGIBLE ici et maintenant ?
 *
 * UN SEUL sélecteur, pour la carte ET pour le minuteur. C'est une exigence, pas
 * un confort : `autoNextEngine` ne connaît ni position ni segments, il ne sait
 * que ce que l'appelant lui dit — et si les deux ne disent pas la même chose,
 * l'épisode part sans qu'aucune surface l'ait annoncé. C'est exactement ce qui
 * est arrivé, deux fois.
 *
 * Trois conditions, et les deux dernières sont des REFUS de l'utilisateur :
 *
 * 1. la fenêtre est franchie (`nextCardTriggerReached`) ;
 * 2. la scène post-générique n'a pas été revendiquée — on a demandé à la voir ;
 * 3. le passage en cours n'a pas été mis en sourdine. Refuser un saut, c'est
 *    vouloir REGARDER ce qui passe : ni la carte ni le minuteur ne doivent
 *    s'engouffrer dans la fenêtre que le bouton vient de libérer. Sans cette
 *    ligne, croiser « aller à la scène post-générique » faisait paraître la
 *    carte, puis emportait vers l'épisode suivant dix secondes plus tard —
 *    l'exact contraire de ce que la croix veut dire.
 *
 * L'écran de FIN n'en dépend pas : le média est terminé, il n'y a plus rien à
 * regarder, et le refus d'un passage ne vaut pas refus de la suite.
 */
export interface AutoNextEligibilityInput extends SkipCandidateInput {
  runtimeMs: number;
  libraryId?: string | null;
  /** Les passages mis en sourdine par la croix. */
  mutedSegments?: ReadonlySet<SegmentType>;
  /** La scène post-générique a été revendiquée (cf. `overlayArbiter`). */
  postCreditsClaimed?: boolean;
}

export function autoNextEligible(input: AutoNextEligibilityInput): boolean {
  if (input.postCreditsClaimed) return false;
  const candidate = findSkipCandidate(input);
  if (candidate && input.mutedSegments?.has(candidate.segment.type) === true) return false;
  return nextCardTriggerReached(
    input.positionMs,
    input.runtimeMs,
    input.segments,
    input.settings.next,
    input.libraryId ?? null,
  );
}
