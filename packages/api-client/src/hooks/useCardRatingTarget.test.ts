import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import { cardRatingNeedsSeries, resolveCardRatingTarget } from "./useCardRatingTarget";

const movie = { Id: "m1", Name: "Film", Type: "Movie", ProviderIds: { Tmdb: "603" } } as MediaItem;
const series = { Id: "s1", Name: "Série", Type: "Series", ProviderIds: { Tmdb: "1399" } } as MediaItem;
const episode = {
  Id: "e1",
  Name: "Ép.",
  Type: "Episode",
  SeriesId: "s1",
  ParentIndexNumber: 2,
  IndexNumber: 5,
  ProviderIds: { Tmdb: "999999" },
} as MediaItem;
const boxSet = { Id: "b1", Name: "Coffret", Type: "BoxSet", ProviderIds: { Tmdb: "10" } } as MediaItem;

describe("resolveCardRatingTarget", () => {
  it("note un film par son propre tmdb, sans rien charger", () => {
    expect(cardRatingNeedsSeries(movie)).toBe(false);
    expect(resolveCardRatingTarget(movie, null, "series")).toEqual({
      identity: { mediaType: "movie", tmdbId: 603 },
      jellyfinItemId: "m1",
    });
  });

  it("note la SÉRIE depuis l'affiche d'un épisode — le visage qu'elle montre", () => {
    expect(cardRatingNeedsSeries(episode)).toBe(true);
    expect(resolveCardRatingTarget(episode, series, "series")).toEqual({
      identity: { mediaType: "series", tmdbId: 1399 },
      jellyfinItemId: "s1",
    });
  });

  it("note l'ÉPISODE depuis sa vignette, par le tmdb de la série, jamais le sien", () => {
    expect(resolveCardRatingTarget(episode, series, "item")).toEqual({
      identity: { mediaType: "episode", tmdbId: 1399, seasonNumber: 2, episodeNumber: 5 },
      jellyfinItemId: "e1",
    });
  });

  it("attend la série avant de proposer des étoiles", () => {
    expect(resolveCardRatingTarget(episode, null, "item")).toEqual({ identity: null, jellyfinItemId: null });
  });

  it("ne note pas une collection", () => {
    expect(cardRatingNeedsSeries(boxSet)).toBe(false);
    expect(resolveCardRatingTarget(boxSet, null, "series").identity).toBeNull();
  });
});
