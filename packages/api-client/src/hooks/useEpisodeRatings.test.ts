import { describe, expect, it } from "vitest";
import { episodeRatingIdentity, episodeRatingsIndex } from "./useEpisodeRatings";
import type { UserRatingEntry } from "./useRatings";

const entry = (over: Partial<UserRatingEntry>): UserRatingEntry => ({
  id: "x",
  mediaType: "episode",
  tmdbId: 1399,
  tvdbId: null,
  anilistId: null,
  jellyfinItemId: null,
  seasonNumber: 1,
  episodeNumber: 1,
  isAnime: false,
  score: 8,
  syncStatus: "synced",
  updatedAt: "2026-09-04T00:00:00.000Z",
  ...over,
});

describe("episodeRatingIdentity", () => {
  it("porte le tmdb de la SÉRIE, la saison et le numéro", () => {
    expect(episodeRatingIdentity(1399, 3, 9)).toEqual({
      mediaType: "episode",
      tmdbId: 1399,
      seasonNumber: 3,
      episodeNumber: 9,
    });
  });
});

describe("episodeRatingsIndex", () => {
  it("indexe la saison demandée, ignore les autres saisons, séries et types", () => {
    const index = episodeRatingsIndex(
      [
        entry({ episodeNumber: 1, score: 8 }),
        entry({ episodeNumber: 4, score: 10 }),
        entry({ seasonNumber: 2, episodeNumber: 1, score: 2 }),
        entry({ tmdbId: 42, episodeNumber: 1, score: 2 }),
        entry({ mediaType: "series", seasonNumber: 0, episodeNumber: 0, score: 6 }),
      ],
      1399,
      1
    );
    expect([...index.entries()]).toEqual([
      [1, 8],
      [4, 10],
    ]);
  });
  it("sans données : vide", () => {
    expect(episodeRatingsIndex(undefined, 1399, 1).size).toBe(0);
  });
});
