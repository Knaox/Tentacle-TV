import { describe, expect, it } from "vitest";
import type { Anchor } from "./anchors";
import type { FacetEntry } from "./facets";
import { pickSeeds } from "./seedPicker";
import { buildCentroid, consumptionShares, recencyAffinity, universeShareOf } from "./tasteModel";

const NOW = Date.parse("2026-09-27T12:00:00Z");

function anchor(key: string, over: Partial<Anchor> = {}): Anchor {
  const [mediaType, id] = key.split(":");
  return {
    key,
    mediaType: mediaType as "movie" | "tv",
    tmdbId: Number(id),
    title: key,
    weight: 1,
    consumption: true,
    hours: mediaType === "movie" ? 2 : 20,
    lastAt: null,
    kinds: ["completed"],
    ...over,
  };
}

const facetsBy = (map: Record<string, string[]>) => (a: Anchor): FacetEntry[] =>
  (map[a.key] ?? []).map((key) => ({ key, mult: 1 }));

describe("modèle de goût", () => {
  it("les parts suivent le TEMPS regardé, avec un plancher par type", () => {
    const shares = consumptionShares([anchor("movie:1"), anchor("tv:2", { hours: 70 })]);
    expect(shares.tv).toBeGreaterThan(0.75);
    expect(shares.movie).toBeCloseTo(1 - shares.tv, 10);
    const onlyMovies = consumptionShares([anchor("movie:1")]);
    expect(onlyMovies.tv).toBeCloseTo(0.2, 10);
  });

  it("profil moyen équilibré : cent films n'étouffent pas les séries regardées", () => {
    const movies = Array.from({ length: 100 }, (_, i) => anchor(`movie:${i + 1}`));
    // 100 films (200 h) contre une série regardée 400 h.
    const anchors = [...movies, anchor("tv:500", { hours: 400 })];
    const facets = facetsBy(Object.fromEntries([
      ...movies.map((m) => [m.key, ["genre:28"]]),
      ["tv:500", ["genre:18"]],
    ]));
    const centroid = buildCentroid(anchors, facets, () => 1, consumptionShares(anchors));
    // Sans équilibrage, le drame pèserait 1/100 de l'action.
    expect(centroid["genre:18"]).toBeGreaterThan(centroid["genre:28"]);
  });

  it("appétit pour les nouveautés et part d'univers", () => {
    const anchors = [anchor("movie:1"), anchor("movie:2"), anchor("tv:3", { hours: 6 })];
    const years: Record<string, number> = { "movie:1": 2026, "movie:2": 1999, "tv:3": 2025 };
    expect(recencyAffinity(anchors, (a) => years[a.key] ?? null, 2026)).toBeCloseTo(2 / 3, 10);
    expect(universeShareOf(anchors, (a) => a.key === "tv:3")).toBeCloseTo(6 / 10, 10);
  });
});

describe("graines", () => {
  it("au prorata du temps par type, sans doublon de franchise, jamais « Ma liste » seule", () => {
    const anchors = [
      anchor("movie:1", { weight: 2 }),
      anchor("movie:2", { weight: 1.9 }), // même franchise que movie:1
      anchor("movie:3", { weight: 1.2 }),
      anchor("movie:4", { weight: 1.5, kinds: ["watchlist"] }),
      anchor("tv:5", { weight: 0.9, hours: 80 }),
      anchor("tv:6", { weight: 0.8, hours: 40 }),
    ];
    const facets = facetsBy({
      "movie:1": ["genre:28", "kw:1", "director:9"],
      "movie:2": ["genre:28", "kw:1", "director:9"],
      "movie:3": ["genre:18"],
      "movie:4": ["genre:35"],
      "tv:5": ["genre:10765"],
      "tv:6": ["genre:80"],
    });
    const seeds = pickSeeds(anchors, facets, { shares: { movie: 0.25, tv: 0.75 }, now: NOW, max: 4 });
    const keys = seeds.map((s) => `${s.mediaType}:${s.tmdbId}`);
    expect(keys).toContain("tv:5");
    expect(keys).toContain("tv:6");
    expect(keys).toContain("movie:1");
    expect(keys).not.toContain("movie:2");
    expect(keys).not.toContain("movie:4");
  });

  it("à force égale, le goût récent passe devant", () => {
    const anchors = [
      anchor("movie:1", { weight: 1 }),
      anchor("movie:2", { weight: 1, lastAt: new Date(NOW - 5 * 86_400_000).toISOString() }),
    ];
    const seeds = pickSeeds(anchors, () => [], { shares: { movie: 1, tv: 0 }, now: NOW, max: 1 });
    expect(seeds[0].tmdbId).toBe(2);
  });
});
