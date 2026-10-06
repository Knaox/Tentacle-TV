import {
  jellyfinOutageCopy, outageNoticeDurationMs, outageNoticeOccasion, type JellyfinHealthState, type JellyfinOutageCopy,
} from "@tentacle-tv/shared";
import type { OutageView } from "./jellyfinOutage";

export interface OutageNoticeModel {
  copy: JellyfinOutageCopy;
  state: JellyfinHealthState;
  /** La panne dure : « ne répond toujours pas », avec « Réessayer ». */
  long: boolean;
  /** Change à chaque nouvelle occasion : la clé du message (et de son compte à rebours). */
  occasion: string;
  /** La durée de son compte à rebours. */
  durationMs: number;
}

/**
 * Le message d'une panne de Jellyfin, TEMPORAIRE (shared
 * `jellyfinOutageCopy.ts`), pur : rien hors panne ni pendant la reprise ;
 * rien pour l'occasion dont le compte à rebours est fini (`doneOccasion`) —
 * un autre état de Jellyfin, ou la panne devenue longue, le refont paraître.
 */
export function outageNoticeOf(
  view: Pick<OutageView, "phase" | "state" | "recoveries">,
  doneOccasion: string | null,
): OutageNoticeModel | null {
  if (view.phase !== "outage" && view.phase !== "long") return null;
  const long = view.phase === "long";
  // L'occasion appartient à UNE panne (`recoveries` : le nombre de retours) :
  // mesuré au simulateur, « redémarre » ne reparaissait plus à la panne
  // suivante, le lecteur resté monté le croyait déjà dit.
  const occasion = `${view.recoveries}:${outageNoticeOccasion(view.state, long)}`;
  if (doneOccasion === occasion) return null;
  const copy = jellyfinOutageCopy(view.state, long);
  if (!copy) return null;
  return { copy, state: view.state, long, occasion, durationMs: outageNoticeDurationMs(long) };
}
