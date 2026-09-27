import { describe, expect, it } from "vitest";
import type { FacetEntry } from "../facets";
import type { Candidate, TasteVector } from "./strategy";
import { TasteIndex, normalizedVector } from "./tasteIndex";
import { TasteScoringStrategy, familiarityOf, qualityOf, quantile } from "./tasteStrategy";

const idf = () => 1;
const f = (...keys: string[]): FacetEntry[] => keys.map((key) => ({ key, mult: 1 }));

function candidate(key: string, facets: FacetEntry[], over: Partial<Candidate> = {}): Candidate {
  return {
    key,
    mediaType: "movie",
    tmdbId: Number(key.split(":")[1]),
    title: key,
    year: 2015,
    facets,
    voteAverage: 7.5,
    voteCount: 5000,
    popularity: 20,
    source: "tmdb_rec",
    ...over,
  };
}

const PROFILE: TasteVector = { facets: { "genre:18": 1, "kw:1": 1 }, signalCount: 10 };

function strategyWith(anchors: Array<{ key: string; weight: number; facets: FacetEntry[] }>, recency = 0) {
  const index = new TasteIndex(idf);
  for (const a of anchors) index.add({ key: a.key, title: a.key, weight: a.weight, mediaType: "movie" }, a.facets);
  return new TasteScoringStrategy({ index, idfFor: idf, nowYear: 2026, recencyAffinity: recency });
}

describe("index des ancres", () => {
  it("vecteur normalisé : norme 1, facettes répétées cumulées", () => {
    const v = normalizedVector([...f("a", "b"), { key: "a", mult: 1 }], idf);
    const norm = Math.sqrt([...v.values()].reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 10);
    expect(v.get("a")!).toBeGreaterThan(v.get("b")!);
  });

  it("seules les ancres qui partagent une facette sont comparées", () => {
    const index = new TasteIndex(idf);
    index.add({ key: "movie:1", title: "A", weight: 1, mediaType: "movie" }, f("x", "y"));
    index.add({ key: "movie:2", title: "B", weight: 1, mediaType: "movie" }, f("z"));
    const sims = index.similarities(f("x", "y"));
    expect(sims.get(0)).toBeCloseTo(1, 10);
    expect(sims.has(1)).toBe(false);
  });
});

describe("classement à ancres", () => {
  const anchors = [
    { key: "movie:10", weight: 1.5, facets: f("genre:18", "kw:1", "director:5") },
    { key: "movie:11", weight: -1, facets: f("genre:27", "kw:9") },
  ];

  it("proche d'un titre aimé passe devant proche de rien — l'écart n'est plus écrasé", () => {
    const s = strategyWith(anchors);
    const close = candidate("movie:20", f("genre:18", "kw:1", "director:5", "kw:2"));
    const far = candidate("movie:21", f("genre:35", "kw:3"));
    s.calibrate(PROFILE, [close, far]);
    const a = s.score(PROFILE, close);
    const b = s.score(PROFILE, far);
    expect(a.total - b.total).toBeGreaterThan(0.2);
    expect(a.topAnchors?.[0]?.key).toBe("movie:10");
  });

  it("ressembler à un titre refusé coûte", () => {
    const s = strategyWith(anchors);
    const neutral = candidate("movie:30", f("genre:35"));
    const disliked = candidate("movie:31", f("genre:35", "genre:27", "kw:9"));
    s.calibrate(PROFILE, [neutral, disliked]);
    expect(s.score(PROFILE, disliked).negative).toBeGreaterThan(0);
    expect(s.score(PROFILE, disliked).total).toBeLessThan(s.score(PROFILE, neutral).total);
  });

  it("un titre ne se recommande pas lui-même (Ma liste)", () => {
    const s = strategyWith([{ key: "movie:40", weight: 0.3, facets: f("genre:18") }]);
    const self = candidate("movie:40", f("genre:18"));
    s.calibrate(PROFILE, [self]);
    expect(s.score(PROFILE, self).relevance).toBe(0);
  });

  it("le soutien des graines et la récence (selon l'appétit du compte) ajoutent", () => {
    const base = candidate("movie:50", f("genre:35"));
    const supported = { ...base, key: "movie:51", seedSupport: 3 };
    const recent = { ...base, key: "movie:52", year: 2026 };
    const s = strategyWith(anchors, 0);
    s.calibrate(PROFILE, [base, supported, recent]);
    expect(s.score(PROFILE, supported).total).toBeGreaterThan(s.score(PROFILE, base).total);
    // Sans appétit pour les nouveautés, l'année ne change rien.
    expect(s.score(PROFILE, recent).total).toBeCloseTo(s.score(PROFILE, base).total, 10);
    const eager = strategyWith(anchors, 1);
    eager.calibrate(PROFILE, [base, recent]);
    expect(eager.score(PROFILE, recent).total).toBeGreaterThan(eager.score(PROFILE, base).total);
  });

  it("qualité, notoriété et quantile : bornés et monotones", () => {
    expect(qualityOf(9, 30_000)).toBe(1);
    expect(qualityOf(3, 30_000)).toBe(0);
    expect(familiarityOf(null)).toBe(0);
    expect(familiarityOf(50_000)).toBe(1);
    expect(familiarityOf(1000)).toBeGreaterThan(familiarityOf(100));
    expect(quantile([], 0.9)).toBe(0);
    expect(quantile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(10);
  });
});
