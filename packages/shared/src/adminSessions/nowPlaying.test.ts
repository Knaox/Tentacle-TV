/**
 * Le nom de ce qui se lit : « Série — S1 E1 · Titre », sans accent ni mot
 * « Épisode », pour toutes les cartes du tableau de bord.
 */

import { describe, expect, it } from "vitest";
import { nowPlayingTitle, sessionEpisodeCode } from "./nowPlaying";

const episode = (overrides: Partial<Parameters<typeof nowPlayingTitle>[0]> = {}) => ({
  name: "Chute libre",
  type: "Episode",
  seriesName: "Breaking Bad",
  seasonNumber: 1,
  episodeNumber: 1,
  ...overrides,
});

describe("sessionEpisodeCode", () => {
  it("S1 E1 : une espace, aucune ponctuation, aucun accent", () => {
    expect(sessionEpisodeCode(1, 1)).toBe("S1 E1");
    expect(sessionEpisodeCode(12, 104)).toBe("S12 E104");
    expect(sessionEpisodeCode(0, 3)).toBe("S0 E3");
  });

  it("un numéro manquant n'invente rien", () => {
    expect(sessionEpisodeCode(2, undefined)).toBe("S2");
    expect(sessionEpisodeCode(undefined, 5)).toBe("E5");
    expect(sessionEpisodeCode(undefined, undefined)).toBeNull();
  });
});

describe("nowPlayingTitle", () => {
  it("un épisode : « Série — S1 E1 · Titre »", () => {
    expect(nowPlayingTitle(episode())).toEqual({
      title: "Breaking Bad",
      episode: "S1 E1 · Chute libre",
      full: "Breaking Bad — S1 E1 · Chute libre",
    });
  });

  it("jamais « É » ni « Épisode » dans ce que la règle écrit", () => {
    const { full } = nowPlayingTitle(episode({ seasonNumber: 3, episodeNumber: 7, name: "Un titre" }));
    expect(full).toBe("Breaking Bad — S3 E7 · Un titre");
    expect(full).not.toMatch(/É|Épisode|:/);
  });

  it("le nom générique de Jellyfin ne redit pas le code", () => {
    expect(nowPlayingTitle(episode({ name: "Episode 5", episodeNumber: 5 })).full).toBe("Breaking Bad — S1 E5");
    expect(nowPlayingTitle(episode({ name: "Épisode 5", episodeNumber: 5 })).full).toBe("Breaking Bad — S1 E5");
  });

  it("sans numéros : la série et le titre", () => {
    expect(nowPlayingTitle(episode({ seasonNumber: undefined, episodeNumber: undefined })).full)
      .toBe("Breaking Bad — Chute libre");
  });

  it("sans série connue, l'épisode se nomme lui-même", () => {
    expect(nowPlayingTitle(episode({ seriesName: undefined })).full).toBe("Chute libre — S1 E1");
    expect(nowPlayingTitle(episode({ seriesName: "  ", name: "" })).full).toBe("S1 E1");
  });

  it("un film ou une musique : le titre seul", () => {
    expect(nowPlayingTitle({ name: "Dune : Deuxième partie", type: "Movie" })).toEqual({
      title: "Dune : Deuxième partie", episode: null, full: "Dune : Deuxième partie",
    });
    expect(nowPlayingTitle({ name: "Song", type: "Audio", seriesName: "Album" }).full).toBe("Song");
  });
});
