/**
 * Le NOM du lot en cours, pour l'en-tête de la file : « Caminandes · Saison 1 » quand tout ce
 * qui transite est d'une même saison, « Caminandes » d'une même série, le titre d'un film seul,
 * sinon le compte. Pur — l'appelant traduit.
 */

import type { DownloadEntry } from "./api";

const IN_FLIGHT = new Set(["queued", "downloading", "paused", "error"]);

export type QueueLotLabel =
  | { kind: "season"; series: string; season: number }
  | { kind: "series"; series: string }
  | { kind: "title"; title: string }
  | { kind: "mixed"; count: number };

type LabelEntry = Pick<DownloadEntry, "status" | "kind" | "title" | "itemId" | "seriesName" | "seriesId" | "parentIndexNumber">;

export function queueLotLabel(entries: readonly LabelEntry[]): QueueLotLabel | null {
  const inFlight = entries.filter((entry) => IN_FLIGHT.has(entry.status));
  const first = inFlight[0];
  if (first === undefined) return null;
  if (inFlight.length === 1 && first.kind !== "episode") return { kind: "title", title: first.title ?? first.itemId };

  const seriesOf = (entry: LabelEntry): string | null => (entry.kind === "episode" ? entry.seriesId ?? entry.seriesName : null);
  const series = seriesOf(first);
  if (series === null || !inFlight.every((entry) => seriesOf(entry) === series)) {
    return inFlight.length === 1 ? { kind: "title", title: first.title ?? first.itemId } : { kind: "mixed", count: inFlight.length };
  }
  const name = first.seriesName ?? first.title ?? first.itemId;
  const season = first.parentIndexNumber;
  if (season != null && inFlight.every((entry) => entry.parentIndexNumber === season)) {
    return { kind: "season", series: name, season };
  }
  return { kind: "series", series: name };
}
