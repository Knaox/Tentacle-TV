import { describe, expect, it } from "vitest";
import type { PoolEntry } from "./generationJob";
import { hasEvidence, isRealKin } from "./rowFilters";

const entry = (over: { facets?: string[]; anchors?: Array<{ key: string; similarity?: number; liked?: boolean }>; votes?: number | null; rating?: number | null; library?: boolean }): PoolEntry => ({
  candidate: {
    key: "movie:1", mediaType: "movie", tmdbId: 1, title: "t", year: 2020,
    facets: (over.facets ?? ["genre:878", "kw:4565"]).map((key) => ({ key, mult: 1 })),
    voteAverage: over.rating === undefined ? 7.5 : over.rating, voteCount: over.votes === undefined ? 900 : over.votes,
    popularity: 1, source: "tmdb_rec", jellyfinItemId: over.library ? "jf" : null,
  },
  breakdown: {
    total: 1, similarity: 0.5, quality: 0.8, freshness: 0.5, popularityPenalty: 0, topContributors: [], relevance: 0.6,
    topAnchors: (over.anchors ?? []).map((a) => ({ title: a.key, contribution: 1, ...a })),
  },
} as PoolEntry);

describe("vrai parent d'une graine", () => {
  const seed = { key: "movie:157336", universes: [], animated: false };

  it("la raison du titre doit CITER la graine (deux premiers titres aimés), par une vraie parenté de contenu", () => {
    expect(isRealKin(entry({ anchors: [{ key: "movie:157336", similarity: 0.4 }] }), seed)).toBe(true);
    expect(isRealKin(entry({ anchors: [{ key: "movie:2" }, { key: "movie:3" }, { key: "movie:157336", similarity: 0.4 }] }), seed)).toBe(false);
    // Une ancre refusée ne compte pas dans la citation.
    expect(isRealKin(entry({ anchors: [{ key: "movie:9", liked: false }, { key: "movie:2" }, { key: "movie:157336", similarity: 0.4 }] }), seed)).toBe(true);
    expect(isRealKin(entry({ anchors: [{ key: "movie:157336", similarity: 0.15 }] }), seed)).toBe(false);
    // Sans fiche (aucun mot-clé), la parenté ne se prouve pas.
    expect(isRealKin(entry({ facets: ["genre:878"], anchors: [{ key: "movie:157336", similarity: 0.4 }] }), seed)).toBe(false);
  });

  it("du même monde : pas d'animation derrière un film en prises de vues réelles", () => {
    const wallE = entry({ facets: ["genre:16", "universe:kids-animation", "kw:4565"], anchors: [{ key: "movie:157336", similarity: 0.3 }] });
    expect(isRealKin(wallE, seed)).toBe(false);
  });
});

describe("qualité d'une rangée", () => {
  it("jamais un titre sans note ou à moins de cinquante votes ; un titre de la bibliothèque sans votes connus passe", () => {
    expect(hasEvidence(entry({ votes: 900 }))).toBe(true);
    expect(hasEvidence(entry({ votes: 12 }))).toBe(false);
    expect(hasEvidence(entry({ rating: 0 }))).toBe(false);
    expect(hasEvidence(entry({ votes: null }))).toBe(false);
    expect(hasEvidence(entry({ votes: null, library: true }))).toBe(true);
  });
});
