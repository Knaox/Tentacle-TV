import { describe, expect, it } from "vitest";
import type { Anchor } from "./anchors";
import type { TitleMeta } from "../tmdb/metaCache";
import { cappedReleaseParams } from "./candidates/released";
import { isAdultPerson, popularSuggestions, recurringActors } from "./peopleSuggestions";

const meta = (title: string, cast: Array<[number, string]>, animation = false): TitleMeta => ({
  mediaType: "movie", tmdbId: title.length, title, genres: animation ? [{ id: 16, name: "Animation" }] : [{ id: 18, name: "Drama" }],
  keywords: [], directors: [], topCast: cast.map(([id, name]) => ({ id, name, profilePath: `/${id}.jpg` })), studios: [], networks: [],
  year: 2016, originalLanguage: "en", originCountry: ["US"], runtimeMinutes: 120, popularity: 10, voteAverage: 7.5, voteCount: 9000,
  posterPath: null, backdropPath: null, providers: [],
});
const anchor = (key: string): Anchor => ({ key, mediaType: "movie", tmdbId: 1, title: key, weight: 1, consumption: true, hours: 2, lastAt: null, kinds: ["completed"] });

describe("suggestions de personnes", () => {
  it("jamais une personne pour adultes, ni connue pour un titre pour adultes", () => {
    expect(isAdultPerson({ adult: true })).toBe(true);
    expect(isAdultPerson({ adult: false, known_for: [{ title: "Sex and Zen III", adult: true }] })).toBe(true);
    expect(isAdultPerson({ adult: false, known_for: [{ title: "Film 4" }] })).toBe(false);
    const popular = popularSuggestions([
      { id: 1, name: "Yoon Yool", adult: true, profile_path: "/a.jpg" },
      { id: 2, name: "Jane", known_for: [{ title: "Sex and Zen III", adult: true }], profile_path: "/b.jpg" },
      { id: 3, name: "Acteur A", profile_path: "/c.jpg", known_for: [{ title: "Film 4" }] },
    ], new Set());
    expect(popular.map((p) => p.name)).toEqual(["Acteur A"]);
  });

  it("d'abord les acteurs qui reviennent dans l'historique (une voix d'animation n'en est pas un)", () => {
    const metas: Record<string, TitleMeta> = {
      a: meta("Film 1", [[30614, "Acteur A"], [54693, "Actrice B"]]),
      b: meta("Film 2", [[30614, "Acteur A"], [54693, "Actrice B"]]),
      c: meta("Film 3", [[30614, "Acteur A"], [380, "Acteur C"]]),
      d: meta("Dessin animé 1", [[17276, "Voix D"]], true),
      e: meta("Dessin animé 2", [[17276, "Voix D"]], true),
    };
    const out = recurringActors(["a", "b", "c", "d", "e"].map(anchor), (x) => metas[x.key], new Set([54693]));
    expect(out.map((p) => p.name)).toEqual(["Acteur A"]);
    expect(out[0].profilePath).toBe("/30614.jpg");
  });

  it("toute découverte TMDB du moteur demande include_adult=false", () => {
    expect(cappedReleaseParams("movie", { sort_by: "popularity.desc" }).include_adult).toBe("false");
  });
});
