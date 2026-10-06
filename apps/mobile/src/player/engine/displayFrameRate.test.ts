import { describe, expect, it } from "vitest";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { displayFrameRate, windowDisplayMode } from "./displayFrameRate";

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

describe("windowDisplayMode", () => {
  const modes = [
    { id: 1, width: 1080, height: 2400, refreshRate: 60 },
    { id: 2, width: 1080, height: 2400, refreshRate: 90 },
    { id: 3, width: 1080, height: 2400, refreshRate: 120 },
  ];

  it("24 i/s sur un écran à 60 Hz : la fenêtre demande 120 Hz", () => {
    expect(windowDisplayMode(23.976, { currentModeId: 1, modes, matchPreference: "always" })).toBe(3);
  });

  it("déjà au bon mode : rien n'est épinglé", () => {
    expect(windowDisplayMode(23.976, { currentModeId: 3, modes })).toBe(0);
    expect(windowDisplayMode(30, { currentModeId: 1, modes })).toBe(0);
  });

  it("respecte la préférence système « jamais »", () => {
    expect(windowDisplayMode(23.976, { currentModeId: 1, modes, matchPreference: "never" })).toBe(0);
  });

  it("« sans coupure seulement » : seulement un mode joignable sans coupure", () => {
    expect(windowDisplayMode(23.976, { currentModeId: 1, modes, matchPreference: "seamless", seamlessRefreshRates: [90, 120] })).toBe(3);
    expect(windowDisplayMode(23.976, { currentModeId: 1, modes, matchPreference: "seamless", seamlessRefreshRates: [] })).toBe(0);
    // Avant Android 12, pas de liste : rien ne l'interdit.
    expect(windowDisplayMode(23.976, { currentModeId: 1, modes, matchPreference: "seamless", seamlessRefreshRates: null })).toBe(3);
  });

  it("rien sans cadence, sans écran, ni mode qui convienne", () => {
    expect(windowDisplayMode(0, { currentModeId: 1, modes })).toBe(0);
    expect(windowDisplayMode(24, null)).toBe(0);
    expect(windowDisplayMode(25, { currentModeId: 1, modes })).toBe(0);
    expect(windowDisplayMode(24, { modes })).toBe(0);
  });
});
