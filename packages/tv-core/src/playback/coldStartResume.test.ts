import { describe, expect, it } from "vitest";
import type { MediaItem, NextEpisodeResult } from "@tentacle-tv/shared";

import { seriesResumeAfterStop } from "./coldStartResume";

const STOPPED_AT = Date.parse("2026-10-01T20:00:00Z");
const TICKS = 10_000_000;

const episode = (id: string, userData: Partial<NonNullable<MediaItem["UserData"]>> = {}): MediaItem => ({
  Id: id, Name: id, Type: "Episode", SeriesId: "serie", SeasonId: "s1", RunTimeTicks: 2_400 * TICKS,
  UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false, Key: id, ...userData },
}) as MediaItem;

/** E5, tel que l'adoption l'a patché : l'arrêt du marqueur, à 10 min. */
const ours = episode("e5", { PlaybackPositionTicks: 600 * TICKS, LastPlayedDate: "2026-10-01T19:40:00Z" });
const stop = { episode: ours, positionTicks: 600 * TICKS, stoppedAt: STOPPED_AT };

describe("la reprise d'une série à la relance à froid", () => {
  it("corrige la position quand le serveur montre déjà l'épisode, à l'ancienne position", () => {
    const server: NextEpisodeResult = { type: "continue", episode: episode("e5", { PlaybackPositionTicks: 90 * TICKS }), positionTicks: 90 * TICKS };
    expect(seriesResumeAfterStop(server, stop)).toEqual({ type: "continue", episode: ours, positionTicks: 600 * TICKS });
  });

  it("reprend l'épisode quand le serveur, n'ayant rien écrit, propose de lire", () => {
    const next: NextEpisodeResult = { type: "next", episode: episode("e5") };
    const start: NextEpisodeResult = { type: "start", episode: episode("e1") };
    expect(seriesResumeAfterStop(next, stop)).toEqual({ type: "continue", episode: ours, positionTicks: 600 * TICKS });
    expect(seriesResumeAfterStop(start, stop)).toEqual({ type: "continue", episode: ours, positionTicks: 600 * TICKS });
    expect(seriesResumeAfterStop({ type: "completed" }, stop)).toEqual({ type: "continue", episode: ours, positionTicks: 600 * TICKS });
  });

  it("préfère notre arrêt à un épisode entamé avant lui", () => {
    const older = episode("e2", { PlaybackPositionTicks: 300 * TICKS, LastPlayedDate: "2026-09-20T21:00:00Z" });
    expect(seriesResumeAfterStop({ type: "continue", episode: older, positionTicks: 300 * TICKS }, stop))
      .toEqual({ type: "continue", episode: ours, positionTicks: 600 * TICKS });
  });

  it("la date gagne : un épisode entamé APRÈS notre arrêt (un autre appareil) reste le verdict", () => {
    const newer = episode("e6", { PlaybackPositionTicks: 120 * TICKS, LastPlayedDate: "2026-10-01T20:30:00Z" });
    const server: NextEpisodeResult = { type: "continue", episode: newer, positionTicks: 120 * TICKS };
    expect(seriesResumeAfterStop(server, stop)).toBe(server);
  });

  it("un autre épisode sans date ne l'emporte pas", () => {
    const undated = episode("e2", { PlaybackPositionTicks: 300 * TICKS });
    expect(seriesResumeAfterStop({ type: "continue", episode: undated, positionTicks: 300 * TICKS }, stop))
      .toEqual({ type: "continue", episode: ours, positionTicks: 600 * TICKS });
  });
});
