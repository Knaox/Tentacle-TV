import { describe, expect, it } from "vitest";
import { BAYES_C, bayesianRating, freshnessScore, popularityPenalty } from "./bayes";
import { FacetScoringStrategy } from "./facetStrategy";
import type { Candidate, TasteVector } from "./strategy";

describe("note bayésienne", () => {
  it("un 10/10 par 4 votants reste collé à la moyenne du corpus", () => {
    const wr = bayesianRating(10, 4);
    expect(wr).toBeLessThan(BAYES_C + 0.1);
  });

  it("beaucoup de votes → la note réelle l'emporte", () => {
    expect(bayesianRating(8.5, 20000)).toBeGreaterThan(8.4);
  });

  it("sans votes : exactement la moyenne du corpus", () => {
    expect(bayesianRating(null, null)).toBe(BAYES_C);
  });
});

describe("pénalité de popularité", () => {
  it("nulle sous le pivot, croissante et plafonnée au-delà", () => {
    expect(popularityPenalty(10)).toBe(0);
    expect(popularityPenalty(50)).toBe(0);
    const p100 = popularityPenalty(100);
    const p1000 = popularityPenalty(1000);
    expect(p100).toBeGreaterThan(0);
    expect(p1000).toBeGreaterThan(p100);
    expect(popularityPenalty(1e9)).toBeLessThanOrEqual(0.3);
  });
});

describe("bonus de récence", () => {
  it("1 l'année de sortie, 0 à trois ans, linéaire entre", () => {
    expect(freshnessScore(2026, 2026)).toBe(1);
    expect(freshnessScore(2024, 2026)).toBeCloseTo(1 / 3, 10);
    expect(freshnessScore(2020, 2026)).toBe(0);
    expect(freshnessScore(null, 2026)).toBe(0);
  });
});

function candidate(over: Partial<Candidate>): Candidate {
  return {
    key: "movie:1",
    mediaType: "movie",
    tmdbId: 1,
    title: "T",
    year: 2020,
    facets: [],
    voteAverage: 7,
    voteCount: 1000,
    popularity: 20,
    source: "tmdb_discover",
    ...over,
  };
}

describe("FacetScoringStrategy (cosinus IDF)", () => {
  const idf = (key: string) => (key.startsWith("kw:") ? 4 : 1);
  const strategy = new FacetScoringStrategy(idf, 2026);
  const profile: TasteVector = {
    signalCount: 20,
    facets: { "kw:cyberpunk": 8, "genre:878": 3, "director:42": 5, "genre:35": -4 },
  };

  it("un candidat aligné sur le profil bat un candidat étranger", () => {
    const match = strategy.score(profile, candidate({
      key: "movie:10",
      facets: [
        { key: "kw:cyberpunk", mult: 1 },
        { key: "genre:878", mult: 1 },
        { key: "director:42", mult: 2 },
      ],
    }));
    const stranger = strategy.score(profile, candidate({
      key: "movie:11",
      facets: [{ key: "genre:99", mult: 1 }, { key: "kw:autre", mult: 1 }],
    }));
    expect(match.similarity).toBeGreaterThan(stranger.similarity);
    expect(match.total).toBeGreaterThan(stranger.total);
  });

  it("une facette rejetée (poids négatif) tire la similarité sous le neutre", () => {
    const disliked = strategy.score(profile, candidate({
      key: "movie:12",
      facets: [{ key: "genre:35", mult: 1 }],
    }));
    expect(disliked.similarity).toBeLessThan(0.5);
  });

  it("le détail expose les facettes qui ont porté le score", () => {
    const b = strategy.score(profile, candidate({
      facets: [{ key: "kw:cyberpunk", mult: 1 }, { key: "genre:878", mult: 1 }],
    }));
    expect(b.topContributors[0]?.key).toBe("kw:cyberpunk");
    expect(b.topContributors[0]!.contribution).toBeGreaterThan(0);
  });

  it("classement REPRODUCTIBLE sur jeu fixe", () => {
    const pool = [
      candidate({ key: "movie:a", facets: [{ key: "kw:cyberpunk", mult: 1 }], popularity: 20 }),
      candidate({ key: "movie:b", facets: [{ key: "genre:878", mult: 1 }], popularity: 20 }),
      candidate({ key: "movie:c", facets: [{ key: "genre:35", mult: 1 }], popularity: 20 }),
      candidate({ key: "movie:d", facets: [{ key: "genre:99", mult: 1 }], popularity: 5000 }),
    ];
    const rank = () =>
      pool
        .map((c) => ({ key: c.key, total: strategy.score(profile, c).total }))
        .sort((x, y) => y.total - x.total || (x.key < y.key ? -1 : 1))
        .map((x) => x.key);
    expect(rank()).toEqual(rank());
    // a (keyword fort) > b (genre aimé) > c (genre rejeté) > d (inconnu ET
    // ultra-populaire : la pénalité plafonnée à 0,3 l'enfonce sous le rejet).
    expect(rank()).toEqual(["movie:a", "movie:b", "movie:c", "movie:d"]);
  });
});
