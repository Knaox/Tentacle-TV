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

  it("déjà au bon mode : le mode est épinglé quand même (le système redescendrait pendant la vidéo)", () => {
    expect(windowDisplayMode(23.976, { currentModeId: 3, modes })).toBe(3);
    expect(windowDisplayMode(30, { currentModeId: 1, modes })).toBe(1);
  });

  it("la préférence système ne bloque pas une demande explicite de la fenêtre", () => {
    expect(windowDisplayMode(23.976, { currentModeId: 1, modes, matchPreference: "never" })).toBe(3);
    expect(windowDisplayMode(23.976, { currentModeId: 1, modes, matchPreference: "seamless", seamlessRefreshRates: [] })).toBe(3);
  });

  it("écran 60/120 Hz en deux définitions (Find X3 Pro) : 120 Hz dans la définition courante", () => {
    const oppo = [
      { id: 1, width: 1440, height: 3216, refreshRate: 120 },
      { id: 2, width: 1440, height: 3216, refreshRate: 60 },
      { id: 3, width: 1080, height: 2412, refreshRate: 120 },
      { id: 4, width: 1080, height: 2412, refreshRate: 60 },
    ];
    expect(windowDisplayMode(23.976, { currentModeId: 4, modes: oppo })).toBe(3);
    expect(windowDisplayMode(24, { currentModeId: 1, modes: oppo })).toBe(1);
    expect(windowDisplayMode(25, { currentModeId: 4, modes: oppo })).toBe(0);
  });

  it("rien sans cadence, sans écran, ni mode qui convienne", () => {
    expect(windowDisplayMode(0, { currentModeId: 1, modes })).toBe(0);
    expect(windowDisplayMode(24, null)).toBe(0);
    expect(windowDisplayMode(25, { currentModeId: 1, modes })).toBe(0);
    expect(windowDisplayMode(24, { modes })).toBe(0);
  });
});
