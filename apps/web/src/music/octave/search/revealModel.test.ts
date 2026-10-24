import { describe, expect, it } from "vitest";
import { externalReadiness, REVEAL_CAP_MS, revealDecision } from "./revealModel";

const ready = { libraryReady: true, externalReady: true, libraryArtReady: true, externalArtReady: true };

describe("révélation des résultats (Octave)", () => {
  it("tout prêt : tout part ensemble", () => {
    expect(revealDecision({ elapsedMs: 120, ...ready })).toEqual({ library: true, external: true });
  });

  it("l'extension pas encore sûre : rien ne part avant le plafond, puis la bibliothèque seule", () => {
    expect(revealDecision({ elapsedMs: 300, ...ready, externalReady: false })).toEqual({ library: false, external: false });
    expect(revealDecision({ elapsedMs: REVEAL_CAP_MS, ...ready, externalReady: false })).toEqual({ library: true, external: false });
  });

  it("les pochettes de tête retiennent la révélation (dans leur budget)", () => {
    expect(revealDecision({ elapsedMs: 200, ...ready, libraryArtReady: false })).toEqual({ library: false, external: false });
    expect(revealDecision({ elapsedMs: 200, ...ready, externalArtReady: false })).toEqual({ library: false, external: false });
  });

  it("jamais l'extension devant la bibliothèque", () => {
    expect(revealDecision({ elapsedMs: 5_000, ...ready, libraryReady: false })).toEqual({ library: false, external: false });
  });

  it("une page provisoire n'est jamais montrable ; la sûre l'est quand la bibliothèque a dit ce qu'elle a", () => {
    const base = { available: true, complete: false, pending: false, settled: true };
    expect(externalReadiness({ ...base, provisional: true })).toBe(false);
    expect(externalReadiness({ ...base, provisional: false })).toBe(true);
    expect(externalReadiness({ ...base, provisional: false, settled: false })).toBe(false);
    expect(externalReadiness({ ...base, provisional: true, complete: true })).toBe(true);
    expect(externalReadiness({ available: false, complete: false, provisional: false, pending: true, settled: false })).toBe(true);
  });
});
