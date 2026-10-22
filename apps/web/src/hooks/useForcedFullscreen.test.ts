import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ montage: null as string | null, fenetrage: null as string | null }));
vi.mock("../desktop/detect", () => ({ montageLinux: () => h.montage, fenetrageLinux: () => h.fenetrage }));
vi.mock("../desktop/bridge", () => ({ invoke: vi.fn(), relaunch: vi.fn() }));

import { forcedFullscreenSession } from "./useForcedFullscreen";

describe("plein écran imposé du lecteur bureau", () => {
  it("seulement sous Wayland sans colle (GNOME, wlroots avec écran HDR)", () => {
    h.montage = "wayland"; h.fenetrage = "plein-ecran";
    expect(forcedFullscreenSession()).toBe(true);
  });

  it("jamais avec la colle KWin, sous X11 ni hors Linux : le bouton bascule", () => {
    h.montage = "wayland"; h.fenetrage = "libre";
    expect(forcedFullscreenSession()).toBe(false);
    h.montage = "x11"; h.fenetrage = null;
    expect(forcedFullscreenSession()).toBe(false);
    h.montage = null;
    expect(forcedFullscreenSession()).toBe(false);
  });
});
