import { describe, expect, it } from "vitest";
import type { TitleMeta } from "../tmdb/metaCache";
import type { Anchor } from "./anchors";
import { formatAversion, formatAversionOf } from "./aversion";
import { facetsFromTmdb } from "./facets";
import { animeFloorOf, lovedAuthorsOf, lovedPeopleOf, registerCount } from "./lovedTaste";
import { refusalShare, refusalTraitsOf } from "./scoring/tasteTerms";
import { FORMAT_LONG_RUNNING, isExplicitMeta, isLongRunningMeta } from "./universes";

const meta = (over: Partial<TitleMeta>): TitleMeta => ({
  mediaType: "tv", tmdbId: 1, title: "t", genres: [], keywords: [], directors: [], topCast: [], studios: [], networks: [],
  year: 2015, originalLanguage: "ja", originCountry: ["JP"], runtimeMinutes: 24, popularity: 1, voteAverage: 8, voteCount: 900,
  posterPath: null, backdropPath: null, providers: [], ...over,
});
const anchor = (key: string, kinds: Anchor["kinds"], weight = 1): Anchor => ({
  key, mediaType: "tv", tmdbId: 1, title: key, weight, consumption: weight > 0, hours: 10, lastAt: null, kinds,
});

describe("format : les feuilletons-fleuves", () => {
  it("cent épisodes et plus ; ni les années d'antenne seules, ni un film ; la facette ne rapproche rien", () => {
    expect(isLongRunningMeta(meta({ episodeCount: 291 }))).toBe(true);
    expect(isLongRunningMeta(meta({ episodeCount: 37 }))).toBe(false);
    // 81 épisodes sur douze ans d'antenne : pas un fleuve.
    expect(isLongRunningMeta(meta({ year: 2013, episodeCount: 81 }))).toBe(false);
    expect(isLongRunningMeta(meta({ mediaType: "movie", episodeCount: null }))).toBe(false);
    const facet = facetsFromTmdb(meta({ episodeCount: 1100 })).find((f) => f.key === FORMAT_LONG_RUNNING);
    expect(facet?.mult).toBe(0);
  });

  it("appris des REFUS seuls : quatre fleuves refusés contre deux adorés ; un refus isolé ne suffit pas", () => {
    const long = new Set(["r1", "r2", "r3", "r4", "l1", "l2"]);
    const facetsOf = (a: Anchor) => (long.has(a.key) ? [{ key: FORMAT_LONG_RUNNING }] : [{ key: "genre:16" }]);
    const refused = ["r1", "r2", "r3", "r4"].map((k) => anchor(k, ["dismissed"], -0.6));
    const loved = ["l1", "l2", "court"].map((k) => anchor(k, ["favorite"]));
    const aversion = formatAversion([...refused, ...loved], facetsOf);
    expect(aversion[FORMAT_LONG_RUNNING]).toBeCloseTo(4 / 7, 3);
    expect(formatAversionOf(["genre:16", FORMAT_LONG_RUNNING], aversion)).toBeCloseTo(4 / 7, 3);
    expect(formatAversionOf(["genre:16"], aversion)).toBe(0);
    expect(formatAversion([refused[0], ...loved], facetsOf)[FORMAT_LONG_RUNNING]).toBe(0);
    expect(formatAversion(loved, facetsOf)[FORMAT_LONG_RUNNING]).toBe(0);
  });
});

