import { describe, expect, it } from "vitest";
import { applyAudioVerdict, type AudioVerdict } from "./audioVerdict";
import type { BoundsByType } from "./segmentChapters";

const RUNTIME_MS = 1_420_000;

const verdict = (over: Partial<AudioVerdict> = {}): AudioVerdict => ({
  intro: { startMs: 140_000, endMs: 226_000, source: "audio" },
  outro: { startMs: 1_337_000, endMs: RUNTIME_MS, source: "audio" },
  confirmedBy: 2,
  neighbourKey: "ep-1,ep-3",
  ...over,
});

describe("applyAudioVerdict", () => {
  it("comble l'intro et le générique absents, source audio", () => {
    const bounds: BoundsByType = new Map();
    applyAudioVerdict(bounds, verdict(), RUNTIME_MS);
    expect(bounds.get("Intro")).toEqual([{ startMs: 140_000, endMs: 226_000, source: "audio" }]);
    expect(bounds.get("Outro")).toEqual([{ startMs: 1_337_000, endMs: RUNTIME_MS, source: "audio" }]);
  });

  it("ne touche jamais à ce qu'un fournisseur a dit", () => {
    const bounds: BoundsByType = new Map([
      ["Intro", [{ startMs: 0, endMs: 90_000, source: "jellyfin" as const }]],
      ["Outro", [{ startMs: 1_300_000, endMs: 1_380_000, source: "chapters" as const }]],
    ]);
    applyAudioVerdict(bounds, verdict(), RUNTIME_MS);
    expect(bounds.get("Intro")).toEqual([{ startMs: 0, endMs: 90_000, source: "jellyfin" }]);
    expect(bounds.get("Outro")).toEqual([{ startMs: 1_300_000, endMs: 1_380_000, source: "chapters" }]);
  });

  it("un verdict nul, ou vide, ne pose rien", () => {
    const bounds: BoundsByType = new Map();
    applyAudioVerdict(bounds, null, RUNTIME_MS);
    applyAudioVerdict(bounds, verdict({ intro: null, outro: null, reason: "rien de partagé" }), RUNTIME_MS);
    expect(bounds.size).toBe(0);
  });

  it("sans durée connue, l'intro passe mais aucun générique n'est posé", () => {
    const bounds: BoundsByType = new Map();
    applyAudioVerdict(bounds, verdict(), 0);
    expect(bounds.has("Intro")).toBe(true);
    expect(bounds.has("Outro")).toBe(false);
  });

  it("force la source à audio, quoi que dise le verdict", () => {
    const bounds: BoundsByType = new Map();
    applyAudioVerdict(
      bounds,
      verdict({ intro: { startMs: 10_000, endMs: 100_000, source: "jellyfin" }, outro: null }),
      RUNTIME_MS,
    );
    expect(bounds.get("Intro")?.[0].source).toBe("audio");
  });
});
