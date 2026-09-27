/**
 * Ce que partagent les deux analyses qui font travailler Jellyfin : un seul
 * transcodage à la fois, la politesse envers les autres spectateurs, les
 * compteurs de Services.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ readSessions: vi.fn() }));
vi.mock("./watchTime/sessions", () => ({ readSessions: () => mocks.readSessions() }));

import {
  audioAnalysisCounters,
  countAudioDeferral,
  countAudioJob,
  countAudioOutcome,
  countAudioWindow,
  otherViewerTranscoding,
  resetAudioCountersForTests,
  withAudioSlot,
} from "./audioJobs";

beforeEach(() => {
  resetAudioCountersForTests();
  mocks.readSessions.mockReset();
});

describe("withAudioSlot", () => {
  it("un travail à la fois, dans l'ordre — et un échec ne bloque pas le suivant", async () => {
    const events: string[] = [];
    let release: () => void = () => undefined;
    const first = withAudioSlot(async () => {
      events.push("début 1");
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      events.push("fin 1");
      throw new Error("raté");
    });
    const second = withAudioSlot(async () => {
      events.push("début 2");
      return 2;
    });
    await Promise.resolve();
    expect(events).toEqual(["début 1"]);
    release();
    await expect(first).rejects.toThrow("raté");
    expect(await second).toBe(2);
    expect(events).toEqual(["début 1", "fin 1", "début 2"]);
  });
});

describe("otherViewerTranscoding", () => {
  it("seul un AUTRE spectateur qui transcode une vidéo, en lecture, compte", async () => {
    mocks.readSessions.mockResolvedValue([
      { NowPlayingItem: { Id: "moi" }, PlayState: { IsPaused: false }, TranscodingInfo: { IsVideoDirect: false } },
      { NowPlayingItem: { Id: "a" }, PlayState: { IsPaused: true }, TranscodingInfo: { IsVideoDirect: false } },
      { NowPlayingItem: { Id: "b" }, PlayState: { IsPaused: false }, TranscodingInfo: { IsVideoDirect: true } },
      { NowPlayingItem: { Id: "c" }, PlayState: { IsPaused: false } },
    ]);
    expect(await otherViewerTranscoding("moi")).toBe(false);
    mocks.readSessions.mockResolvedValue([
      { NowPlayingItem: { Id: "d" }, PlayState: { IsPaused: false }, TranscodingInfo: { IsVideoDirect: false } },
    ]);
    expect(await otherViewerTranscoding("moi")).toBe(true);
    mocks.readSessions.mockResolvedValue(null);
    expect(await otherViewerTranscoding("moi")).toBe(false);
  });
});

describe("les compteurs", () => {
  it("additionnent ce que la fonction a coûté depuis le démarrage", () => {
    countAudioJob();
    countAudioWindow(3_000_000, 2_500);
    countAudioWindow(6_000_000, 5_000, 2);
    countAudioOutcome(true);
    countAudioOutcome(false);
    countAudioDeferral();
    expect(audioAnalysisCounters()).toEqual({
      jobs: 1, windows: 3, bytes: 9_000_000, seconds: 7.5, verdicts: 1, silent: 1, deferred: 1,
    });
  });
});
