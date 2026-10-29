import { describe, expect, it } from "vitest";
import { IMPORT_SKIP_REASONS, isImportSkipReason, type ImportAbsentTrack } from "../music";
import { IMPORT_REPORT_FOLD_AT, importReport, missingOf, skippedOf, skipReasonOf, type ImportMissingTrack } from "./importReport";

const absent = (index: number, extra: Partial<ImportAbsentTrack> = {}): ImportAbsentTrack => ({
  index, position: 0, title: `Titre ${index}`, artists: ["Artiste"], album: null, durationMs: 180_000, isrc: null, sourceId: null, ...extra,
});
const missing = (index: number, reason: ImportMissingTrack["reason"]): ImportMissingTrack => ({ ...absent(index), reason });

describe("skipReasonOf : le motif d'un titre non importé", () => {
  it("sans extension : « aucune source hors bibliothèque », sauf si la source le dit réservé ou refusé", () => {
    expect(skipReasonOf(absent(0), { kind: "none" })).toBe("noExtension");
    expect(skipReasonOf(absent(0, { sourceBlocked: "region" }), { kind: "none" })).toBe("region");
    expect(skipReasonOf(absent(0, { sourceBlocked: "refused" }), { kind: "none" })).toBe("sourceRefused");
  });

  it("l'extension refuse toute l'opération : son motif, traduit dans la liste fermée", () => {
    expect(skipReasonOf(absent(0), { kind: "refused", reason: "quota" })).toBe("quota");
    expect(skipReasonOf(absent(0), { kind: "refused", reason: "forbidden" })).toBe("notAllowed");
    expect(skipReasonOf(absent(0), { kind: "refused", reason: "failed" })).toBe("unavailable");
    expect(skipReasonOf(absent(0), { kind: "refused", reason: null })).toBe("unavailable");
  });

  it("l'extension dit titre par titre ; « introuvable » cède à ce que la source sait, jamais un doublon", () => {
    const skipped = new Map([[1, "duplicate" as const], [2, "notFound" as const]]);
    expect(skipReasonOf(absent(1, { sourceBlocked: "region" }), { kind: "done", skipped })).toBe("duplicate");
    expect(skipReasonOf(absent(2, { sourceBlocked: "region" }), { kind: "done", skipped })).toBe("region");
    expect(skipReasonOf(absent(2), { kind: "done", skipped })).toBe("notFound");
  });

  it("missingOf : avec l'extension, seuls les titres qu'elle n'a pas posés ; sans elle, tous", () => {
    const list = [absent(0), absent(1), absent(2)];
    expect(missingOf(list, { kind: "done", skipped: new Map([[1, "duplicate"]]) }).map((t) => [t.index, t.reason])).toEqual([[1, "duplicate"]]);
    expect(missingOf(list, { kind: "none" }).map((t) => t.reason)).toEqual(["noExtension", "noExtension", "noExtension"]);
  });

  it("skippedOf : une extension d'avant (notFound seul) et une de 1.40.0 (skipped) se lisent pareil", () => {
    expect([...skippedOf({ notFound: [3, 5] })]).toEqual([[3, "notFound"], [5, "notFound"]]);
    expect([...skippedOf({ notFound: [3], skipped: [{ index: 3, reason: "notFound" }, { index: 4, reason: "duplicate" }] })]).toEqual([[3, "notFound"], [4, "duplicate"]]);
    expect([...skippedOf(null)]).toEqual([]);
  });
});

describe("importReport : « X sur N titres »", () => {
  it("la playlist de Damien : 30 titres, 18 dans la bibliothèque, 3 de ses imports, 6 en cloud, 3 non importés", () => {
    const report = importReport({ total: 30, inLibrary: 18, outside: 9, own: 3, missing: [missing(29, "notFound"), missing(4, "region"), missing(12, "duplicate")] });
    expect([report.kept, report.total]).toEqual([27, 30]);
    expect(report.parts).toEqual([{ part: "library", count: 18 }, { part: "imported", count: 3 }, { part: "cloud", count: 6 }]);
    expect(report.missing.map((t) => t.index)).toEqual([4, 12, 29]);
    expect(report.reasons).toEqual([{ reason: "notFound", count: 1 }, { reason: "region", count: 1 }, { reason: "duplicate", count: 1 }]);
    expect(report.folded).toBe(false);
  });

  it("une part vide ne se dit pas ; rien en dehors de la bibliothèque : une seule part", () => {
    expect(importReport({ total: 10, inLibrary: 10, outside: 0, own: 0, missing: [] }).parts).toEqual([{ part: "library", count: 10 }]);
  });

  it(`au-delà de ${IMPORT_REPORT_FOLD_AT} titres non importés, la liste se replie`, () => {
    const many = Array.from({ length: IMPORT_REPORT_FOLD_AT + 1 }, (_, i) => missing(i, "notFound"));
    expect(importReport({ total: 20, inLibrary: 14, outside: 0, own: 0, missing: many }).folded).toBe(true);
    expect(importReport({ total: 20, inLibrary: 15, outside: 0, own: 0, missing: many.slice(1) }).folded).toBe(false);
  });

  it("un compte « vos imports » jamais plus grand que ce que l'extension a posé ; N jamais plus petit que ce qui est compté", () => {
    const report = importReport({ total: 2, inLibrary: 1, outside: 1, own: 4, missing: [missing(2, "notFound")] });
    expect(report.parts).toEqual([{ part: "library", count: 1 }, { part: "imported", count: 1 }]);
    expect(report.total).toBe(3);
  });

  it("la liste des motifs est fermée", () => {
    expect(IMPORT_SKIP_REASONS.every(isImportSkipReason)).toBe(true);
    expect(isImportSkipReason("Error: boom")).toBe(false);
  });
});
