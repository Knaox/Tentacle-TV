import { describe, expect, it } from "vitest";
import type { KeptMusicCollection, KeptMusicTrack } from "../core/musicLibrary";
import { collectionSummary, keptBytes, keptTransfersRunning, ownCopies, trackPhase } from "./keptProgress";

function kept(key: string, partial: Partial<KeptMusicTrack> = {}): KeptMusicTrack {
  return {
    fileId: 1, itemId: key, trackKey: key, origin: "library", variant: "original", preset: null, status: "complete", errorCode: null,
    pausedByUser: false, bytesDone: 100, expectedSize: 100, title: key, artist: null, album: null, albumKey: null,
    discNumber: null, trackNumber: null, durationMs: null, coverRel: null, sourcePath: null, trackJson: "{}", createdAt: 0,
    ...partial,
  };
}

const map = (...items: KeptMusicTrack[]) => new Map(items.map((k) => [k.trackKey, k]));

describe("keptProgress", () => {
  it("un titre : rien, en cours, gardé, en défaut", () => {
    expect(trackPhase(null)).toBe("none");
    expect(trackPhase(kept("a", { status: "queued" }))).toBe("progress");
    expect(trackPhase(kept("a", { status: "paused" }))).toBe("progress");
    expect(trackPhase(kept("a"))).toBe("complete");
    expect(trackPhase(kept("a", { status: "error" }))).toBe("failed");
    expect(trackPhase(kept("a", { status: "canceled" }))).toBe("none");
  });

  it("un album en cours avance au prorata des octets", () => {
    const s = collectionSummary(["a", "b", "c"], map(kept("a"), kept("b", { status: "downloading", bytesDone: 50 })));
    expect(s).toEqual({ phase: "progress", done: 1, total: 2, fraction: 0.75 });
  });

  it("tout gardé, puis un défaut sans rien en cours", () => {
    expect(collectionSummary(["a", "b"], map(kept("a"), kept("b"))).phase).toBe("complete");
    expect(collectionSummary(["a", "b"], map(kept("a"), kept("b", { status: "error" }))).phase).toBe("failed");
    expect(collectionSummary(["x"], map(kept("a"))).phase).toBe("none");
  });

  it("une playlist jamais gardée en entier, dont l'album d'un titre l'est : elle se propose encore", () => {
    const byKey = map(kept("a"), kept("b"));
    expect(collectionSummary(["a", "b", "c"], byKey, false).phase).toBe("none");
    expect(collectionSummary(["a", "b", "c"], byKey, true).phase).toBe("complete");
    // Tout y est déjà, même par ailleurs : rien à proposer.
    expect(collectionSummary(["a", "b"], byKey, false).phase).toBe("complete");
  });

  it("la place occupée", () => {
    expect(keptBytes([kept("a"), kept("b", { status: "downloading", bytesDone: 30, expectedSize: 100 })])).toBe(130);
    // Un Allégé complet : ses octets réels, jamais l'estimation.
    expect(keptBytes([kept("a", { variant: "light", bytesDone: 90, expectedSize: 100 })])).toBe(90);
  });

  it("retirer une playlist : ses copies que rien d'autre ne retient, sous la clé montrée ou celle de la copie, une fois", () => {
    const col = (key: string, trackKeys: string[]): KeptMusicCollection => ({ key, kind: "album", title: key, subtitle: null, coverItemId: null, trackKeys, updatedAt: 0 });
    const old = kept("ext:s:imp:r", { fileId: 7 });
    const other = kept("ext:s:imp:q", { fileId: 8 });
    // La rangée montre la clé d'aujourd'hui ; le magasin la mène à la copie d'hier (`keptRenames.ts`).
    const byKey = new Map([["ext:s:ytm:t:v", old], ["ext:s:imp:r", old], ["ext:s:ytm:t:w", other], ["ext:s:imp:q", other]]);
    const collections = [col("playlist:jf:p", ["ext:s:imp:r", "ext:s:imp:q"]), col("album:x", ["ext:s:imp:q"])];
    expect(ownCopies(["ext:s:ytm:t:v", "ext:s:imp:r", "ext:s:ytm:t:w"], byKey, collections, "playlist:jf:p").map((k) => k.fileId)).toEqual([7]);
  });

  it("la pastille de « Hors ligne » : seulement ce qui part de lui-même", () => {
    expect(keptTransfersRunning([])).toBe(false);
    expect(keptTransfersRunning([kept("a"), kept("b", { status: "error" }), kept("c", { status: "canceled" })])).toBe(false);
    expect(keptTransfersRunning([kept("a", { status: "paused", pausedByUser: true })])).toBe(false);
    expect(keptTransfersRunning([kept("a"), kept("b", { status: "queued" })])).toBe(true);
    expect(keptTransfersRunning([kept("a", { status: "downloading" })])).toBe(true);
    expect(keptTransfersRunning([kept("a", { status: "paused" })])).toBe(true);
  });
});
