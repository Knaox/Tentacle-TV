import { describe, expect, it } from "vitest";
import { fluidDisplayMode } from "./displayFrameRate";

// Les modes relevés sur l'OPPO Find X3 Pro (dumpsys display, 07/10).
const oppo = [
  { id: 1, width: 1080, height: 2412, refreshRate: 120 },
  { id: 2, width: 1080, height: 2412, refreshRate: 60 },
  { id: 3, width: 1080, height: 2412, refreshRate: 72 },
  { id: 4, width: 1080, height: 2412, refreshRate: 90 },
  { id: 5, width: 1440, height: 3216, refreshRate: 60 },
  { id: 8, width: 1440, height: 3216, refreshRate: 120 },
];

describe("fluidDisplayMode", () => {
  it("réglage activé : la fréquence la plus haute, dans la définition courante", () => {
    expect(fluidDisplayMode({ platform: "android", enabled: true, screen: { currentModeId: 2, modes: oppo } })?.id).toBe(1);
    expect(fluidDisplayMode({ platform: "android", enabled: true, screen: { currentModeId: 1, modes: oppo } })?.id).toBe(1);
    expect(fluidDisplayMode({ platform: "android", enabled: true, screen: { currentModeId: 5, modes: oppo } })?.id).toBe(8);
  });

  it("le meilleur multiple : 24 i/s sur 60/72/90/120 → 120 (5 × 24), jamais 72 ni 90", () => {
    expect(fluidDisplayMode({ platform: "android", enabled: true, fps: 23.976, screen: { currentModeId: 2, modes: oppo } })?.id).toBe(1);
    const cinema = [{ id: 1, width: 1080, height: 2400, refreshRate: 24 }, { id: 2, width: 1080, height: 2400, refreshRate: 60 }];
    expect(fluidDisplayMode({ platform: "android", enabled: true, fps: 23.976, screen: { currentModeId: 2, modes: cinema } })?.id).toBe(1);
    const max72 = [{ id: 1, width: 1080, height: 2400, refreshRate: 60 }, { id: 2, width: 1080, height: 2400, refreshRate: 72 }];
    expect(fluidDisplayMode({ platform: "android", enabled: true, fps: 24, screen: { currentModeId: 1, modes: max72 } })?.id).toBe(2);
  });

  it("30 i/s : 90 sur un écran 60/90, 60 sur un écran 30/60", () => {
    const max90 = [{ id: 1, width: 1080, height: 2400, refreshRate: 60 }, { id: 2, width: 1080, height: 2400, refreshRate: 90 }];
    const max60 = [{ id: 1, width: 1080, height: 2400, refreshRate: 30 }, { id: 2, width: 1080, height: 2400, refreshRate: 60 }];
    expect(fluidDisplayMode({ platform: "android", enabled: true, fps: 29.97, screen: { currentModeId: 1, modes: max90 } })?.id).toBe(2);
    expect(fluidDisplayMode({ platform: "android", enabled: true, fps: 30, screen: { currentModeId: 1, modes: max60 } })?.id).toBe(2);
  });

  it("aucun multiple exact (24 i/s sur 60/90, 25 i/s sur 60/120) : la fréquence la plus haute", () => {
    const max90 = [{ id: 1, width: 1080, height: 2400, refreshRate: 60 }, { id: 2, width: 1080, height: 2400, refreshRate: 90 }];
    expect(fluidDisplayMode({ platform: "android", enabled: true, fps: 23.976, screen: { currentModeId: 1, modes: max90 } })?.id).toBe(2);
    expect(fluidDisplayMode({ platform: "android", enabled: true, fps: 25, screen: { currentModeId: 2, modes: oppo } })?.id).toBe(1);
  });

  it("réglage désactivé : rien n'est demandé, le téléphone décide", () => {
    expect(fluidDisplayMode({ platform: "android", enabled: false, screen: { currentModeId: 2, modes: oppo } })).toBeNull();
  });

  it("iOS, ou écran inconnu : rien", () => {
    expect(fluidDisplayMode({ platform: "ios", enabled: true, screen: { currentModeId: 2, modes: oppo } })).toBeNull();
    expect(fluidDisplayMode({ platform: "android", enabled: true, screen: null })).toBeNull();
    expect(fluidDisplayMode({ platform: "android", enabled: true, screen: { modes: oppo } })).toBeNull();
  });
});
