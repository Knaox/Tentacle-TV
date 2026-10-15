import { describe, expect, it } from "vitest";
import {
  INITIAL_TRAILER_PREVIEW_STATE,
  TRAILER_PREVIEW_TIMING,
  reduceTrailerPreview,
  trailerPreviewVisible,
  trailerPreviewWantsStream,
  type TrailerPreviewEvent,
  type TrailerPreviewState,
} from "@tentacle-tv/shared";
import {
  TV_TRAILER_PREVIEW_TIMING,
  createTrailerPreviewMemory,
  previewStartPosition,
  previewVideoKey,
} from "./trailerPreviewTv";

function run(events: TrailerPreviewEvent[], state: TrailerPreviewState = INITIAL_TRAILER_PREVIEW_STATE): TrailerPreviewState {
  return events.reduce((s, e) => reduceTrailerPreview(s, e, TV_TRAILER_PREVIEW_TIMING), state);
}

describe("TV_TRAILER_PREVIEW_TIMING — la machine du bureau aux temps du salon", () => {
  it("un parcours de rangée (un pas toutes les 400 ms) ne demande RIEN", () => {
    let state = INITIAL_TRAILER_PREVIEW_STATE;
    for (let step = 0; step < 10; step += 1) {
      const at = step * 400;
      state = run([{ type: "hover", at }, { type: "tick", at: at + 399 }, { type: "unhover", at: at + 399 }], state);
      expect(trailerPreviewWantsStream(state)).toBe(false);
    }
  });

  it("450 ms de focus tenu : la demande part", () => {
    const state = run([{ type: "hover", at: 0 }, { type: "tick", at: 449 }]);
    expect(state.phase).toBe("intent");
    expect(run([{ type: "tick", at: 450 }], state).phase).toBe("fetching");
  });

  it("la carte ne grandit qu'à 900 ms, et seulement avec la première image", () => {
    const ready = run([
      { type: "hover", at: 0 },
      { type: "tick", at: 450 },
      { type: "streamFound", at: 500 },
      { type: "videoReady", at: 700 },
    ]);
    expect(trailerPreviewVisible(ready)).toBe(false);
    expect(trailerPreviewVisible(run([{ type: "tick", at: 900 }], ready))).toBe(true);
  });

  it("une première image tardive : la carte grandit dès qu'elle est là", () => {
    const late = run([{ type: "hover", at: 0 }, { type: "tick", at: 450 }, { type: "streamFound", at: 500 }, { type: "tick", at: 900 }]);
    expect(trailerPreviewVisible(late)).toBe(false);
    expect(trailerPreviewVisible(run([{ type: "videoReady", at: 1_300 }], late))).toBe(true);
  });

  it("sans première image (flux bloqué), rien ne grandit jamais — échec à 8 s", () => {
    const stalled = run([{ type: "hover", at: 0 }, { type: "tick", at: 1_000 }, { type: "streamFound", at: 1_100 }, { type: "tick", at: 5_000 }]);
    expect(trailerPreviewVisible(stalled)).toBe(false);
    const failed = run([{ type: "tick", at: 1_100 + TRAILER_PREVIEW_TIMING.readyTimeoutMs }], stalled);
    expect(failed.phase).toBe("failed");
    expect(failed.failure).toBe("video");
  });

  it("le focus qui part replie la carte : la vidéo reste le temps du fondu, puis rien", () => {
    const shown = run([{ type: "hover", at: 0 }, { type: "tick", at: 1_000 }, { type: "streamFound", at: 1_100 }, { type: "videoReady", at: 1_200 }, { type: "tick", at: 1_800 }]);
    const leaving = run([{ type: "unhover", at: 3_000 }], shown);
    expect(trailerPreviewVisible(leaving)).toBe(false);
    expect(leaving.exitUntil).toBe(3_000 + TV_TRAILER_PREVIEW_TIMING.exitMs);
    expect(run([{ type: "tick", at: 3_300 }], leaving).exitUntil).toBeNull();
  });
});

describe("createTrailerPreviewMemory — ce que l'appareil retient", () => {
  it("une bande-annonce qui a lâché n'est pas redemandée avant dix minutes", () => {
    let now = 0;
    const memory = createTrailerPreviewMemory({ now: () => now });
    memory.rememberFailure("item:a");
    expect(memory.recentlyFailed("item:a")).toBe(true);
    expect(memory.recentlyFailed("item:b")).toBe(false);
    expect(memory.recentlyFailed(null)).toBe(false);
    now = TRAILER_PREVIEW_TIMING.failureMemoryMs;
    expect(memory.recentlyFailed("item:a")).toBe(false);
  });

  it("reprend une vidéo où on l'avait laissée, dix minutes", () => {
    let now = 0;
    const memory = createTrailerPreviewMemory({ now: () => now });
    memory.savePosition("/v/master.m3u8", 23.5, 120);
    expect(memory.positionOf("/v/master.m3u8")).toBe(23.5);
    now = 10 * 60_000;
    expect(memory.positionOf("/v/master.m3u8")).toBeNull();
  });

  it("une vidéo finie, ou à deux secondes de sa fin, repart du début", () => {
    const memory = createTrailerPreviewMemory({ now: () => 0 });
    memory.savePosition("/v", 50, 100);
    memory.savePosition("/v", 98.5, 100);
    expect(memory.positionOf("/v")).toBeNull();
    memory.savePosition("/w", 0.4);
    expect(memory.positionOf("/w")).toBeNull();
  });

  it("garde au plus 64 vidéos, les plus anciennes s'en vont", () => {
    const memory = createTrailerPreviewMemory({ now: () => 0 });
    for (let i = 0; i < 65; i += 1) memory.savePosition(`/v${i}`, 10);
    expect(memory.positionOf("/v0")).toBeNull();
    expect(memory.positionOf("/v64")).toBe(10);
  });
});

describe("previewVideoKey / previewStartPosition", () => {
  it("la clé d'une vidéo ne garde pas son jeton", () => {
    expect(previewVideoKey("/api/trailers/hls/abc/master.m3u8?t=1.p.x")).toBe("/api/trailers/hls/abc/master.m3u8");
    expect(previewVideoKey("/api/trailers/file/abc.mp4")).toBe("/api/trailers/file/abc.mp4");
  });

  it("reprise d'abord ; sinon quelques secondes après le début d'un HLS ; un MP4 part de 0", () => {
    expect(previewStartPosition({ resumeAt: 31, hls: true })).toBe(31);
    expect(previewStartPosition({ resumeAt: null, hls: true })).toBe(TRAILER_PREVIEW_TIMING.startOffsetS);
    expect(previewStartPosition({ resumeAt: null, hls: false })).toBe(0);
  });
});
