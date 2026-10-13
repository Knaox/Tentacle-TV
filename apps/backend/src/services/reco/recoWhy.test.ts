import { describe, expect, it } from "vitest";
import type { PoolEntry } from "./generationJob";
import { matchOf, whyOf } from "./recoWhy";

const entry = (over: Partial<PoolEntry["breakdown"]>, votes = 9000, rating = 8.5, facets: string[] = []): PoolEntry => ({
  candidate: { key: "tv:1104", mediaType: "tv", tmdbId: 1104, title: "Mad Men", year: 2007, facets: facets.map((k) => ({ key: k, mult: 1 })), voteAverage: rating, voteCount: votes, popularity: 1, source: "library" },
  breakdown: { total: 1, similarity: 1, quality: 0.8, freshness: 0, popularityPenalty: 0, topContributors: [], ...over },
  match: 95,
});

describe("raisons structurées", () => {
  it("adoré X et Y, l'auteur du premier contributeur, salué avec ses vrais chiffres", () => {
    const why = whyOf(entry({
      topAnchors: [{ key: "tv:1398", title: "Les Soprano", contribution: 2, liked: true, loved: true }, { key: "tv:1438", title: "The Wire", contribution: 1, liked: true }],
      topContributors: [{ key: "director:66633", contribution: 3 }],
    }), { "director:66633": "Matthew Weiner" });
    expect(why[0]).toEqual({ kind: "similarTo", titles: [{ key: "tv:1398", title: "Les Soprano" }, { key: "tv:1438", title: "The Wire" }], signal: "loved" });
    expect(why[1]).toMatchObject({ kind: "person", role: "creator", person: { id: 66633, name: "Matthew Weiner" } });
    expect(why[2]).toEqual({ kind: "acclaimed", rating: 8.5, votes: 9000 });
  });

  it("une personne ADORÉE au générique passe devant, rôle compris ; une pépite garde ses chiffres", () => {
    const why = whyOf(entry({}, 400, 8.4, ["actor:30614"]), {}, false, [{ key: "actor:30614", id: 30614, name: "Acteur A", role: "actor" }]);
    expect(why).toEqual([{ kind: "person", person: { id: 30614, name: "Acteur A" }, role: "actor" }, { kind: "hiddenGem", rating: 8.4, votes: 400 }]);
  });

  it("la correspondance vient du pool", () => {
    expect(matchOf(entry({}))).toBe(95);
  });
});
