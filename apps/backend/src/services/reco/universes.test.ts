import { describe, expect, it } from "vitest";
import type { TitleMeta } from "../tmdb/metaCache";
import { facetsFromTmdb } from "./facets";
import { EXPLICIT_FACET, contentWorldOf, isBlockedExplicit, isExplicitMeta, isKidsAnimationCoarse, universesOfMeta } from "./universes";

const meta = (over: Partial<TitleMeta>): TitleMeta => ({
  mediaType: "movie", tmdbId: 1, title: "t", genres: [], keywords: [], directors: [], topCast: [], studios: [], networks: [],
  year: 2020, originalLanguage: "en", originCountry: ["US"], runtimeMinutes: 100, popularity: 1, voteAverage: 7, voteCount: 100,
  posterPath: null, backdropPath: null, providers: [], ...over,
});

describe("univers d'un titre", () => {
  it("un Ghibli familial est animé ET animation familiale ; Pixar est une franchise", () => {
    const ghibli = meta({ genres: [{ id: 16, name: "Animation" }, { id: 10751, name: "Family" }], originalLanguage: "ja", originCountry: ["JP"] });
    expect(universesOfMeta(ghibli)).toEqual(["anime", "kidsAnimation"]);
    const pixar = meta({ genres: [{ id: 16, name: "Animation" }, { id: 10751, name: "Family" }], studios: [{ id: 3, name: "Pixar" }] });
    expect(universesOfMeta(pixar)).toEqual(["kidsAnimation", "franchise"]);
  });

  it("pornographie explicite seulement : le drapeau adulte de TMDB, hentai, pornographie — posée en facette muette", () => {
    expect(isExplicitMeta(meta({ adult: true }))).toBe(true);
    expect(isExplicitMeta(meta({ keywords: [{ id: 2, name: "Hentai" }] }))).toBe(true);
    // Le contenu sexuel n'est pas filtré : ecchi, drames qui montrent des violences.
    expect(isExplicitMeta(meta({ keywords: [{ id: 3, name: "ecchi" }, { id: 4, name: "rape" }, { id: 5, name: "harem" }] }))).toBe(false);
    const facet = facetsFromTmdb(meta({ adult: true })).find((f) => f.key === EXPLICIT_FACET);
    expect(facet?.mult).toBe(0);
  });

  it("la liste fermée des titres X que TMDB ne marque pas « adult » (Redo of Healer)", () => {
    expect(isExplicitMeta(meta({ mediaType: "tv", tmdbId: 99071, adult: false }))).toBe(true);
    expect(isExplicitMeta(meta({ mediaType: "movie", tmdbId: 99071 }))).toBe(false);
    // Hors bibliothèque seulement, même sans fiche (sa clé suffit) ; jamais dans la bibliothèque.
    expect(isBlockedExplicit({ key: "tv:99071", facets: [] })).toBe(true);
    expect(isBlockedExplicit({ key: "tv:99071", jellyfinItemId: "jf", facets: [] })).toBe(false);
    expect(isBlockedExplicit({ key: "movie:1", jellyfinItemId: "jf", facets: [{ key: EXPLICIT_FACET }] })).toBe(false);
    expect(isBlockedExplicit({ key: "movie:1", facets: [{ key: EXPLICIT_FACET }] })).toBe(true);
  });
});

describe("les mondes d'un titre", () => {
  it("animé, animation, prises de vues réelles", () => {
    expect(contentWorldOf(["genre:16", "universe:anime"])).toBe("anime");
    expect(contentWorldOf(["genre:16", "universe:kids-animation"])).toBe("animation");
    expect(contentWorldOf(["genre:53"])).toBe("live");
  });
});

describe("animation familiale", () => {
  it("une série d'un studio d'animation familiale l'est même sans le genre Famille (une série DreamWorks)", () => {
    const berk = meta({ mediaType: "tv", genres: [{ id: 16, name: "Animation" }, { id: 10759, name: "Action & Adventure" }], studios: [{ id: 42141, name: "DreamWorks Animation Television" }] });
    expect(universesOfMeta(berk)).toContain("kidsAnimation");
    const arcane = meta({ mediaType: "tv", genres: [{ id: 16, name: "Animation" }, { id: 18, name: "Drama" }], studios: [{ id: 99, name: "Fortiche" }] });
    expect(universesOfMeta(arcane)).not.toContain("kidsAnimation");
  });

  it("dès la liste, par les genres", () => {
    expect(isKidsAnimationCoarse([16, 10751])).toBe(true);
    expect(isKidsAnimationCoarse([16, 10762, 35])).toBe(true);
    expect(isKidsAnimationCoarse([16, 18])).toBe(false);
  });
});
