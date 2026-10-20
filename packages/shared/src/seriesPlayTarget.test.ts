import { describe, expect, it } from "vitest";
import type { MediaItem } from "./types/media";
import { getNextEpisode, seriesPlayTarget } from "./watchState";

const episode = (id: string, played: boolean, position = 0): MediaItem => ({
  Id: id, Name: id, Type: "Episode", ParentIndexNumber: 1,
  UserData: { Played: played, PlaybackPositionTicks: position, LastPlayedDate: played ? "2026-10-01T10:00:00Z" : undefined },
} as MediaItem);

describe("ce que « Lecture » lance pour une série", () => {
  it("jamais la série : l'épisode à suivre", () => {
    const result = getNextEpisode([episode("e1", true), episode("e2", false)]);
    expect(seriesPlayTarget(result)).toEqual({ kind: "episode", episodeId: "e2" });
  });

  it("un épisode entamé se reprend", () => {
    const result = getNextEpisode([episode("e1", true), episode("e2", false, 1_000)]);
    expect(seriesPlayTarget(result)).toEqual({ kind: "episode", episodeId: "e2" });
  });

  it("une série entièrement vue se revoit depuis son premier épisode", () => {
    const result = getNextEpisode([episode("e1", true), episode("e2", true), episode("e3", true)]);
    expect(seriesPlayTarget(result)).toEqual({ kind: "rewatch", episodeId: "e1" });
  });

  it("sans épisode connu (ou état encore inconnu) : la fiche", () => {
    expect(seriesPlayTarget(getNextEpisode([]))).toEqual({ kind: "detail" });
    expect(seriesPlayTarget(undefined)).toEqual({ kind: "detail" });
  });
});
