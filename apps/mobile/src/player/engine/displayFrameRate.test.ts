import { describe, expect, it } from "vitest";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { displayFrameRate } from "./displayFrameRate";

const film = [{ Type: "Video", Index: 0, RealFrameRate: 23.976 } as JfStream];
const unknown = [{ Type: "Video", Index: 0 } as JfStream];

describe("displayFrameRate", () => {
  it("Android, réglage allumé : la cadence exacte de Jellyfin", () => {
    expect(displayFrameRate({ platform: "android", enabled: true, streams: film, loadedFps: 24 })).toBe(23.976);
  });

  it("se replie sur la cadence lue par mpv", () => {
    expect(displayFrameRate({ platform: "android", enabled: true, streams: unknown, loadedFps: 25 })).toBe(25);
  });

  it("ne demande rien sans cadence plausible", () => {
    expect(displayFrameRate({ platform: "android", enabled: true, streams: unknown })).toBe(0);
    expect(displayFrameRate({ platform: "android", enabled: true, streams: unknown, loadedFps: 1000 })).toBe(0);
  });

  it("ne demande rien réglage coupé", () => {
    expect(displayFrameRate({ platform: "android", enabled: false, streams: film, loadedFps: 24 })).toBe(0);
  });

  it("ne change rien sur iOS", () => {
    expect(displayFrameRate({ platform: "ios", enabled: true, streams: film, loadedFps: 24 })).toBe(0);
  });
});
