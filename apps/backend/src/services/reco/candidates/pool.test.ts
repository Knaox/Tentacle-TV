import { describe, expect, it } from "vitest";
import { assemblePool } from "./pool";
import type { Candidate } from "../scoring/strategy";

function candidate(partial: Partial<Candidate> & { key: string }): Candidate {
  const [mediaType, id] = partial.key.split(":") as ["movie" | "tv", string];
  return {
    mediaType,
    tmdbId: Number(id),
    title: "Titre",
    year: null,
    facets: [],
    voteAverage: null,
    voteCount: null,
    popularity: null,
    source: "library",
    ...partial,
  };
}

describe("assemblePool — fusion enrichissante", () => {
  it("un doublon de graine enrichit l'entrée bibliothèque (seedKey conservé)", () => {
    const library = candidate({ key: "movie:603", jellyfinItemId: "jf-1" });
    const fromSeed = candidate({
      key: "movie:603",
      source: "tmdb_rec",
      seedKey: "movie:497",
      posterPath: "/p.jpg",
      backdropPath: "/b.jpg",
      voteCount: 12000,
    });
    const pool = assemblePool([[library], [fromSeed]]);
    expect(pool).toHaveLength(1);
    expect(pool[0].jellyfinItemId).toBe("jf-1");
    expect(pool[0].seedKey).toBe("movie:497");
    expect(pool[0].posterPath).toBe("/p.jpg");
    expect(pool[0].backdropPath).toBe("/b.jpg");
    expect(pool[0].voteCount).toBe(12000);
  });

  it("quand l'arrivant bibliothèque remplace, il reprend les champs du perdant", () => {
    const fromSeed = candidate({
      key: "tv:1399",
      source: "tmdb_rec",
      seedKey: "movie:497",
      posterPath: "/p.jpg",
    });
    const library = candidate({ key: "tv:1399", jellyfinItemId: "jf-2" });
    const pool = assemblePool([[fromSeed], [library]]);
    expect(pool).toHaveLength(1);
    expect(pool[0].jellyfinItemId).toBe("jf-2");
    expect(pool[0].seedKey).toBe("movie:497");
    expect(pool[0].posterPath).toBe("/p.jpg");
  });

  it("deux graines différentes : la première gagne (déterministe)", () => {
    const a = candidate({ key: "movie:11", source: "tmdb_rec", seedKey: "movie:1" });
    const b = candidate({ key: "movie:11", source: "tmdb_rec", seedKey: "movie:2" });
    const pool = assemblePool([[a, b]]);
    expect(pool[0].seedKey).toBe("movie:1");
  });
});
