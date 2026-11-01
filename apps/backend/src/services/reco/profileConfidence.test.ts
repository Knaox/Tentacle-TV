import { describe, expect, it } from "vitest";
import type { Anchor } from "./anchorTypes";
import { engagementSignalCount } from "./profileConfidence";

/** Les seuils du service (serveContext) : < 5 froid, < 15 tiède. */
const COLD = 5;
const WARMING = 15;

const anchor = (key: string, over: Partial<Anchor>): Anchor => ({
  key, mediaType: "tv", tmdbId: 1, title: key, weight: 1, consumption: true, hours: 0, lastAt: null, kinds: ["series"], ...over,
});

describe("confiance du profil", () => {
  it("vingt heures d'une seule série en binge : jamais froid", () => {
    expect(engagementSignalCount([anchor("tv:1", { hours: 20 })])).toBeGreaterThanOrEqual(COLD);
  });

  it("cent quarante heures sur une dizaine de titres : prêt", () => {
    const anchors = Array.from({ length: 11 }, (_, i) => anchor(`tv:${i}`, { hours: 13 }));
    expect(engagementSignalCount(anchors)).toBeGreaterThanOrEqual(WARMING);
  });

  it("un compte vierge, ou deux films vus : froid", () => {
    expect(engagementSignalCount([])).toBe(0);
    const films = [1, 2].map((i) => anchor(`movie:${i}`, { mediaType: "movie", hours: 2, kinds: ["completed"] }));
    expect(engagementSignalCount(films)).toBeLessThan(COLD);
  });

  it("un titre vu, noté et en favori compte toujours trois signaux", () => {
    expect(engagementSignalCount([anchor("movie:1", { hours: 0, kinds: ["completed", "rating", "favorite"] })])).toBe(3);
  });

  it("les heures d'un abandon ou d'un refus ne comptent pas", () => {
    expect(engagementSignalCount([anchor("tv:1", { hours: 30, weight: -0.6, kinds: ["series", "dismissed"] })])).toBe(2);
  });
});
