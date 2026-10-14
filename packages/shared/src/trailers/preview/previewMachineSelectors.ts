import { TRAILER_PREVIEW_TIMING, type TrailerPreviewTiming } from "./previewTiming";
import type { TrailerPreviewState } from "./previewMachineTypes";
import { VIDEO, intentAt, revealAt } from "./previewMachineRules";

/** Ce qu'on LIT de l'état de la machine (`previewMachine.ts`) : échéance, montage, visibilité, lecture. */

/** La prochaine échéance (ms) à surveiller, `null` s'il n'y a rien à attendre. */
export function nextTrailerPreviewDeadline(
  state: TrailerPreviewState,
  timing: TrailerPreviewTiming = TRAILER_PREVIEW_TIMING,
): number | null {
  const deadlines: number[] = [];
  if (state.exitUntil !== null) deadlines.push(state.exitUntil);
  if (state.phase === "intent" && state.since !== null) deadlines.push(intentAt(state, timing));
  if (state.phase === "fetching" && state.retryAt !== null) deadlines.push(state.retryAt);
  if (state.phase === "buffering" && state.readyBy !== null) deadlines.push(state.readyBy);
  if (state.phase === "ready") deadlines.push(revealAt(state, timing));
  return deadlines.length ? Math.min(...deadlines) : null;
}

/** La vidéo doit exister (chargée cachée, montrée, ou en fondu de sortie). */
export function trailerPreviewMounted(state: TrailerPreviewState): boolean {
  return VIDEO.has(state.phase) || state.exitUntil !== null;
}

/** La mini-carte se montre : première image là, seconde écoulée, survol tenu, rien ne bloque. */
export function trailerPreviewVisible(state: TrailerPreviewState): boolean {
  return state.phase === "shown";
}

/** La vidéo joue : montrée, ou dans son fondu de sortie (le son y décroît). */
export function trailerPreviewPlaying(state: TrailerPreviewState): boolean {
  return state.phase === "shown" || state.exitUntil !== null;
}

/**
 * Le flux est demandé (ou gardé), et l'aperçu occupe la place unique (cf.
 * `previewArbiter.ts`) : de l'intention passée jusqu'à la fin de la lecture.
 */
export function trailerPreviewWantsStream(state: TrailerPreviewState): boolean {
  return state.phase === "fetching" || VIDEO.has(state.phase);
}
