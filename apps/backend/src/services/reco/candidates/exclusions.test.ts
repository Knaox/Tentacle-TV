import { describe, expect, it, vi } from "vitest";

const table = <T>(rows: T[]) => ({ findMany: async () => rows });
vi.mock("../../db", () => ({
  getPrisma: () => ({
    userRating: table([{ mediaType: "series", tmdbId: 1 }]),
    recommendationFeedback: table([{ itemKey: "movie:2" }]),
    userLike: table([{ mediaType: "movie", tmdbId: 3 }]),
    userSwipe: table([{ mediaType: "tv", tmdbId: 4 }]),
    // Une carte Vigie mise dans Ma liste, un cœur d'Affiner qui attend son titre.
    watchlistPending: table([{ mediaType: "movie", tmdbId: 5 }, { mediaType: "tv", tmdbId: 6 }]),
  }),
}));

import { accountExclusionKeys, canonicalKey, libraryExclusionKeys } from "./exclusions";

const entry = (key: string, over: Partial<{ played: boolean; isFavorite: boolean; inWatchlist: boolean; inProgress: boolean }> = {}) => ({
  key,
  played: false,
  isFavorite: false,
  inWatchlist: false,
  inProgress: false,
  ...over,
});

describe("exclusions de bibliothèque", () => {
  it("vu, favori, Ma liste ou série entamée : jamais proposé ; le reste passe", () => {
    const keys = libraryExclusionKeys([
      entry("movie:1", { played: true }),
      entry("movie:2", { isFavorite: true }),
      entry("movie:3", { inWatchlist: true }),
      entry("tv:4", { inProgress: true }),
      entry("movie:5"),
    ]);
    expect(keys).toEqual(["movie:1", "movie:2", "movie:3", "tv:4"]);
  });

  it("les exclusions du compte : notes, refus, likes, verdicts, et ce qui est mis de côté", async () => {
    expect(await accountExclusionKeys("u1")).toEqual(["tv:1", "movie:2", "movie:3", "tv:4", "movie:5", "tv:6"]);
  });

  it("la clé canonique d'un like ou d'une note de série est tv:", () => {
    expect(canonicalKey("series", 7)).toBe("tv:7");
    expect(canonicalKey("movie", 7)).toBe("movie:7");
  });
});
