/**
 * Octave (mobile) — les gestes sur la file de la musique gardée : mettre en pause,
 * reprendre, réessayer — titre par titre ou toute la file d'Octave. Jamais
 * `pauseAllTransfers` du moteur : il arrêterait aussi les films gardés, que la
 * page d'Octave ne montre pas. Une pause VOULUE survit au retour du réseau et ne
 * repart qu'au geste ; une pause système repart d'elle-même (rien à reprendre).
 */

import type { KeptMusicTrack } from "@tentacle-tv/offline-core";
import { pauseTransfer, resumeTransfer } from "@/offline/engineApi";
import { haptic } from "@/utils/haptics";

const isMoving = (k: KeptMusicTrack): boolean => k.status === "queued" || k.status === "downloading";
const isUserPaused = (k: KeptMusicTrack): boolean => k.status === "paused" && k.pausedByUser;

/** Le moteur peut se plaindre d'un fichier qui vient de finir : le geste suivant n'en dépend pas. */
function each(tracks: readonly KeptMusicTrack[], act: (fileId: number) => void): number {
  let done = 0;
  for (const k of tracks) {
    try {
      act(k.fileId);
      done += 1;
    } catch {
      // Déjà terminé ou retiré entre-temps : la liste relue le dira.
    }
  }
  return done;
}

export const queueHasMoving = (queue: readonly KeptMusicTrack[]): boolean => queue.some(isMoving);
export const queueHasUserPaused = (queue: readonly KeptMusicTrack[]): boolean => queue.some(isUserPaused);

export function pauseQueue(queue: readonly KeptMusicTrack[]): void {
  if (each(queue.filter(isMoving), pauseTransfer) > 0) haptic("commit");
}

export function resumeQueue(queue: readonly KeptMusicTrack[]): void {
  if (each(queue.filter(isUserPaused), resumeTransfer) > 0) haptic("commit");
}

export function retryFailed(queue: readonly KeptMusicTrack[]): void {
  if (each(queue.filter((k) => k.status === "error"), resumeTransfer) > 0) haptic("commit");
}

/** Le geste d'une rangée de la file : en pause → reprendre ; en défaut → réessayer ; sinon → mettre en pause. */
export type RowGesture = "pause" | "resume" | "retry";

export function rowGesture(k: KeptMusicTrack): RowGesture {
  if (k.status === "error") return "retry";
  return k.status === "paused" ? "resume" : "pause";
}

export function applyRowGesture(k: KeptMusicTrack, gesture: RowGesture): void {
  each([k], gesture === "pause" ? pauseTransfer : resumeTransfer);
  haptic("commit");
}
