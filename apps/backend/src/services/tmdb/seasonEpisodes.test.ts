import { describe, expect, it } from "vitest";
import { isSeasonFresh, normalizeSeasonEpisodes } from "./seasonEpisodes";

describe("normalizeSeasonEpisodes", () => {
  it("garde le numéro, arrondit la moyenne au dixième, trie par numéro", () => {
    const out = normalizeSeasonEpisodes({
      episodes: [
        { episode_number: 3, vote_average: 8.456, vote_count: 12 },
        { episode_number: 1, vote_average: 7.9, vote_count: 40 },
      ],
    });
    expect(out).toEqual([
      { episodeNumber: 1, voteAverage: 7.9, voteCount: 40 },
      { episodeNumber: 3, voteAverage: 8.5, voteCount: 12 },
    ]);
  });
  it("sans vote, la note est nulle — jamais zéro", () => {
    expect(normalizeSeasonEpisodes({ episodes: [{ episode_number: 2, vote_average: 0, vote_count: 0 }] })).toEqual([
      { episodeNumber: 2, voteAverage: null, voteCount: 0 },
    ]);
  });
  it("ignore l'illisible : épisode sans numéro entier, réponse sans liste", () => {
    expect(normalizeSeasonEpisodes({ episodes: [{ episode_number: "x" }, null, { episode_number: -1 }] })).toEqual([]);
    expect(normalizeSeasonEpisodes(null)).toEqual([]);
    expect(normalizeSeasonEpisodes({})).toEqual([]);
  });
});

describe("isSeasonFresh", () => {
  const entry = { tmdbId: 1, seasonNumber: 1, episodes: [], fetchedAt: "2026-09-04T10:00:00.000Z" };
  it("fraîche moins d'un jour après la lecture, périmée ensuite", () => {
    expect(isSeasonFresh(entry, Date.parse("2026-09-04T22:00:00.000Z"))).toBe(true);
    expect(isSeasonFresh(entry, Date.parse("2026-09-05T11:00:00.000Z"))).toBe(false);
  });
  it("une date illisible vaut périmée", () => {
    expect(isSeasonFresh({ ...entry, fetchedAt: "?" })).toBe(false);
  });
});
