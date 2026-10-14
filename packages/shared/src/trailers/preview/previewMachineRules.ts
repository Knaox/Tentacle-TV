import type { TrailerPreviewTiming } from "./previewTiming";
import type { TrailerPreviewPhase, TrailerPreviewState } from "./previewMachineTypes";

/** Les règles partagées par le réducteur et ses lectures (`previewMachineSelectors.ts`). */

/** Les phases d'un aperçu EN COURS — celles qu'un survol perdu ou un blocage interrompt. */
export const ACTIVE: ReadonlySet<TrailerPreviewPhase> = new Set(["intent", "fetching", "buffering", "ready", "shown"]);
/** Les phases où la vidéo existe (cachée puis montrée). */
export const VIDEO: ReadonlySet<TrailerPreviewPhase> = new Set(["buffering", "ready", "shown"]);

export function revealAt(state: TrailerPreviewState, timing: TrailerPreviewTiming): number {
  return (state.since ?? 0) + timing.revealMs;
}

/** La demande part quand le survol a duré `intentMs` ET que le pointeur est arrêté depuis `intentStillMs`. */
export function intentAt(state: TrailerPreviewState, timing: TrailerPreviewTiming): number {
  const since = state.since ?? 0;
  return Math.max(since + timing.intentMs, (state.stillSince ?? since) + timing.intentStillMs);
}

/** Montrée sur l'image du titre, la vidéo n'a pas encore sa première image : elle a jusqu'à `readyBy`. */
export function awaitingVideo(state: TrailerPreviewState): boolean {
  return (state.phase === "buffering" || state.phase === "shown") && !state.videoReady && state.readyBy !== null;
}

/**
 * La mini-carte peut-elle se montrer à `at` ? Le rendez-vous passé
 * (`revealMs`), et de quoi montrer : la première image de la vidéo, ou
 * l'image du titre — à condition que la bande-annonce soit LISIBLE pour de
 * bon : le serveur l'a vérifiée (`buffering` suit sa réponse) ET son premier
 * fragment vidéo est arrivé ici. Un flux bloqué avant sa première image ne
 * fait rien grandir.
 */
export function revealable(state: TrailerPreviewState, at: number, timing: TrailerPreviewTiming): boolean {
  const onStill = state.phase === "buffering" && state.stillReady && state.videoFragment;
  return (state.phase === "ready" || onStill) && at >= revealAt(state, timing);
}
