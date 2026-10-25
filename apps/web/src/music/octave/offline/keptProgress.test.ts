import { describe, expect, it } from "vitest";
import type { KeptMusicTrack } from "@tentacle-tv/offline-core";
import { collectionSummary, keptBytes, trackPhase } from "./keptProgress";

function kept(key: string, partial: Partial<KeptMusicTrack> = {}): KeptMusicTrack {
  return {
    fileId: 1, itemId: key, trackKey: key, origin: "library", variant: "original", status: "complete", errorCode: null,
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

  it("la place occupée", () => {
    expect(keptBytes([kept("a"), kept("b", { status: "downloading", bytesDone: 30, expectedSize: 100 })])).toBe(130);
    // Un Allégé complet : ses octets réels, jamais l'estimation.
    expect(keptBytes([kept("a", { variant: "light", bytesDone: 90, expectedSize: 100 })])).toBe(90);
  });
});
