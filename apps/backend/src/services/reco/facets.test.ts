import { describe, expect, it } from "vitest";
import { decadeOf, facetsFromJellyfin, facetsFromTmdb, runtimeBucket } from "./facets";
import type { TitleMeta } from "../tmdb/metaCache";

const META: TitleMeta = {
  mediaType: "movie",
  tmdbId: 603,
  title: "The Matrix",
  genres: [{ id: 28, name: "Action" }, { id: 878, name: "Science Fiction" }],
  keywords: [{ id: 310, name: "artificial intelligence" }, { id: 4565, name: "dystopia" }],
  directors: [{ id: 9339, name: "Lilly Wachowski" }, { id: 9340, name: "Lana Wachowski" }],
  topCast: [
    { id: 6384, name: "Keanu Reeves" },
    { id: 2975, name: "Laurence Fishburne" },
    { id: 530, name: "Carrie-Anne Moss" },
    { id: 1331, name: "Hugo Weaving" },
    { id: 3799, name: "Joe Pantoliano" },
  ],
  studios: [{ id: 79, name: "Village Roadshow Pictures" }],
  networks: [],
  year: 1999,
  originalLanguage: "en",
  runtimeMinutes: 136,
  popularity: 80,
  voteAverage: 8.2,
  voteCount: 24000,
  posterPath: "/matrix.jpg",
  backdropPath: "/matrix-backdrop.jpg",
};

describe("facettes TMDB", () => {
  const entries = facetsFromTmdb(META);
  const byKey = new Map(entries.map((e) => [e.key, e.mult]));

  it("le réalisateur pèse deux fois un acteur", () => {
    expect(byKey.get("director:9339")).toBe(2);
    expect(byKey.get("actor:6384")).toBe(1);
  });

  it("genres, keywords, studio, décennie, langue et durée sont présents", () => {
    for (const key of ["genre:28", "kw:310", "kw:4565", "studio:79", "decade:1990", "lang:en", "runtime:long"]) {
      expect(byKey.has(key), key).toBe(true);
    }
  });
});

describe("buckets et décennies", () => {
  it("buckets de durée aux bornes de la spec (< 90, 90-120, 120-150, > 150)", () => {
    expect(runtimeBucket(85)).toBe("short");
    expect(runtimeBucket(90)).toBe("standard");
    expect(runtimeBucket(120)).toBe("standard");
    expect(runtimeBucket(121)).toBe("long");
    expect(runtimeBucket(150)).toBe("long");
    expect(runtimeBucket(151)).toBe("epic");
  });

  it("décennie", () => {
    expect(decadeOf(1994)).toBe(1990);
    expect(decadeOf(2000)).toBe(2000);
  });
});

describe("facettes de repli Jellyfin", () => {
  it("espaces de clés distincts (genre-name:, studio-name:) et slugs stables", () => {
    const entries = facetsFromJellyfin({
      Genres: ["Science Fiction", "Drame"],
      Studios: [{ Name: "Warner Bros. Pictures" }],
      ProductionYear: 1999,
      RunTimeTicks: 136 * 600_000_000,
    });
    const keys = entries.map((e) => e.key);
    expect(keys).toContain("genre-name:science-fiction");
    expect(keys).toContain("studio-name:warner-bros.-pictures");
    expect(keys).toContain("decade:1990");
    expect(keys).toContain("runtime:long");
    // Jamais l'espace des IDs TMDB.
    expect(keys.every((k) => !k.startsWith("genre:") && !k.startsWith("studio:"))).toBe(true);
  });
});
