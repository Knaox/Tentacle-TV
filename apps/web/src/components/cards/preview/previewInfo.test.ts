import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import { previewFactsEmpty, previewInfoOf, previewProgressOf, previewRatingOf } from "./previewInfo";

/**
 * Ce que dit le bandeau de la mini-carte : lu sur la carte, sinon sur sa
 * fiche — jamais inventé, jamais une requête de plus.
 */
const MINUTE = 60 * 10_000_000;
const item = (over: Partial<MediaItem>) => ({ Id: "x", Name: "x", Type: "Movie", ...over }) as MediaItem;

describe("previewRatingOf", () => {
  it("retire le préfixe du pays, garde le reste", () => {
    expect(previewRatingOf("FR-12")).toBe("12");
    expect(previewRatingOf("FR-TP")).toBe("TP");
    expect(previewRatingOf("PG-13")).toBe("PG-13");
    expect(previewRatingOf("TV-MA")).toBe("TV-MA");
  });

  it("tait une absence de classification", () => {
    for (const raw of ["NR", "Unrated", "Not Rated", "", "  ", null, undefined]) expect(previewRatingOf(raw)).toBeNull();
  });
});

describe("previewProgressOf", () => {
  it("dit la part vue d'un film ou d'un épisode commencé", () => {
    const film = item({ RunTimeTicks: 58 * MINUTE, UserData: { PlaybackPositionTicks: 54 * MINUTE, PlayedPercentage: 93.1 } as MediaItem["UserData"] });
    expect(previewProgressOf(film)).toEqual({ percent: 93.1, watchedTicks: 54 * MINUTE, totalTicks: 58 * MINUTE });
  });

  it("se tait pour un titre fini, pas commencé, ou une série", () => {
    const data = (over: object) => ({ PlaybackPositionTicks: 0, ...over }) as MediaItem["UserData"];
    expect(previewProgressOf(item({ RunTimeTicks: MINUTE, UserData: data({ Played: true, PlayedPercentage: 40 }) }))).toBeNull();
    expect(previewProgressOf(item({ RunTimeTicks: MINUTE, UserData: data({}) }))).toBeNull();
    expect(previewProgressOf(item({ Type: "Series", RunTimeTicks: MINUTE, UserData: data({ PlayedPercentage: 30 }) }))).toBeNull();
    expect(previewProgressOf(null)).toBeNull();
  });
});

describe("previewInfoOf", () => {
  it("un film : année, classification, durée, qualité, genres — lus sur la carte, puis la fiche", () => {
    const card = item({ Id: "m", ProductionYear: 1927, RunTimeTicks: 153 * MINUTE, CommunityRating: 8.123 });
    const detail = item({
      Id: "m", OfficialRating: "FR-TP", Genres: ["Drame", "Science-Fiction", "Muet", "Classique"],
      MediaStreams: [{ Type: "Video", Width: 3840, Height: 2160, VideoRangeType: "DOVI" }] as MediaItem["MediaStreams"],
    });
    const info = previewInfoOf(card, detail);
    expect(info.episode).toBeNull();
    expect(info.facts).toMatchObject({ year: 1927, rating: "TP", community: 8.123, runtime: "2h 33min", seasons: null });
    expect(info.facts.quality.map((badge) => badge.short)).toEqual(["4K", "VISION"]);
    expect(info.genres).toEqual(["Drame", "Science-Fiction", "Muet"]);
    expect(info.progress).toBeNull();
  });

  it("une série : ses saisons, jamais une durée", () => {
    const series = item({ Id: "s", Type: "Series", ProductionYear: 2008, ChildCount: 5, RunTimeTicks: 47 * MINUTE, Genres: ["Drame"] });
    expect(previewInfoOf(series, null).facts).toMatchObject({ year: 2008, seasons: 5, runtime: null });
  });

  it("un épisode commencé : son code, son titre, sa progression", () => {
    const episode = item({
      Id: "e", Type: "Episode", Name: "Chute libre", ParentIndexNumber: 1, IndexNumber: 1, RunTimeTicks: 58 * MINUTE,
      UserData: { PlaybackPositionTicks: 54 * MINUTE, PlayedPercentage: 93 } as MediaItem["UserData"],
    });
    const info = previewInfoOf(episode, null);
    expect(info.episode).toEqual({ code: "S01E01", title: "Chute libre" });
    expect(info.progress?.percent).toBe(93);
  });

  it("n'emprunte pas la fiche d'un AUTRE titre", () => {
    const card = item({ Id: "a" });
    const other = item({ Id: "b", Genres: ["Horreur"], OfficialRating: "16" });
    const info = previewInfoOf(card, other);
    expect(info.genres).toEqual([]);
    expect(info.facts.rating).toBeNull();
  });

  it("sans item (hors bibliothèque) : l'année donnée par la carte, rien d'autre", () => {
    const info = previewInfoOf(null, null, 2016);
    expect(info.facts.year).toBe(2016);
    expect(previewFactsEmpty(info.facts)).toBe(false);
    expect(previewFactsEmpty(previewInfoOf(null, null).facts)).toBe(true);
  });

  it("la fiche d'une recommandation de la bibliothèque (aucun item de carte) fait foi", () => {
    const detail = item({ Id: "r", ProductionYear: 2019, Genres: ["Animation"] });
    expect(previewInfoOf(null, detail, 2018)).toMatchObject({ facts: { year: 2019 }, genres: ["Animation"] });
  });
});
