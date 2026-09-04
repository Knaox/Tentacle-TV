/**
 * Le bouton Lecture d'une carte de recommandation promet « reprendre, sinon
 * l'épisode 1 » : chaque état de série et chaque forme de film doivent mener
 * au bon endroit avec le bon mot — et une série qu'on ne sait pas encore
 * lancer doit ouvrir sa fiche, jamais un épisode au hasard.
 */

import type { MediaItem, NextEpisodeResult } from "@tentacle-tv/shared";
import { describe, expect, it } from "vitest";
import { hasMovieResume, playMediaId, resolveRecoPlayTarget } from "./recoPlayTarget";

function episode(season: number, number: number, id: string): MediaItem {
  return { Id: id, Name: `Épisode ${number}`, Type: "Episode", ParentIndexNumber: season, IndexNumber: number } as unknown as MediaItem;
}

function movie(userData: Record<string, unknown>): MediaItem {
  return { Id: "m1", Name: "Film", Type: "Movie", UserData: userData } as unknown as MediaItem;
}

const series = (watchState: NextEpisodeResult | undefined, watchFailed = false) =>
  resolveRecoPlayTarget({ jellyfinItemId: "s1", mediaType: "tv", watchState, watchFailed, media: undefined });

describe("la reprise d'un film", () => {
  it("existe entre le début et le générique", () => {
    expect(hasMovieResume(movie({ PlayedPercentage: 42 }))).toBe(true);
  });

  it("n'existe ni sans média, ni à zéro, ni au-delà du seuil de fin", () => {
    expect(hasMovieResume(undefined)).toBe(false);
    expect(hasMovieResume(movie({ PlayedPercentage: 0 }))).toBe(false);
    expect(hasMovieResume(movie({ PlayedPercentage: 99.4 }))).toBe(false);
    expect(hasMovieResume(movie({ Played: true, PlayedPercentage: 100 }))).toBe(false);
  });
});

describe("la cible de lecture d'un film", () => {
  it("se lance tel quel, même avant que le média soit chargé", () => {
    expect(resolveRecoPlayTarget({ jellyfinItemId: "m1", mediaType: "movie", watchState: undefined, watchFailed: false, media: undefined }))
      .toEqual({ path: "/watch/m1", kind: "start", labelKey: "common:play", episodeCode: null, pending: false });
  });

  it("dit « Reprendre » quand une lecture est entamée", () => {
    const target = resolveRecoPlayTarget({ jellyfinItemId: "m1", mediaType: "movie", watchState: undefined, watchFailed: false, media: movie({ PlayedPercentage: 42 }) });
    expect(target.kind).toBe("resume");
    expect(target.labelKey).toBe("common:resume");
    expect(target.path).toBe("/watch/m1");
  });

  it("dit « Lecture » sur un film déjà vu — c'est une relecture", () => {
    const target = resolveRecoPlayTarget({ jellyfinItemId: "m1", mediaType: "movie", watchState: undefined, watchFailed: false, media: movie({ Played: true, PlayedPercentage: 100 }) });
    expect(target.kind).toBe("start");
    expect(target.labelKey).toBe("common:play");
  });
});

describe("la cible de lecture d'une série", () => {
  it("ouvre la fiche tant que l'état est en vol", () => {
    expect(series(undefined)).toEqual({ path: "/media/s1", kind: "detail", labelKey: "common:play", episodeCode: null, pending: true });
  });

  it("reprend l'épisode entamé", () => {
    expect(series({ type: "continue", episode: episode(2, 5, "e25"), positionTicks: 10 }))
      .toEqual({ path: "/watch/e25", kind: "resume", labelKey: "common:resume", episodeCode: "S2 · E5", pending: false });
  });

  it("lance l'épisode suivant", () => {
    expect(series({ type: "next", episode: episode(2, 6, "e26") }))
      .toEqual({ path: "/watch/e26", kind: "next", labelKey: "common:play", episodeCode: "S2 · E6", pending: false });
  });

  it("commence par le tout premier épisode quand rien n'a été vu", () => {
    expect(series({ type: "start", episode: episode(1, 1, "e11") }))
      .toEqual({ path: "/watch/e11", kind: "start", labelKey: "common:play", episodeCode: "S1 · E1", pending: false });
  });

  it("renvoie vers la fiche quand la série est terminée", () => {
    expect(series({ type: "completed" })).toEqual({ path: "/media/s1", kind: "detail", labelKey: "common:play", episodeCode: null, pending: false });
  });

  it("renvoie vers la fiche, sans attente, quand l'état n'a pas pu être chargé", () => {
    expect(series(undefined, true).pending).toBe(false);
    expect(series(undefined, true).path).toBe("/media/s1");
  });
});

describe("l'item dont on lit qualité, langues et reprise", () => {
  it("est le film lui-même", () => {
    expect(playMediaId("m1", "movie", undefined)).toBe("m1");
  });

  it("est l'épisode que la série va lancer, et rien sinon", () => {
    expect(playMediaId("s1", "tv", undefined)).toBeUndefined();
    expect(playMediaId("s1", "tv", { type: "completed" })).toBeUndefined();
    expect(playMediaId("s1", "tv", { type: "continue", episode: episode(2, 5, "e25"), positionTicks: 10 })).toBe("e25");
    expect(playMediaId("s1", "tv", { type: "start", episode: episode(1, 1, "e11") })).toBe("e11");
  });
});
