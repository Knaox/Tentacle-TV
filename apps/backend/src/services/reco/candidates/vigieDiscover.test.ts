import { describe, expect, it } from "vitest";
import { DISCOVER_QUERIES_MAX, candidatesFromVigieDiscover, tmdbDiscoverParams, vigieDiscoverQueries } from "./vigieDiscover";

const NOW = new Date("2026-10-13T12:00:00Z");
const profile = {
  signalCount: 100,
  facets: {
    "kw:210024": 3, "kw:9715": 2, "kw:818": 1.5, "kw:4565": 1, "kw:10714": 0.8, "kw:1701": 0.5, "kw:999": -2,
    "lang:en": 4, "lang:ja": 2.5, "lang:de": 0.3,
    "genre:16": 3, "genre:10765": 2, "genre:18": 1.8, "genre:28": 1,
    "decade:2010": 3, "decade:2020": 2.5, "decade:2000": 0.4,
    "network:2552": 1.2, "network:213": 1, "studio:3": 0.8,
  },
};

describe("découverte de Jellyseerr réglée par le goût", () => {
  const queries = vigieDiscoverQueries(profile, NOW);

  it("bornée, et dans les noms de Jellyseerr : mots-clés, animé récent, genres par monde, chaînes, studios", () => {
    expect(queries.length).toBeLessThanOrEqual(DISCOVER_QUERIES_MAX);
    expect(queries.some((q) => q.params.keywords === "210024|9715|818")).toBe(true);
    // Un mot-clé évité (poids négatif) n'est jamais demandé.
    expect(queries.some((q) => q.params.keywords?.includes("999"))).toBe(false);
    const anime = queries.filter((q) => q.params.language === "ja");
    expect(anime.length).toBe(3);
    expect(anime.every((q) => q.params.genre === "16")).toBe(true);
    expect(anime.find((q) => q.mediaType === "tv")?.params.firstAirDateGte).toBe("2018-01-01");
    // Les genres de séries ne partent pas vers les films (10765 n'existe que pour les séries).
    expect(queries.find((q) => q.mediaType === "movie" && q.params.genre && !q.params.language)?.params.genre).toBe("16|18");
    expect(queries.find((q) => q.mediaType === "tv" && q.params.genre && !q.params.language)?.params.genre).toBe("16|10765");
    expect(queries.some((q) => q.params.network === "2552")).toBe(true);
    expect(queries.some((q) => q.params.studio === "3")).toBe(true);
  });

  it("les mêmes filtres sous les noms de TMDB (le banc)", () => {
    const tv = queries.find((q) => q.params.language === "ja" && q.mediaType === "tv")!;
    expect(tmdbDiscoverParams(tv)).toMatchObject({ with_original_language: "ja", with_genres: "16", "vote_count.gte": "50", "first_air_date.gte": "2018-01-01" });
  });

  it("chaque réponse devient des candidats Vigie, sortis seulement ; une réponse muette n'arrête rien", async () => {
    let calls = 0;
    const out = await candidatesFromVigieDiscover(profile, async () => {
      calls++;
      if (calls === 1) return null;
      return { results: [
        { id: calls, name: "Série", title: "Film", genreIds: [16], firstAirDate: "2024-10-04", releaseDate: "2024-10-04", voteAverage: 8.5, voteCount: 900, posterPath: "/p.jpg" },
        { id: 1000 + calls, name: "À venir", title: "À venir", firstAirDate: "2099-01-01", releaseDate: "2099-01-01" },
      ] };
    });
    expect(calls).toBe(vigieDiscoverQueries(profile).length);
    expect(out.length).toBe(calls - 1);
    expect(out.every((c) => c.source === "vigie" && c.titleLocalized)).toBe(true);
  });
});
