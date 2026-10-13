import { describe, expect, it } from "vitest";
import { buildCalibration } from "./calibration";
import type { PoolPayload } from "./generationJob";
import { isLoved, lovedPeopleOf, qualityBarOf } from "./lovedTaste";
import { GLOBAL_RELEVANCE_FLOOR, gateGlobalRow } from "./pageRows";
import type { Candidate } from "./scoring/strategy";
import { TasteIndex } from "./scoring/tasteIndex";
import { TasteScoringStrategy } from "./scoring/tasteStrategy";
import type { Anchor } from "./anchors";
import type { TitleMeta } from "../tmdb/metaCache";

/**
 * Un candidat de VIGIE (catalogue Jellyseerr, prod seulement) suit le même
 * chemin que les autres : calibration du compte, aversion, barre de qualité,
 * puis la porte des rangées globales. Une série de franchise face à un compte
 * qui aime les séries à retournements et les animés : elle ne passe nulle part.
 */
const facets = (keys: string[]) => keys.map((key) => ({ key, mult: 1 }));
const candidate = (key: string, source: Candidate["source"], keys: string[], votes: number, year: number): Candidate => ({
  key, mediaType: "tv", tmdbId: Number(key.split(":")[1]), title: key, year, facets: facets(keys),
  voteAverage: 8.4, voteCount: votes, popularity: 50, source,
});

describe("un candidat de Vigie passe par le goût du compte", () => {
  const index = new TasteIndex(() => 2);
  index.add({ key: "tv:1920", title: "Twin Peaks", weight: 2, mediaType: "tv", liked: true, loved: true }, facets(["genre:9648", "kw:time-travel", "kw:twist", "lang:de"]));
  index.add({ key: "tv:30991", title: "Cowboy Bebop", weight: 2, mediaType: "tv", liked: true, loved: true }, facets(["universe:anime", "genre:16", "lang:ja", "kw:curse"]));
  index.add({ key: "tv:1438", title: "The Wire", weight: 2, mediaType: "tv", liked: true, loved: true }, facets(["genre:80", "kw:hacker", "kw:twist"]));
  const strategy = new TasteScoringStrategy({
    index, idfFor: () => 2, nowYear: 2026, recencyAffinity: 0.3, qualityBar: 7.3,
    calibration: buildCalibration([2017, 2020, 2015, 2019].map((year) => ({ votes: 3000, year, weight: 1 }))),
  });
  strategy.setAversion({ anime: 0, kidsAnimation: 0.6, franchise: 0.2 });
  const franchiseSeries = candidate("tv:900001", "vigie", ["genre:10765", "genre:10759", "network:2739", "studio:1", "kw:space-western", "universe:franchise"], 10_000, 2019);
  const seinen = candidate("tv:240411", "tmdb_rec", ["universe:anime", "genre:16", "lang:ja", "kw:curse", "kw:twist"], 2_000, 2024);
  const profile = { facets: { "kw:twist": 1, "universe:anime": 1 }, signalCount: 40 };
  strategy.calibrate(profile, [franchiseSeries, seinen]);

  it("calibration, aversion et proximité s'appliquent à Vigie comme aux autres sources", () => {
    const m = strategy.score(profile, franchiseSeries);
    const s = strategy.score(profile, seinen);
    expect(m.calibration).toBeDefined();
    expect(m.aversion).toBeCloseTo(0.2);
    expect(m.total).toBeLessThan(s.total);
    expect(m.relevance ?? 0).toBeLessThan(GLOBAL_RELEVANCE_FLOOR);
  });

  it("la porte des rangées globales l'écarte des tendances", () => {
    const entry = (c: Candidate) => ({ candidate: c, breakdown: strategy.score(profile, c) });
    const pool = { generatedAt: "x", strategyId: "t", poolSize: 2, seeds: [], labels: {}, entries: [entry(seinen), entry(franchiseSeries)] } as PoolPayload;
    expect(gateGlobalRow("trending", [{ key: franchiseSeries.key }], pool)).toEqual([]);
  });
});

describe("ce que le compte adore", () => {
  const anchor = (key: string, kinds: Anchor["kinds"]): Anchor => ({ key, mediaType: "movie", tmdbId: 1, title: key, weight: 1, consumption: true, hours: 2, lastAt: null, kinds });
  const meta = (cast: number[], rating: number, votes: number): TitleMeta => ({
    mediaType: "movie", tmdbId: 1, title: "t", genres: [], keywords: [], directors: [{ id: 9003, name: "Réalisatrice A" }],
    topCast: cast.map((id) => ({ id, name: `p${id}` })), studios: [], networks: [], year: 2015, originalLanguage: "en",
    originCountry: [], runtimeMinutes: 120, popularity: 1, voteAverage: rating, voteCount: votes, posterPath: null, backdropPath: null, providers: [],
  });

  it("un acteur dans trois titres adorés, un réalisateur dans deux ; la barre suit ce qu'il adore", () => {
    const anchors = ["a", "b", "c", "d", "e"].map((k) => anchor(k, ["favorite", "completed"]));
    const metas: Record<string, TitleMeta> = { a: meta([1, 2], 8.6, 9000), b: meta([1], 8.4, 9000), c: meta([1, 3], 8.2, 9000), d: meta([3], 8.0, 9000), e: meta([], 7.9, 9000) };
    const people = lovedPeopleOf(anchors, (x) => metas[x.key]);
    expect(people.map((p) => [p.key, p.role, p.count])).toEqual([["director:9003", "director", 5], ["actor:1", "actor", 3]]);
    expect(qualityBarOf(anchors, (x) => metas[x.key])).toBeGreaterThan(7.4);
    expect(isLoved(anchor("x", ["completed"]))).toBe(false);
  });
});
