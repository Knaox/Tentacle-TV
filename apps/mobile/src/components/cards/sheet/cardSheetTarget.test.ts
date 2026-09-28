import { describe, expect, it } from "vitest";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { landscapeSheetTarget, posterSheetTarget, recoSheetTarget } from "./cardSheetTarget";

const episode = { Id: "ep1", Name: "Le pilote", Type: "Episode", SeriesId: "s1", SeriesName: "Arcane" } as MediaItem;
const movie = { Id: "m1", Name: "Heat", Type: "Movie" } as MediaItem;
const reco = (jellyfinItemId: string | null): RecoRowItem => ({
  key: "movie:42", mediaType: "movie", tmdbId: 42, title: "Heat", year: 1995, posterPath: null,
  jellyfinItemId, source: "x", score: 1, voteAverage: 8, reasons: [],
});

describe("cibles de la feuille d'appui long", () => {
  it("titre l'affiche d'un épisode du nom de sa série, comme sa note", () => {
    expect(posterSheetTarget(episode)).toEqual({ variant: "poster", item: episode, title: "Arcane" });
    expect(posterSheetTarget(movie).title).toBe("Heat");
  });

  it("titre la vignette 16:9 du titre qu'elle montre", () => {
    expect(landscapeSheetTarget(episode)).toEqual({ variant: "landscape", item: episode, title: "Le pilote" });
  });

  it("donne à une recommandation en bibliothèque son visage Jellyfin", () => {
    const target = recoSheetTarget(reco("jf1"));
    expect(target.variant).toBe("reco");
    expect(target.item?.Id).toBe("jf1");
    expect(target.item?.ProviderIds?.Tmdb).toBe("42");
  });

  it("n'invente aucun item pour une recommandation hors bibliothèque", () => {
    const target = recoSheetTarget(reco(null));
    expect(target.item).toBeNull();
    expect(target.title).toBe("Heat");
    expect(target.reco?.tmdbId).toBe(42);
  });
});
