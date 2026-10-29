/**
 * Octave — le BILAN de fin d'import d'une playlist (Damien, 29/10), une règle pour le web, le bureau et le mobile :
 * « X sur N titres », en séparant ce qui était déjà dans la bibliothèque, ce que le compte avait importé lui-même et
 * ce qui se lit « en cloud » ; puis chaque titre NON importé avec son motif (liste fermée `ImportSkipReason`, que les
 * clients disent avec leurs mots — jamais un message brut). Longue, la liste se replie sous le bilan.
 *
 * Les motifs viennent du cœur et de l'extension ; `skipReasonOf` ne fait que les combiner avec ce que la SOURCE dit
 * d'un titre (réservé à d'autres pays, refusé) et ce que le client sait du parcours (aucune extension, extension muette).
 */

import { IMPORT_SKIP_REASONS, type ImportAbsentTrack, type ImportSkipReason, type ImportTracksProgress } from "../music";

/** Au-delà de ce nombre de titres non importés, leur liste est repliée sous le bilan. */
export const IMPORT_REPORT_FOLD_AT = 5;

/** Un titre de la source qui n'est pas dans la playlist, et pourquoi. */
export interface ImportMissingTrack extends ImportAbsentTrack {
  reason: ImportSkipReason;
}

/** Ce que l'extension a dit de l'ensemble (`null` : aucune extension ne prend les absents). */
export type ImportOutsideOutcome =
  | { kind: "none" }
  /** Refus ou échec de toute l'opération : `reason` de sa progression, s'il y en a une. */
  | { kind: "refused"; reason: ImportTracksProgress["reason"] | null }
  | { kind: "done"; skipped: ReadonlyMap<number, ImportSkipReason> };

const OPERATION_REASON: Record<NonNullable<ImportTracksProgress["reason"]>, ImportSkipReason> = {
  quota: "quota",
  forbidden: "notAllowed",
  notFound: "notFound",
  unavailable: "unavailable",
  failed: "unavailable",
};

/** Le motif d'un absent qui n'est PAS entré dans la playlist. */
export function skipReasonOf(track: ImportAbsentTrack, outside: ImportOutsideOutcome): ImportSkipReason {
  const atSource: ImportSkipReason | null = track.sourceBlocked === "region" ? "region" : track.sourceBlocked === "refused" ? "sourceRefused" : null;
  if (outside.kind === "none") return atSource ?? "noExtension";
  if (outside.kind === "refused") return outside.reason ? OPERATION_REASON[outside.reason] : "unavailable";
  const said = outside.skipped.get(track.index) ?? "notFound";
  // Introuvable ailleurs, et la source le dit réservé ou refusé : c'est l'explication utile.
  return said === "notFound" && atSource ? atSource : said;
}

/** Les absents qui ne sont PAS dans la playlist (tous, sans extension ou si elle a refusé), chacun avec son motif. */
export function missingOf(absent: readonly ImportAbsentTrack[], outside: ImportOutsideOutcome): ImportMissingTrack[] {
  return absent.filter((t) => outside.kind !== "done" || outside.skipped.has(t.index)).map((t) => ({ ...t, reason: skipReasonOf(t, outside) }));
}

/** Les motifs d'une progression d'extension : `skipped` (1.40.0) l'emporte sur `notFound`. */
export function skippedOf(progress: Pick<ImportTracksProgress, "notFound" | "skipped"> | null): Map<number, ImportSkipReason> {
  const out = new Map<number, ImportSkipReason>();
  for (const index of progress?.notFound ?? []) out.set(index, "notFound");
  for (const s of progress?.skipped ?? []) out.set(s.index, s.reason);
  return out;
}

export type ImportReportPart = "library" | "imported" | "cloud";

export interface ImportReport {
  /** Titres dans la playlist (« X sur N »). */
  kept: number;
  /** Titres lus à la source. */
  total: number;
  /** Les parts non vides, dans cet ordre : bibliothèque, vos imports, en cloud. */
  parts: { part: ImportReportPart; count: number }[];
  /** Les titres non importés, dans l'ordre de la source. */
  missing: ImportMissingTrack[];
  /** Le compte par motif (ordre de la liste fermée), pour la ligne de résumé. */
  reasons: { reason: ImportSkipReason; count: number }[];
  /** La liste se replie (trop longue pour être montrée d'emblée). */
  folded: boolean;
}

export interface ImportReportInput {
  total: number;
  inLibrary: number;
  /** Titres posés par l'extension, et parmi eux ceux que le compte avait importés. */
  outside: number;
  own: number;
  missing: readonly ImportMissingTrack[];
}

export function importReport(input: ImportReportInput): ImportReport {
  const own = Math.min(Math.max(0, input.own), input.outside);
  const counts: [ImportReportPart, number][] = [["library", input.inLibrary], ["imported", own], ["cloud", input.outside - own]];
  const missing = [...input.missing].sort((a, b) => a.index - b.index);
  return {
    kept: input.inLibrary + input.outside,
    total: Math.max(input.total, input.inLibrary + input.outside + missing.length),
    parts: counts.filter(([, count]) => count > 0).map(([part, count]) => ({ part, count })),
    missing,
    reasons: IMPORT_SKIP_REASONS.map((reason) => ({ reason, count: missing.filter((t) => t.reason === reason).length })).filter((r) => r.count > 0),
    folded: missing.length > IMPORT_REPORT_FOLD_AT,
  };
}
