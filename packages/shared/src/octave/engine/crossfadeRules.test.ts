import { describe, expect, it } from "vitest";
import { albumKeyOf } from "./engineShared";
import { continuesAlbum, fadeInGain, fadeOutGain, plannedCrossfadeMs, sanitizeCrossfadeMs } from "./crossfadeRules";
import type { MusicTrack } from "../../music";

function testTrack(key: string, album = "A"): MusicTrack {
  return {
    key, jellyfinId: key, external: null, title: key, artists: [{ name: "Artiste", mbid: null, jellyfinId: null }],
    album: { title: album, mbid: null, jellyfinId: album }, durationMs: 200_000, trackNumber: 1, discNumber: 1, year: null,
    artworkUrl: null, mbids: { recording: null, release: null, releaseGroup: null, artists: [] }, availability: "library",
    format: null, favorite: false,
  };
}

const numbered = (key: string, album: string, track: number | null, disc: number | null = 1) => ({ ...testTrack(key, album), trackNumber: track, discNumber: disc });
const pair = (current = numbered("a", "A", 3), next = numbered("b", "B", 1), currentMs: number | null = 200_000, nextMs: number | null = 180_000) => ({ current, next, currentMs, nextMs });

describe("transition douce — la règle", () => {
  it("borne le réglage : 0 coupé, sinon 2 à 12 s par pas d'une seconde", () => {
    expect([0, -5, Number.NaN, "x", null, 500, 1_400, 2_000, 6_400, 12_000, 40_000, "8000"].map(sanitizeCrossfadeMs))
      .toEqual([0, 0, 0, 0, 0, 2_000, 2_000, 2_000, 6_000, 12_000, 12_000, 8_000]);
  });

  it("garde à puissance constante sur tout le fondu, sans creux ni bosse", () => {
    for (let i = 0; i <= 100; i += 1) {
      const x = i / 100;
      expect(fadeOutGain(x) ** 2 + fadeInGain(x) ** 2).toBeCloseTo(1, 12);
    }
    expect([fadeOutGain(0), fadeInGain(0), fadeOutGain(1), fadeInGain(1)]).toEqual([1, 0, expect.closeTo(0, 12), 1]);
    expect(fadeOutGain(0.5)).toBeCloseTo(Math.SQRT1_2, 12);
  });

  it("ne fond jamais l'intérieur d'un album écouté dans l'ordre", () => {
    expect(continuesAlbum(numbered("a", "A", 3), numbered("b", "A", 4), albumKeyOf)).toBe(true);
    expect(continuesAlbum(numbered("a", "A", 12, 1), numbered("b", "A", 1, 2), albumKeyOf)).toBe(true);
    expect(continuesAlbum(numbered("a", "A", null), numbered("b", "A", null), albumKeyOf)).toBe(true);
    // Même album, mais pas la suite (aléatoire, répétition d'un titre) : un fondu.
    expect(continuesAlbum(numbered("a", "A", 3), numbered("b", "A", 7), albumKeyOf)).toBe(false);
    expect(continuesAlbum(numbered("a", "A", 3), numbered("a", "A", 3), albumKeyOf)).toBe(false);
    expect(continuesAlbum(numbered("a", "A", 3), numbered("b", "B", 4), albumKeyOf)).toBe(false);
    expect(plannedCrossfadeMs(6_000, pair(numbered("a", "A", 3), numbered("b", "A", 4)), albumKeyOf)).toBe(0);
  });

  it("plie la durée aux titres : un tiers du plus court au plus, rien sous une seconde", () => {
    expect(plannedCrossfadeMs(6_000, pair(), albumKeyOf)).toBe(6_000);
    expect(plannedCrossfadeMs(0, pair(), albumKeyOf)).toBe(0);
    expect(plannedCrossfadeMs(12_000, pair(undefined, undefined, 200_000, 24_000), albumKeyOf)).toBe(8_000);
    expect(plannedCrossfadeMs(6_000, pair(undefined, undefined, 2_500, 180_000), albumKeyOf)).toBe(0);
    expect(plannedCrossfadeMs(6_000, pair(undefined, undefined, null, 180_000), albumKeyOf)).toBe(0);
  });
});
