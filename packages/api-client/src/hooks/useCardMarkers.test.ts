import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import type { UserRatingEntry } from "./useRatings";
import { userScoreFromRatings } from "./useCardMarkers";

function entry(partial: Partial<UserRatingEntry>): UserRatingEntry {
  return {
    id: "r",
    mediaType: "movie",
    tmdbId: 1,
    jellyfinItemId: null,
    seasonNumber: 0,
    episodeNumber: 0,
    score: 7,
    syncStatus: "synced",
    updatedAt: "2026-09-28T00:00:00Z",
    ...partial,
  };
}

const movie = { Id: "m1", Name: "Film", Type: "Movie", ProviderIds: { Tmdb: "603" } } as MediaItem;
const episode = { Id: "e1", Name: "Ép.", Type: "Episode", SeriesId: "s1" } as MediaItem;

describe("userScoreFromRatings", () => {
  it("retrouve un film par son tmdb quand la note n'a pas d'id Jellyfin", () => {
    expect(userScoreFromRatings([entry({ tmdbId: 603, score: 8 })], movie)).toBe(8);
  });

  it("donne à l'affiche d'un épisode la note de SA série", () => {
    const entries = [entry({ mediaType: "series", tmdbId: 9, jellyfinItemId: "s1", score: 6 })];
    expect(userScoreFromRatings(entries, episode, "series")).toBe(6);
    expect(userScoreFromRatings(entries, episode, "item")).toBeNull();
  });

  it("ignore une note en cours de retrait", () => {
    const entries = [entry({ tmdbId: 603, syncStatus: "delete_pending" })];
    expect(userScoreFromRatings(entries, movie)).toBeNull();
  });
});
