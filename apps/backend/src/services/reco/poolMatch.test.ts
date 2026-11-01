import { describe, expect, it } from "vitest";
import type { PoolEntry } from "./generationJob";
import { MATCH_CONFIDENCE_FLOOR, MATCH_TAIL, MATCH_TOP, assignMatches, matchCeilingOf } from "./poolMatch";

const entry = (key: string, relevance: number): PoolEntry => ({
  candidate: { key, mediaType: "movie", tmdbId: 1, title: key, year: 2020, facets: [], voteAverage: 7, voteCount: 500, popularity: 1, source: "library" },
  breakdown: { total: 1, similarity: relevance, relevance, quality: 0.8, freshness: 1, popularityPenalty: 0, topContributors: [] },
});

const ranked = () => Array.from({ length: 20 }, (_, i) => entry(`movie:${i}`, 0.8));

describe("correspondance bornée par la confiance du profil", () => {
  it("le plafond monte avec les signaux, du seuil du froid au plafond plein", () => {
    expect(matchCeilingOf(5)).toBeCloseTo(MATCH_CONFIDENCE_FLOOR);
    expect(matchCeilingOf(15)).toBeLessThan(85);
    expect(matchCeilingOf(30)).toBeGreaterThan(88);
    expect(matchCeilingOf(200)).toBeCloseTo(MATCH_TOP, 0);
    expect(matchCeilingOf(0)).toBeCloseTo(MATCH_CONFIDENCE_FLOOR);
  });

  it("un profil maigre ne s'annonce jamais au-delà de son plafond ; l'ordre reste celui du rang", () => {
    const thin = ranked();
    assignMatches(thin, 6);
    const matches = thin.map((e) => e.match!);
    expect(Math.max(...matches)).toBeLessThanOrEqual(Math.ceil(matchCeilingOf(6)));
    for (let i = 1; i < matches.length; i++) expect(matches[i]).toBeLessThanOrEqual(matches[i - 1]);
    expect(matches[matches.length - 1]).toBe(MATCH_TAIL);
  });

  it("sans confiance donnée (vieil appelant), l'échelle d'avant : 95 en tête", () => {
    const full = ranked();
    assignMatches(full);
    expect(full[0].match).toBe(MATCH_TOP);
  });
});