describe("personnes adorées : leur registre, jamais une voix", () => {
  const action = (id: number) => meta({ mediaType: "movie", tmdbId: id, genres: [{ id: 28, name: "Action" }, { id: 878, name: "SF" }], topCast: [{ id: 9001, name: "Acteur d'action" }] });
  const cartoon = (id: number) => meta({ mediaType: "movie", tmdbId: id, genres: [{ id: 16, name: "Animation" }, { id: 10751, name: "Family" }], topCast: [{ id: 9002, name: "Voix d'animation" }] });
  const metas: Record<string, TitleMeta> = { a1: action(1), a2: action(2), a3: action(3), d1: cartoon(4), d2: cartoon(5), d3: cartoon(6) };
  const anchors = Object.keys(metas).map((k) => anchor(k, ["favorite"]));
  const people = lovedPeopleOf(anchors, (a) => metas[a.key]);

  it("une voix d'animation ne fait pas aimer l'acteur ; trois films d'action disent l'action, pas le drame romantique", () => {
    expect(people.map((p) => p.name)).toEqual(["Acteur d'action"]);
    const actor = people[0];
    expect(registerCount(actor, ["actor:9001", "genre:28"])).toBe(3);
    expect(registerCount(actor, ["actor:9001", "genre:18", "genre:10749"])).toBe(0);
    // Sa voix dans un film d'animation d'action ne compte pas non plus.
    expect(registerCount(actor, ["actor:9001", "genre:28", "genre:16"])).toBe(0);
  });

  it("les auteurs de ce qu'il adore, dès un titre, les séries d'abord", () => {
    const fargo = meta({ tmdbId: 60622, directors: [{ id: 1, name: "Créateur A" }, { id: 2, name: "Créatrice B" }] });
    const film = meta({ mediaType: "movie", tmdbId: 9, directors: [{ id: 3, name: "Réalisatrice" }] });
    const authors = lovedAuthorsOf([anchor("film", ["favorite"]), anchor("fargo", ["favorite"])], (a) => (a.key === "fargo" ? fargo : film));
    expect(authors.map((a) => a.personId)).toEqual([1, 2, 3]);
  });
});

describe("contenu pour adultes", () => {
  it("High School DxD et Chained Soldier (ecchi sur TMDB) ne sont pas du X : rien ne les filtre", () => {
    const dxd = ["angel", "harem", "romance", "sexual humor", "ecchi", "anime", "based on light novel"];
    const chained = ["magic", "harem", "romance", "slave", "demon", "ecchi", "shounen", "anime"];
    for (const names of [dxd, chained]) {
      expect(isExplicitMeta({ keywords: names.map((name, id) => ({ id, name })), adult: false })).toBe(false);
    }
  });
});

describe("un refus pèse par ce qui l'explique", () => {
  const oldLong = refusalTraitsOf(["genre:16", "decade:2000", FORMAT_LONG_RUNNING]);
  const sameEraLong = refusalTraitsOf(["genre:16", "decade:2010", FORMAT_LONG_RUNNING]);

  it("un fleuve d'une autre époque ne condamne pas un shōnen récent et court", () => {
    const recentShort = refusalTraitsOf(["genre:16", "decade:2020"]);
    expect(refusalShare(oldLong, recentShort)).toBeCloseTo(0.25, 5);
    expect(refusalShare(sameEraLong, recentShort)).toBeCloseTo(0.375, 5);
  });

  it("un fleuve de la même époque compte entier ; une saga refusée aussi", () => {
    expect(refusalShare(sameEraLong, refusalTraitsOf(["genre:16", "decade:2010", FORMAT_LONG_RUNNING]))).toBe(1);
    const sagaFilm = refusalTraitsOf(["decade:2000", "collection:263"]);
    expect(refusalShare(sagaFilm, refusalTraitsOf(["decade:2010", "collection:263"]))).toBe(1);
  });
});

describe("époque des animés", () => {
  it("suit la distribution de ce qu'il regarde et adore, pas son plus ancien titre", () => {
    const years = [2002, 2013, 2016, 2016, 2019, 2019, 2020, 2022, 2023, 2025, 2025, 2025, 2023, 2023];
    const metas = new Map(years.map((year, i) => [`a${i}`, meta({ tmdbId: i, year, voteCount: 2000 })]));
    const anchors = [...metas.keys()].map((k) => anchor(k, ["favorite"]));
    const floor = animeFloorOf(anchors, (a) => metas.get(a.key), () => true);
    expect(floor?.minYear).toBe(2016);
  });
});
