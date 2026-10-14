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
