/**
 * Ce que les deux analyses qui font travailler Jellyfin PARTAGENT : l'analyse
 * audio des voisins de saison (`audioAnalysis.ts`) et l'analyse de fin de média
 * (`tailAnalysis/tailAnalysis.ts`).
 *
 *  - **un seul créneau** : jamais deux transcodages audio lancés à la fois par
 *    Tentacle, quelle que soit l'analyse qui les demande ;
 *  - **la politesse** : rien ne part tant qu'un autre spectateur transcode une
 *    vidéo — vu en vrai pendant le banc du 20 sept. 2026, un iPhone en plein
 *    film ;
 *  - **les compteurs** que l'administrateur lit dans Services : ce que la
 *    fonction a coûté depuis le démarrage.
 */

import { readSessions } from "./watchTime/sessions";

export interface AudioAnalysisCounters {
  jobs: number;
  windows: number;
  bytes: number;
  seconds: number;
  verdicts: number;
  silent: number;
  deferred: number;
}

const counters: AudioAnalysisCounters = { jobs: 0, windows: 0, bytes: 0, seconds: 0, verdicts: 0, silent: 0, deferred: 0 };

export function audioAnalysisCounters(): AudioAnalysisCounters {
  return { ...counters };
}

export function countAudioJob(): void {
  counters.jobs += 1;
}

/** Des extraits transcodés par Jellyfin : leur nombre, leur taille, leur temps. */
export function countAudioWindow(bytes: number, elapsedMs: number, windows = 1): void {
  counters.windows += windows;
  counters.bytes += bytes;
  counters.seconds += elapsedMs / 1000;
}

/** La fin d'un job : quelque chose trouvé, ou rien. */
export function countAudioOutcome(found: boolean): void {
  if (found) counters.verdicts += 1;
  else counters.silent += 1;
}

export function countAudioDeferral(): void {
  counters.deferred += 1;
}

/** Pour les tests. */
export function resetAudioCountersForTests(): void {
  for (const key of Object.keys(counters) as Array<keyof AudioAnalysisCounters>) counters[key] = 0;
}

/** Un autre spectateur transcode-t-il une vidéo en ce moment ? */
export async function otherViewerTranscoding(itemId: string): Promise<boolean> {
  const sessions = await readSessions();
  if (sessions === null) return false;
  return sessions.some(
    (s) =>
      s.NowPlayingItem?.Id !== undefined &&
      s.NowPlayingItem.Id !== itemId &&
      s.PlayState?.IsPaused !== true &&
      s.TranscodingInfo?.IsVideoDirect === false,
  );
}

let slot: Promise<unknown> = Promise.resolve();

/** Exécute `work` quand le créneau audio est libre — un transcodage à la fois. */
export function withAudioSlot<T>(work: () => Promise<T>): Promise<T> {
  const run = slot.then(work, work);
  slot = run.catch(() => undefined);
  return run;
}
