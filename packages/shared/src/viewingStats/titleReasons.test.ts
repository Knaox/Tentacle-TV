import { describe, expect, it } from "vitest";
import type { ViewingStatsListening, ViewingStatsTitle } from "../types/viewingStats";
import { isLovedTitle, listeningHeadline, listeningState, moviesRankMode, titleReasons } from "./titleReasons";

const movie = (over: Partial<ViewingStatsTitle> = {}): ViewingStatsTitle => ({
  id: "m", name: "m", kind: "movie", seconds: 7200, episodes: 0, viewings: 1, rating: null, favorite: false, verdict: null,
  year: null, anime: false, primaryTag: null, backdropTag: null, lastPlayedAt: null, ...over,
});

const listening = (over: Partial<ViewingStatsListening> = {}): ViewingStatsListening => ({
  versions: null, versionSeconds: 0, languages: [], otherShare: 0, knownSeconds: 0, since: null, ...over,
});

describe("les avis d'un titre", () => {
  it("se disent dans l'ordre du classement : note, verdict, favori, revisionnages", () => {
    expect(titleReasons(movie({ rating: 9, verdict: "superlike", favorite: true, viewings: 3 }))).toEqual([
      { kind: "rating", value: 9 }, { kind: "superlike" }, { kind: "favorite" }, { kind: "viewings", value: 3 },
    ]);
    expect(titleReasons(movie())).toEqual([]);
  });

  it("font un « préféré » d'une bonne note, d'un avis positif ou d'un revisionnage — jamais d'un simple visionnage", () => {
    expect(isLovedTitle(movie({ rating: 6 }))).toBe(true);
    expect(isLovedTitle(movie({ rating: 5 }))).toBe(false);
    expect(isLovedTitle(movie({ viewings: 2 }))).toBe(true);
    expect(isLovedTitle(movie({ verdict: "dislike" }))).toBe(false);
    expect(isLovedTitle(movie())).toBe(false);
  });
});

describe("l'ordre des films", () => {
  it("se lit par les avis, au temps faute d'avis, par date pour un ancien serveur", () => {
    expect(moviesRankMode({ moviesOrder: "preference", movies: [movie({ favorite: true }), movie()] })).toBe("preference");
    expect(moviesRankMode({ moviesOrder: "preference", movies: [movie(), movie()] })).toBe("time");
    expect(moviesRankMode({ moviesOrder: "recent", movies: [movie({ favorite: true })] })).toBe("recent");
  });
});

describe("VF ou VO ?", () => {
  it("se tait tant que rien n'est relevé, attend un échantillon suffisant, puis répond", () => {
    expect(listeningState(listening())).toBe("hidden");
    expect(listeningState(listening({ since: "2026-09-29T20:00:00Z", knownSeconds: 3600 }))).toBe("pending");
    expect(listeningState(listening({ since: "x", versions: { original: 0.2, local: 0.8, otherDubs: 0 } }))).toBe("ready");
  });

  it("dit la version qui domine", () => {
    expect(listeningHeadline(listening({ versions: { original: 0.2, local: 0.8, otherDubs: 0 } }))).toEqual({ version: "local", share: 0.8 });
    expect(listeningHeadline(listening({ versions: { original: 0.5, local: 0.3, otherDubs: 0.2 } }))?.version).toBe("original");
    expect(listeningHeadline(listening())).toBeNull();
  });
});
