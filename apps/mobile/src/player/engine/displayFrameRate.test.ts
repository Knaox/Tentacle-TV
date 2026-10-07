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

  it("24 i/s : un mode à 24 Hz exact passe avant tout, 72 Hz non (pas exact)", () => {
    const withCinema = [...oppo, { id: 9, width: 1080, height: 2412, refreshRate: 24 }];
    expect(fluidDisplayMode({ platform: "android", enabled: true, fps: 23.976, screen: { currentModeId: 2, modes: withCinema } })?.id).toBe(9);
    expect(fluidDisplayMode({ platform: "android", enabled: true, fps: 23.976, screen: { currentModeId: 2, modes: oppo } })?.id).toBe(1);
  });

  it("le meilleur selon le modèle : 90 reste 90, un écran 30/60 passe à 60", () => {
    const max90 = [{ id: 1, width: 1080, height: 2400, refreshRate: 60 }, { id: 2, width: 1080, height: 2400, refreshRate: 90 }];
    const max60 = [{ id: 1, width: 1080, height: 2400, refreshRate: 30 }, { id: 2, width: 1080, height: 2400, refreshRate: 60 }];
    expect(fluidDisplayMode({ platform: "android", enabled: true, fps: 23.976, screen: { currentModeId: 1, modes: max90 } })?.id).toBe(2);
    expect(fluidDisplayMode({ platform: "android", enabled: true, fps: 23.976, screen: { currentModeId: 1, modes: max60 } })?.id).toBe(2);
    // 30 i/s sur un écran 30/60 : le mode exact, 30 Hz.
    expect(fluidDisplayMode({ platform: "android", enabled: true, fps: 30, screen: { currentModeId: 2, modes: max60 } })?.id).toBe(1);
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
